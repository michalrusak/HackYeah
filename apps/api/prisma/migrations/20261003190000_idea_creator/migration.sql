-- CreateEnum
CREATE TYPE "IdeaStage" AS ENUM ('POMYSL', 'PROTOTYP', 'TEST_MIKROSKALA', 'WDROZONE', 'SKALOWANIE');

-- CreateEnum
CREATE TYPE "IdeaKind" AS ENUM ('IDEA', 'GOOD_PRACTICE');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AssistantMessageKind" AS ENUM ('CHAT', 'EXPAND', 'WILDCARD');

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "essence" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "stage" "IdeaStage" NOT NULL,
    "kind" "IdeaKind" NOT NULL DEFAULT 'IDEA',
    "status" "IdeaStatus" NOT NULL DEFAULT 'DRAFT',
    "region" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT,
    "audiences" TEXT[],
    "areas" TEXT[],
    "needs" TEXT[],
    "plainLanguageSummary" TEXT,
    "editTokenHash" TEXT NOT NULL,
    "adoptedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaCanvas" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaVisual" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaVisual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantCall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "budget" TEXT,
    "maxGrant" TEXT,
    "sections" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "grantCallId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "editTokenHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT,
    "role" "AssistantMessageRole" NOT NULL,
    "kind" "AssistantMessageKind" NOT NULL DEFAULT 'CHAT',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Idea_status_createdAt_idx" ON "Idea"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Idea_kind_status_idx" ON "Idea"("kind", "status");

-- CreateIndex
CREATE INDEX "Idea_stage_idx" ON "Idea"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaCanvas_ideaId_key" ON "IdeaCanvas"("ideaId");

-- CreateIndex
CREATE INDEX "IdeaVisual_ideaId_createdAt_idx" ON "IdeaVisual"("ideaId", "createdAt");

-- CreateIndex
CREATE INDEX "GrantCall_isPublished_opensAt_idx" ON "GrantCall"("isPublished", "opensAt");

-- CreateIndex
CREATE INDEX "Application_grantCallId_status_idx" ON "Application"("grantCallId", "status");

-- CreateIndex
CREATE INDEX "Application_ideaId_idx" ON "Application"("ideaId");

-- CreateIndex
CREATE INDEX "AssistantMessage_ideaId_createdAt_idx" ON "AssistantMessage"("ideaId", "createdAt");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_adoptedFromId_fkey" FOREIGN KEY ("adoptedFromId") REFERENCES "Idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvas" ADD CONSTRAINT "IdeaCanvas_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaVisual" ADD CONSTRAINT "IdeaVisual_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_grantCallId_fkey" FOREIGN KEY ("grantCallId") REFERENCES "GrantCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
