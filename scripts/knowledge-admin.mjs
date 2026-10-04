import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
const credentialsFile = fileURLToPath(
  new URL("../tmp/knowledge-admin.txt", import.meta.url),
);
const env = readFileSync(envFile, "utf8");
if (
  /^KNOWLEDGE_ADMIN_PASSWORD_HASH=\S+/m.test(env) &&
  !process.argv.includes("--rotate")
) {
  console.log(
    "Administrator jest już skonfigurowany. --rotate zmieni hasło i unieważni sesje po ponownym uruchomieniu API.",
  );
  process.exit(0);
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const line = `KNOWLEDGE_ADMIN_PASSWORD_HASH=${hash}`;
writeFileSync(
  envFile,
  (/^KNOWLEDGE_ADMIN_PASSWORD_HASH=/m.test(env)
    ? env.replace(/^KNOWLEDGE_ADMIN_PASSWORD_HASH=.*$/m, line)
    : `${env.trimEnd()}\n${line}\n`
  )
    // Tryb demo podaje to hasło w formularzu, więc musi zostać zgodne z hashem.
    .replace(/^DEMO_ADMIN_PASSWORD=.*$/m, `DEMO_ADMIN_PASSWORD=${password}`),
);
mkdirSync(fileURLToPath(new URL("../tmp/", import.meta.url)), {
  recursive: true,
});
writeFileSync(
  credentialsFile,
  `Panel: http://localhost:4200/zasobnik/admin\nHasło: ${password}\n`,
  { mode: 0o600 },
);
console.log(
  "Hash zapisany w .env. Lokalne hasło znajduje się w tmp/knowledge-admin.txt (plik ignorowany przez Git). Uruchom ponownie API.",
);
