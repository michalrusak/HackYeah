import path from "node:path";
import { fileURLToPath } from "node:url";
import { execLocal, waitForExit } from "./lib/exec-local.mjs";
import { loadRootEnv } from "./lib/load-env.mjs";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const action = process.argv[2];
if (!["migrate", "seed"].includes(action)) {
  console.error("Usage: node scripts/testers-db.mjs migrate|seed");
  process.exit(1);
}

loadRootEnv();
try {
  if (action === "migrate") {
    await waitForExit(
      execLocal(packageManager, ["--filter", "api", "db:migrate:deploy"], {
        cwd: rootDir,
      }),
    );
    process.exit(0);
  }
  await waitForExit(
    execLocal(packageManager, ["--filter", "@repo/api-contracts", "build"], {
      cwd: rootDir,
    }),
  );
  await waitForExit(
    execLocal(packageManager, ["--filter", "api", "build"], { cwd: rootDir }),
  );
  await waitForExit(
    execLocal(process.execPath, ["dist/modules/knowledge/seed.js"], {
      cwd: path.join(rootDir, "apps/api"),
    }),
  );
  await waitForExit(
    execLocal(
      process.execPath,
      ["apps/api/dist/database/testers-db.cli.js", action],
      { cwd: rootDir },
    ),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Database command failed",
  );
  process.exitCode = 1;
}
