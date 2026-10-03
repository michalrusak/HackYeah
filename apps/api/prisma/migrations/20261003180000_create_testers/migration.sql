CREATE TABLE "tester_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_hash" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(80) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "bio" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessibility_needs" TEXT NOT NULL DEFAULT '',
  "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "availability" VARCHAR(10) NOT NULL CHECK ("availability" IN ('remote', 'onsite', 'hybrid')),
  "consent" BOOLEAN NOT NULL DEFAULT true CHECK ("consent" = true),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_demo" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_tester_profiles_owner" ON "tester_profiles"("owner_hash");

CREATE TABLE "tester_searches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_hash" VARCHAR(64) NOT NULL,
  "query" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "matches" JSONB NOT NULL,
  "candidate_count" INTEGER NOT NULL,
  "total_profiles" INTEGER NOT NULL,
  "candidate_limit" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_searches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_tester_searches_owner_created" ON "tester_searches"("owner_hash", "created_at");

CREATE TABLE "tester_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "search_id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tester_assignments_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "tester_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tester_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "tester_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_tester_assignments_search_profile" ON "tester_assignments"("search_id", "profile_id");
