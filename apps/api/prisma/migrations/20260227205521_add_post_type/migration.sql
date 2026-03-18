-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'REEL');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'DELETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MetricEntityType" AS ENUM ('CAMPAIGN', 'AD_SET', 'AD');

-- AlterTable
ALTER TABLE "ad_campaigns" ADD COLUMN     "targeting" JSONB;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "post_type" "PostType" NOT NULL DEFAULT 'TEXT';

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "platform_ad_set_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "daily_budget" INTEGER,
    "lifetime_budget" INTEGER,
    "bid_strategy" TEXT,
    "bid_amount" INTEGER,
    "targeting" JSONB,
    "placements" JSONB,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "total_spend" INTEGER NOT NULL DEFAULT 0,
    "total_impressions" INTEGER NOT NULL DEFAULT 0,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "total_conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "ad_set_id" TEXT NOT NULL,
    "post_id" TEXT,
    "platform_ad_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "creative" JSONB,
    "total_spend" INTEGER NOT NULL DEFAULT 0,
    "total_impressions" INTEGER NOT NULL DEFAULT 0,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "total_conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_metrics" (
    "id" TEXT NOT NULL,
    "entity_type" "MetricEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_sets_campaign_id_status_idx" ON "ad_sets"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_campaign_id_platform_ad_set_id_key" ON "ad_sets"("campaign_id", "platform_ad_set_id");

-- CreateIndex
CREATE INDEX "ads_ad_set_id_status_idx" ON "ads"("ad_set_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ads_ad_set_id_platform_ad_id_key" ON "ads"("ad_set_id", "platform_ad_id");

-- CreateIndex
CREATE INDEX "ad_metrics_entity_type_date_idx" ON "ad_metrics"("entity_type", "date");

-- CreateIndex
CREATE INDEX "ad_metrics_entity_id_date_idx" ON "ad_metrics"("entity_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_metrics_entity_type_entity_id_date_key" ON "ad_metrics"("entity_type", "entity_id", "date");

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
