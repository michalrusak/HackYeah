CREATE TABLE "tester_pilot_listings" (
  "project_id" UUID PRIMARY KEY REFERENCES "tester_projects"("id") ON DELETE CASCADE,
  "conditions" JSONB NOT NULL,
  "reviewed_project_updated_at" TIMESTAMPTZ(3) NOT NULL,
  "approved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewer" VARCHAR(120) NOT NULL
);
