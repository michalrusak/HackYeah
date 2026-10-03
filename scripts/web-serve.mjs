import path from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execLocal, waitForExit } from "./lib/exec-local.mjs";
import { loadRootEnv } from "./lib/load-env.mjs";

loadRootEnv();

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/web",
);
const port = process.env.WEB_PORT ?? "4200";
const distDir = path.join(webRoot, "dist", "web", "browser");

// Only the public backend address is written into the served build.
const apiOrigin = process.env.API_URL ?? "http://localhost:3000";
writeFileSync(
  path.join(distDir, "api-config.json"),
  JSON.stringify({
    apiUrl: process.env.WEB_API_URL ?? `${apiOrigin.replace(/\/+$/, "")}/api`,
  }),
);

await waitForExit(
  execLocal("serve", [distDir, "-l", port, "-s"], { cwd: webRoot }),
);
