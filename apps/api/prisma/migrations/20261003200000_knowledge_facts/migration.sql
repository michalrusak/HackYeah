-- AlterTable
ALTER TABLE "knowledge_resources" ADD COLUMN "facts" JSONB NOT NULL DEFAULT '[]';
