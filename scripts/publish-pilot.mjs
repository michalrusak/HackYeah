import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "apps/api/package.json"));
requireApi("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const { Pool } = requireApi("pg");
const { PilotConditionsSchema, TesterIdSchema } =
  await import("../packages/api-contracts/dist/index.js");
const [projectId, conditionsFile, reviewer] = process.argv.slice(2);
if (!projectId || !conditionsFile || !reviewer || reviewer.length > 120) {
  throw new Error(
    "Usage: node scripts/publish-pilot.mjs <project-id> <conditions.json> <reviewer>",
  );
}
TesterIdSchema.parse(projectId);
const conditions = PilotConditionsSchema.parse(
  JSON.parse(await readFile(conditionsFile, "utf8")),
);
if (
  !conditions.recruitmentEndsAt ||
  Date.parse(conditions.recruitmentEndsAt) <= Date.now()
)
  throw new Error("Recruitment must still be open.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    "tester-project:" + projectId.toLowerCase(),
  ]);
  const { rows } = await client.query(
    "SELECT status, stage, updated_at FROM tester_projects WHERE id = $1",
    [projectId],
  );
  const project = rows[0];
  if (!project || project.status !== "open" || project.stage !== "prototype")
    throw new Error("Only open prototypes can be admitted to pilot matching.");
  await client.query(
    `INSERT INTO tester_pilot_listings (project_id, conditions, reviewed_project_updated_at, reviewer)
    VALUES ($1, $2, $3, $4) ON CONFLICT (project_id) DO UPDATE SET conditions = EXCLUDED.conditions,
    reviewed_project_updated_at = EXCLUDED.reviewed_project_updated_at, reviewer = EXCLUDED.reviewer, approved_at = CURRENT_TIMESTAMP`,
    [projectId, conditions, project.updated_at, reviewer],
  );
  await client.query("COMMIT");
  console.log("Pilot admitted to matchmaking:", projectId);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
