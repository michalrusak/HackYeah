import {
  AdminSessionSchema,
  AuthSessionDataSchema,
  DemoDataSchema,
  GrantCallListDataSchema,
  HealthDataSchema,
  IdeaListDataSchema,
  KnowledgeListSchema,
  PublicApiConfigSchema,
  TesterProfilesDataSchema,
} from "../packages/api-contracts/dist/index.js";
import { loadRootEnv } from "./lib/load-env.mjs";

loadRootEnv();
const web = new URL(process.argv[2] ?? `http://localhost:${process.env.WEB_PORT ?? "4200"}`);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
let failures = 0;

async function check(label, action) {
  try {
    console.log(`PASS ${label}: ${await action()}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : "błąd sprawdzenia"}`);
  }
}

async function get(url) {
  const response = await fetch(url, {
    headers: { Origin: web.origin },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

for (const path of ["/", "/pomysly", "/pomysly/nabory", "/tester-innowacji", "/zasobnik"]) {
  await check(`strona ${path}`, async () => {
    const html = await (await get(new URL(path, web))).text();
    if (!html.includes("<app-root")) throw new Error("brak dokumentu aplikacji Angular");
    return "serwer obsługuje bezpośrednie wejście";
  });
}

let api;
await check("adres API dla przeglądarki", async () => {
  const config = PublicApiConfigSchema.parse(await (await get(new URL("/api-config.json", web))).json());
  const configured = new URL(config.apiUrl, web);
  if (!localHosts.has(web.hostname) && localHosts.has(configured.hostname)) {
    throw new Error("publiczna strona wskazuje API na localhost komputera jurora");
  }
  if (web.protocol === "https:" && configured.protocol !== "https:") {
    throw new Error("strona HTTPS wskazuje niezabezpieczone API HTTP");
  }
  api = configured.href.replace(/\/+$/, "");
  return config.apiUrl;
});

async function data(path, schema) {
  const response = await get(`${api}${path}`);
  if (new URL(api).origin !== web.origin && (
    response.headers.get("access-control-allow-origin") !== web.origin ||
    response.headers.get("access-control-allow-credentials") !== "true"
  )) throw new Error("CORS nie dopuszcza adresu frontendu z sesją; sprawdź WEB_ORIGIN");
  const body = await response.json();
  if (body.success !== true) throw new Error("API nie zwróciło sukcesu");
  return schema.parse(body.data);
}

// Logowanie tak jak z przeglądarki: zwraca ciasteczko sesji do kolejnego żądania.
async function signIn(path, body) {
  const response = await fetch(`${api}${path}`, {
    method: "POST",
    headers: { Origin: web.origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`logowanie odrzucone, HTTP ${response.status}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  if (!cookie) throw new Error("brak ciasteczka sesji");
  return cookie;
}

async function withSession(path, schema, cookie) {
  const response = await fetch(`${api}${path}`, {
    headers: { Origin: web.origin, Cookie: cookie },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`sesja odrzucona, HTTP ${response.status}`);
  return schema.parse((await response.json()).data);
}

if (api) {
  await check("API i PostgreSQL", async () => {
    const health = await data("/health", HealthDataSchema);
    if (health.database !== "up") throw new Error("baza danych niedostępna");
    return "baza odpowiada";
  });
  for (const [label, path, schema, count] of [
    ["zasobnik", "/knowledge/resources", KnowledgeListSchema, (value) => value.resources.length],
    ["pomysły", "/ideas", IdeaListDataSchema, (value) => value.total],
    ["testerzy", "/testers/profiles", TesterProfilesDataSchema, (value) => value.total],
  ]) {
    await check(label, async () => {
      const total = count(await data(path, schema));
      if (total === 0) throw new Error("pusty katalog; uruchom pnpm db:seed na bazie demo");
      return `${total} dostępnych wpisów`;
    });
  }
  await check("generator wniosków", async () => {
    const calls = await data("/calls", GrantCallListDataSchema);
    if (!calls.hasOpenCall) throw new Error("brak otwartego naboru; sprawdź dane i terminy demo");
    return "jest otwarty nabór";
  });

  let demo;
  await check("tryb demo", async () => {
    demo = await data("/demo", DemoDataSchema);
    if (!demo.adminPassword) throw new Error("brak hasła administratora w formularzu; sprawdź DEMO_MODE i DEMO_ADMIN_PASSWORD");
    if (!demo.accounts.length) throw new Error("brak kont demo; sprawdź DEMO_ACCOUNT_PASSWORD");
    return `hasło administratora i ${demo.accounts.length} konta są uzupełniane w formularzach`;
  });
  if (demo?.adminPassword) {
    await check("logowanie administratora", async () => {
      const cookie = await signIn("/knowledge/admin/login", { password: demo.adminPassword });
      await withSession("/knowledge/admin/session", AdminSessionSchema, cookie);
      return "uzupełnione hasło otwiera panel";
    });
  }
  for (const account of demo?.accounts ?? []) {
    await check(`logowanie ${account.login}`, async () => {
      const cookie = await signIn("/auth/login", { login: account.login, password: account.password });
      const { user } = await withSession("/auth/me", AuthSessionDataSchema, cookie);
      if (user?.login !== account.login) throw new Error("sesja nie należy do konta demo");
      if (account.role === "expert" && !user.expert) throw new Error("konto nie ma roli eksperta");
      return account.role === "expert" ? "konto ma rolę eksperta" : "konto działa";
    });
  }
}

console.log("To kontrola HTTP i danych; zapisuje wyłącznie sesje logowania demo. AI: node scripts/matchmaking-demo.mjs. Pełne przebiegi UI: docs/DEMO.md.");
process.exitCode = failures ? 1 : 0;
