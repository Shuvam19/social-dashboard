/*
  Warnings:

  - The values [ADMIN,VIEWER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CONNECT_TOKENS', 'PUBLISH_YOUTUBE', 'PUBLISH_FACEBOOK', 'PUBLISH_INSTAGRAM', 'PUBLISH_LINKEDIN', 'PUBLISH_TWITTER', 'PUBLISH_TIKTOK', 'PUBLISH_PINTEREST', 'EDIT_CAPTIONS', 'SCHEDULE', 'MANAGE_MEMBERS', 'VIEW_ANALYTICS', 'APPROVE_POSTS', 'MANAGE_CAMPAIGNS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('STORE_LINKED', 'STORE_UNLINKED', 'DEFAULTS_CHANGED', 'POST_CREATED', 'POST_UPDATED', 'POST_PUBLISHED', 'POST_SUBMITTED_FOR_REVIEW', 'POST_APPROVED', 'POST_REJECTED', 'POST_SCHEDULED', 'POST_DELETED', 'MEMBER_INVITED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'MEMBER_PERMISSIONS_CHANGED', 'TOKEN_CONNECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "PostStatus" ADD VALUE 'APPROVED';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'PUBLISHER', 'EDITOR', 'ANALYST');
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" SET DEFAULT 'ANALYST';
COMMIT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AlterTable
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" SET DEFAULT 'ANALYST';

-- CreateTable
CREATE TABLE "member_permissions" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_permissions_membership_id_idx" ON "member_permissions"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_permissions_membership_id_permission_key" ON "member_permissions"("membership_id", "permission");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "member_permissions" ADD CONSTRAINT "member_permissions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
