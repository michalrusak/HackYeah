import { readFileSync } from "node:fs";
import { MatchmakingResponseSchema } from "../packages/api-contracts/dist/index.js";
import { loadRootEnv } from "./lib/load-env.mjs";

loadRootEnv();
const translations = JSON.parse(
  readFileSync(
    new URL("../apps/web/public/i18n/pl.json", import.meta.url),
    "utf8",
  ),
);
const apiOrigin = (process.env.API_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const scenarios = [
  { key: "seniors", expected: "senior-cuder" },
  { key: "migrants", expected: "health-guide-pl" },
  { key: "school", expected: "bez-presji-z-depresji" },
];

let failures = 0;
for (const scenario of scenarios) {
  try {
    const response = await fetch(`${apiOrigin}/api/matchmaking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description:
          translations.matchmaking.examples[scenario.key].description,
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok)
      throw new Error(
        `HTTP ${response.status}; sprawdź konfigurację API i OpenRouter`,
      );
    const { data } = MatchmakingResponseSchema.parse(await response.json());
    const ids = data.matches.slice(0, 3).map((match) => match.id);
    const passed = ids.includes(scenario.expected);
    console.log(
      `${passed ? "PASS" : "FAIL"} ${scenario.key}: ${ids.join(", ")}`,
    );
    if (!passed) failures++;
  } catch (error) {
    console.error(
      `FAIL ${scenario.key}: ${error instanceof Error && error.message.startsWith("HTTP ") ? error.message : "brak poprawnej odpowiedzi API"}`,
    );
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
