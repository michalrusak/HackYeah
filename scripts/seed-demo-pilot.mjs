import { createRequire } from "node:module";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "apps/api/package.json"));
requireApi("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Demo seed is restricted to a local database.");
const { Pool } = requireApi("pg");
const { PilotConditionsSchema } =
  await import("../packages/api-contracts/dist/index.js");
const accountId = "06a98bc5-5551-42f2-b08a-d478e3362df5";
const projectId = "96c266b4-ae90-472b-ac84-01a163025121";
const ends = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
const conditions = PilotConditionsSchema.parse({
  isDemo: true,
  audiences: ["Osoby w kryzysie bezdomności"],
  areas: ["Bezdomność"],
  needs: ["Dostęp do usług", "Dostępna komunikacja"],
  recruitmentEndsAt: ends,
  testSchedule:
    "Przykładowy test zdalny: dwa spotkania w ciągu dwóch tygodni. Termin do uzgodnienia.",
  commitment:
    "Dwa spotkania po 45 minut i krótka ankieta o czytelności informacji. To fikcyjny scenariusz demonstracyjny.",
  participants: "organization",
});
const salt = randomBytes(16).toString("hex");
const hash =
  "scrypt$" +
  salt +
  "$" +
  scryptSync(randomBytes(32), salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO accounts (id, login, password_hash, owner_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [accountId, "demo_pilot_organizer", hash, randomBytes(32).toString("hex")],
  );
  await client.query(
    `INSERT INTO tester_projects (id, owner_id, organizer_name, title, description, requirements, location, mode, stage, status)
    VALUES ($1, $2, $3, $4, $5, $6, '', 'remote', 'prototype', 'open') ON CONFLICT (id) DO NOTHING`,
    [
      projectId,
      accountId,
      "Zespół demonstracyjny Hubu (fikcyjny)",
      "Pierwszy krok — mapa punktów pomocy (demo)",
      "Prototyp prostego przewodnika po punktach wsparcia dla osób w kryzysie bezdomności. Pomaga znaleźć noclegownię, posiłek i pomoc w formalnościach. Projekt służy wyłącznie demonstracji aplikacji.",
      "Przykładowo: organizacja wspierająca osoby w kryzysie bezdomności, dostęp do przeglądarki i gotowość do przekazania uwag. Nie należy podawać danych podopiecznych.",
    ],
  );
  await client.query(
    `INSERT INTO tester_pilot_listings (project_id, conditions, reviewed_project_updated_at, reviewer)
    SELECT id, $2, updated_at, 'DEMO — fikcyjny wpis, bez zatwierdzenia ROPS' FROM tester_projects WHERE id = $1
    ON CONFLICT (project_id) DO NOTHING`,
    [projectId, conditions],
  );
  await client.query("COMMIT");
  console.log("Demo pilot ready:", projectId);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
