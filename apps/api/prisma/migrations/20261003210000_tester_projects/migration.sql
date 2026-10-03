CREATE TABLE "tester_projects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "organizer_name" VARCHAR(100) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "requirements" TEXT NOT NULL,
  "location" VARCHAR(160) NOT NULL DEFAULT '',
  "mode" VARCHAR(10) NOT NULL CHECK ("mode" IN ('remote', 'onsite', 'hybrid')),
  "stage" VARCHAR(10) NOT NULL CHECK ("stage" IN ('idea', 'prototype', 'solution')),
  "status" VARCHAR(6) NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'closed')),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tester_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tester_projects_status_created_at_idx" ON "tester_projects"("status", "created_at");
CREATE INDEX "tester_projects_owner_id_created_at_idx" ON "tester_projects"("owner_id", "created_at");

CREATE TABLE "tester_project_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'declined', 'withdrawn')),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_project_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tester_project_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "tester_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tester_project_applications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tester_project_applications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "tester_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tester_project_applications_project_id_account_id_key" ON "tester_project_applications"("project_id", "account_id");
CREATE INDEX "tester_project_applications_account_id_created_at_idx" ON "tester_project_applications"("account_id", "created_at");

CREATE TABLE "tester_project_feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "author_name" VARCHAR(80) NOT NULL,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "review" TEXT NOT NULL,
  "improvement" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_project_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tester_project_feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "tester_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tester_project_feedback_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tester_project_feedback_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "tester_project_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tester_project_feedback_application_id_key" ON "tester_project_feedback"("application_id");
CREATE UNIQUE INDEX "tester_project_feedback_project_id_account_id_key" ON "tester_project_feedback"("project_id", "account_id");
CREATE INDEX "tester_project_feedback_project_id_created_at_idx" ON "tester_project_feedback"("project_id", "created_at");
