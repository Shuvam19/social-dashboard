-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "raw_payload" JSONB;

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "event_type" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_logs_platform_received_at_idx" ON "webhook_logs"("platform", "received_at");

-- CreateIndex
CREATE INDEX "webhook_logs_processed_at_idx" ON "webhook_logs"("processed_at");

-- CreateIndex
CREATE INDEX "interactions_parent_id_idx" ON "interactions"("parent_id");

-- CreateIndex
CREATE INDEX "interactions_is_read_is_deleted_idx" ON "interactions"("is_read", "is_deleted");

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
