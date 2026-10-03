-- CreateTable
CREATE TABLE "knowledge_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "areas" TEXT[],
    "audiences" TEXT[],
    "needs" TEXT[],
    "source_url" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "verified_at" TEXT NOT NULL,
    "publication_year" INTEGER,
    "video_page_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_admin_sessions" (
    "id" TEXT NOT NULL,
    "csrf_token" TEXT NOT NULL,
    "credential_version" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_receipts" (
    "id" TEXT NOT NULL,
    "created_at" DATE NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "need_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_daily_counts" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "need_daily_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_area_counts" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "area" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "need_area_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_tag_counts" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "need" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "need_tag_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_resources_status_kind_verified_at_idx" ON "knowledge_resources"("status", "kind", "verified_at");

-- CreateIndex
CREATE INDEX "knowledge_admin_sessions_expires_at_idx" ON "knowledge_admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "need_daily_counts_day_key" ON "need_daily_counts"("day");

-- CreateIndex
CREATE UNIQUE INDEX "need_area_counts_day_area_key" ON "need_area_counts"("day", "area");

-- CreateIndex
CREATE UNIQUE INDEX "need_tag_counts_day_need_key" ON "need_tag_counts"("day", "need");
