-- CreateTable
CREATE TABLE "need_source_counts" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "need_source_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_phrase_counts" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "phrase" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_phrase_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "need_source_counts_day_source_key" ON "need_source_counts"("day", "source");

-- CreateIndex
CREATE UNIQUE INDEX "search_phrase_counts_day_phrase_key" ON "search_phrase_counts"("day", "phrase");
