-- AlterEnum
ALTER TYPE "ContactAuthor" ADD VALUE 'EXPERT';

-- AlterEnum
ALTER TYPE "ContactCategory" ADD VALUE 'JST_ADVICE';

-- AlterEnum
ALTER TYPE "IdeaMessageAuthor" ADD VALUE 'EXPERT';

-- AlterTable
ALTER TABLE "IdeaMessage" ADD COLUMN     "authorName" TEXT;

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "expert_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "expert_name" VARCHAR(100);

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "area" TEXT,
ADD COLUMN     "expert_id" UUID;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "author_name" TEXT;

-- CreateIndex
CREATE INDEX "conversations_expert_id_idx" ON "conversations"("expert_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
