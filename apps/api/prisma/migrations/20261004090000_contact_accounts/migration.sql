-- Rozmowy z prototypu należały do kont-atrap z tabeli "users" i nie da się
-- ich przypisać do prawdziwych kont, dlatego znikają razem z tą tabelą.
DELETE FROM "messages";
DELETE FROM "conversations";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_citizen_id_fkey";
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_employee_id_fkey";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "UserRole";

-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('QUESTION', 'MENTOR', 'PARTNERSHIP');
CREATE TYPE "ContactStatus" AS ENUM ('AWAITING_ROPS', 'ANSWERED', 'CLOSED');
CREATE TYPE "ContactAuthor" AS ENUM ('USER', 'ROPS');

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "citizen_id",
DROP COLUMN "employee_id",
ADD COLUMN "category" "ContactCategory" NOT NULL,
ADD COLUMN "status" "ContactStatus" NOT NULL DEFAULT 'AWAITING_ROPS',
ADD COLUMN "account_id" UUID NOT NULL,
ADD COLUMN "first_name" TEXT NOT NULL,
ADD COLUMN "last_name" TEXT NOT NULL,
ADD COLUMN "organization" TEXT;

ALTER TABLE "messages" DROP COLUMN "sender_id",
ADD COLUMN "author" "ContactAuthor" NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_account_id_updated_at_idx" ON "conversations"("account_id", "updated_at");
CREATE INDEX "conversations_status_updated_at_idx" ON "conversations"("status", "updated_at");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
