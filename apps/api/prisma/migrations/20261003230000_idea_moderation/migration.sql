-- AlterEnum
ALTER TYPE "IdeaStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "IdeaStatus" ADD VALUE 'NEEDS_CHANGES';
ALTER TYPE "IdeaStatus" ADD VALUE 'REJECTED';

-- CreateEnum
CREATE TYPE "IdeaMessageAuthor" AS ENUM ('AUTHOR', 'ROPS');

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN "awaitsRops" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unreadReply" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "IdeaMessage" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "author" "IdeaMessageAuthor" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaMessage_ideaId_createdAt_idx" ON "IdeaMessage"("ideaId", "createdAt");

-- AddForeignKey
ALTER TABLE "IdeaMessage" ADD CONSTRAINT "IdeaMessage_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
