import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "apps/api/package.json"));
requireApi("dotenv").config({ path: path.join(root, ".env"), quiet: true });
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Expected local database");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    "UPDATE tester_projects SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND owner_id = $2 AND title = $3 AND status = 'open'",
    [
      "96c266b4-ae90-472b-ac84-01a163025121",
      "06a98bc5-5551-42f2-b08a-d478e3362df5",
      "Pierwszy krok — mapa punktów pomocy (demo)",
    ],
  );
  console.log("Fictional pilot closed:", result.rowCount);
} finally {
  await pool.end();
}
