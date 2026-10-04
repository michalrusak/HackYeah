-- CreateTable
CREATE TABLE "grant_alert_subscriptions" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_alert_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grant_alert_subscriptions_email_idx" ON "grant_alert_subscriptions"("email");

