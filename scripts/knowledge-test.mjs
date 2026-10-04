import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "./lib/load-env.mjs";
import { execLocal, waitForExit } from "./lib/exec-local.mjs";

loadRootEnv();
const apiDir = fileURLToPath(new URL("../apps/api/", import.meta.url));
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { Client } = require("pg");
const developmentUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(developmentUrl.hostname))
  throw new Error("This test script supports a local PostgreSQL only.");
const testUrl = new URL(developmentUrl);
testUrl.pathname = "/hackyeah_knowledge_test";
testUrl.search = "";
const client = new Client({ connectionString: developmentUrl.href });
await client.connect();
try {
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    ["hackyeah_knowledge_test"],
  );
  if (!exists.rowCount)
    await client.query("CREATE DATABASE hackyeah_knowledge_test");
} finally {
  await client.end();
}
const env = {
  DATABASE_URL: testUrl.href,
  KNOWLEDGE_TEST_DATABASE_URL: testUrl.href,
  TEST_DATABASE_URL: testUrl.href,
};
await waitForExit(
  execLocal("prisma", ["migrate", "deploy", "--config", "prisma7.config.ts"], {
    cwd: apiDir,
    env,
  }),
);
await waitForExit(
  execLocal("vitest", ["run", "--config", "vitest.config.e2e.ts"], {
    cwd: apiDir,
    env,
  }),
);
