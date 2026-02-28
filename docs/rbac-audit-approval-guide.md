# Multi-User RBAC, Audit Logging & Approval Workflow — Implementation Guide

> **Date:** February 28, 2026
> **Scope:** Convert the single-user social dashboard into a collaborative, multi-user application with roles, fine-grained permissions, immutable audit logging, and a draft → reviewer → publisher approval workflow.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1 — Prisma Schema Changes](#step-1--prisma-schema-changes)
3. [Step 2 — Backend RBAC (Roles, Permissions, Guards)](#step-2--backend-rbac-roles-permissions-guards)
4. [Step 3 — Audit Logging System](#step-3--audit-logging-system)
5. [Step 4 — Approval Workflow for Posts](#step-4--approval-workflow-for-posts)
6. [Step 5 — Tenant & Member Management Updates](#step-5--tenant--member-management-updates)
7. [Step 6 — Shared Types Updates](#step-6--shared-types-updates)
8. [Step 7 — Frontend Changes](#step-7--frontend-changes)

---

## Overview

### Current State

- **Roles:** `ADMIN`, `EDITOR`, `VIEWER` (basic 3-role enum)
- **Permissions:** None — access control is purely role-based via `@Roles()` decorator
- **Audit Logging:** None — only webhook logs exist
- **Post Workflow:** `DRAFT → SCHEDULED → PUBLISHING → PUBLISHED | FAILED` (no approval)
- **Users per Tenant:** Supported via `TenantMembership` model, but no invitation UI or fine-grained control

### Target State

- **Roles:** `OWNER`, `PUBLISHER`, `EDITOR`, `ANALYST` (4-role hierarchy)
- **Permissions:** Fine-grained per-membership permissions: `CONNECT_TOKENS`, `PUBLISH_YOUTUBE`, `PUBLISH_FACEBOOK`, `PUBLISH_INSTAGRAM`, `PUBLISH_LINKEDIN`, `PUBLISH_TWITTER`, `PUBLISH_TIKTOK`, `PUBLISH_PINTEREST`, `EDIT_CAPTIONS`, `SCHEDULE`, `MANAGE_MEMBERS`, `VIEW_ANALYTICS`
- **Audit Log:** Immutable, append-only `AuditLog` table logging all critical actions
- **Post Workflow:** `DRAFT → PENDING_REVIEW → APPROVED → SCHEDULED/PUBLISHING → PUBLISHED | FAILED`
- **Users per Tenant:** Full invitation flow with role + permission assignment

---

## Step 1 — Prisma Schema Changes

### Files Modified

- `apps/api/prisma/schema.prisma`

### Changes

1. **Replace `Role` enum** — `ADMIN`/`EDITOR`/`VIEWER` → `OWNER`/`PUBLISHER`/`EDITOR`/`ANALYST`
2. **Add `MemberPermission` model** — fine-grained rights per membership
3. **Add `AuditLog` model** — immutable audit trail
4. **Extend `PostStatus` enum** — add `PENDING_REVIEW` and `APPROVED`
5. **Add approval fields to `Post` model** — `createdById`, `reviewedById`, `reviewedAt`, `reviewNote`
6. **Add `Permission` enum** — all fine-grained permission keys
7. **Add `AuditAction` enum** — all audit action types

### Migration Strategy

- Existing `ADMIN` memberships → `OWNER`
- Existing `EDITOR` memberships → `EDITOR`
- Existing `VIEWER` memberships → `ANALYST`
- Seed default permissions for each migrated membership

---

## Step 2 — Backend RBAC (Roles, Permissions, Guards)

### Files Created

- `apps/api/src/auth/decorators/permissions.decorator.ts` — `@RequirePermissions()` decorator
- `apps/api/src/auth/guards/permissions.guard.ts` — `PermissionsGuard` implementation

### Files Modified

- `apps/api/src/auth/interfaces/auth.interface.ts` — add `role` and `permissions` to `JwtPayload`
- `apps/api/src/auth/strategies/jwt.strategy.ts` — load permissions from DB during validation
- `apps/api/src/auth/guards/roles.guard.ts` — update hierarchy to 4-role system
- `apps/api/src/auth/auth.service.ts` — use `OWNER` role on registration
- `apps/api/src/auth/auth.module.ts` — export guards

### Role Hierarchy

```
OWNER (4) → All permissions implicitly
PUBLISHER (3) → Can publish, approve, schedule
EDITOR (2) → Can create/edit content
ANALYST (1) → Read-only analytics
```

### Permission Keys

| Permission | Description | Default Roles |
|---|---|---|
| `CONNECT_TOKENS` | Connect/disconnect social accounts | OWNER |
| `PUBLISH_YOUTUBE` | Publish to YouTube | OWNER, PUBLISHER |
| `PUBLISH_FACEBOOK` | Publish to Facebook | OWNER, PUBLISHER |
| `PUBLISH_INSTAGRAM` | Publish to Instagram | OWNER, PUBLISHER |
| `PUBLISH_LINKEDIN` | Publish to LinkedIn | OWNER, PUBLISHER |
| `PUBLISH_TWITTER` | Publish to Twitter | OWNER, PUBLISHER |
| `PUBLISH_TIKTOK` | Publish to TikTok | OWNER, PUBLISHER |
| `PUBLISH_PINTEREST` | Publish to Pinterest | OWNER, PUBLISHER |
| `EDIT_CAPTIONS` | Edit post content/captions | OWNER, PUBLISHER, EDITOR |
| `SCHEDULE` | Schedule posts for future | OWNER, PUBLISHER |
| `MANAGE_MEMBERS` | Invite/remove/change member roles | OWNER |
| `VIEW_ANALYTICS` | View analytics dashboards | OWNER, PUBLISHER, EDITOR, ANALYST |
| `APPROVE_POSTS` | Approve/reject posts in review | OWNER, PUBLISHER |
| `MANAGE_CAMPAIGNS` | Create/edit ad campaigns | OWNER, PUBLISHER |

---

## Step 3 — Audit Logging System

### Files Created

- `apps/api/src/audit/audit.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/audit/audit.controller.ts`
- `apps/api/src/audit/dto/query-audit-logs.dto.ts`

### Audit Actions Tracked

| Action | When Logged | Metadata |
|---|---|---|
| `STORE_LINKED` | Social account connected via OAuth | Platform, account name |
| `STORE_UNLINKED` | Social account disconnected | Platform, account name |
| `DEFAULTS_CHANGED` | Tenant settings updated | Changed fields (before/after) |
| `POST_CREATED` | Post draft created | Post ID, platforms |
| `POST_PUBLISHED` | Post published to platform | API response, platform post ID, URL |
| `POST_SUBMITTED_FOR_REVIEW` | Post submitted for approval | Post ID |
| `POST_APPROVED` | Post approved by reviewer | Post ID, reviewer, note |
| `POST_REJECTED` | Post rejected by reviewer | Post ID, reviewer, note |
| `MEMBER_INVITED` | New member added to tenant | Email, role, permissions |
| `MEMBER_ROLE_CHANGED` | Member role updated | Old role → new role |
| `MEMBER_REMOVED` | Member removed from tenant | User ID |
| `MEMBER_PERMISSIONS_CHANGED` | Member permissions updated | Added/removed permissions |
| `TOKEN_CONNECTED` | OAuth token obtained | Platform |
| `POST_SCHEDULED` | Post scheduled for future | Post ID, scheduled time |

### API Endpoints

- `GET /audit-logs` — paginated, filterable audit logs (OWNER only)
  - Query params: `action`, `entityType`, `entityId`, `userId`, `from`, `to`, `limit`, `offset`

---

## Step 4 — Approval Workflow for Posts

### Workflow States

```
DRAFT → PENDING_REVIEW → APPROVED → SCHEDULED/PUBLISHING → PUBLISHED
                  ↓                                              ↓
              (rejected)                                      FAILED
                  ↓
               DRAFT (back to author for edits)
```

### Rules

- **EDITOR** can create drafts and submit for review
- **PUBLISHER/OWNER** can approve or reject posts in `PENDING_REVIEW` status
- **OWNER** can bypass the approval flow and publish directly from `DRAFT`
- Rejection sends the post back to `DRAFT` with a `reviewNote`
- Only `APPROVED` posts can be published (except by OWNER bypass)

### New API Endpoints

- `POST /posts/:id/submit-review` — Editor submits draft for review
- `POST /posts/:id/approve` — Publisher/Owner approves post
- `POST /posts/:id/reject` — Publisher/Owner rejects post

### Files Modified

- `apps/api/src/posts/posts.service.ts` — add `submitForReview()`, `approvePost()`, `rejectPost()`, update `publishNow()`
- `apps/api/src/posts/posts.controller.ts` — add new endpoints, update role guards
- `apps/api/src/posts/posts.module.ts` — import AuditModule

---

## Step 5 — Tenant & Member Management Updates

### Files Modified

- `apps/api/src/tenants/tenants.service.ts` — update to use new roles, add permission management
- `apps/api/src/tenants/tenants.controller.ts` — update `@Roles()` decorators, add permission endpoints
- `apps/api/src/tenants/dto/invite-member.dto.ts` — add `permissions` field
- `apps/api/src/tenants/dto/update-member-role.dto.ts` — add `permissions` field

### Files Created

- `apps/api/src/tenants/dto/update-member-permissions.dto.ts`

### Changes

- `inviteMember()` → accept `permissions[]`, seed default permissions for role
- `updateMemberRole()` → update permissions when role changes
- New `updateMemberPermissions()` → fine-grained permission update
- `getMembers()` → include permissions in response
- `removeMember()` → check for `OWNER` instead of `ADMIN`, log audit

---

## Step 6 — Shared Types Updates

### Files Modified

- `packages/shared/src/types/enums.ts` — update `Role`, `PostStatus`, add `Permission`, `AuditAction`
- `packages/shared/src/types/dto.ts` — add `AuditLogDto`, `PermissionDto`, update `TenantMembershipDto`, `PostDto`, `AuthResponseDto`

---

## Step 7 — Frontend Changes

### Files Created

- `apps/web/src/features/settings/MembersPage.tsx` — member management UI
- `apps/web/src/features/settings/AuditLogPage.tsx` — audit log viewer
- `apps/web/src/components/PermissionGate.tsx` — conditional rendering based on permissions

### Files Modified

- `apps/web/src/lib/store.ts` — add `role` and `permissions` to auth state
- `apps/web/src/lib/api.ts` — add audit log, approval, permission API methods
- `apps/web/src/App.tsx` — add settings routes
- `apps/web/src/layouts/DashboardLayout.tsx` — add Settings nav, permission-based nav hiding
- `apps/web/src/features/posts/PostsPage.tsx` — show approval status badges
- `apps/web/src/features/posts/CreatePostPage.tsx` — add submit for review button

---

## Implementation Order

1. ✅ Create this guide
2. ✅ Schema changes (Prisma) — new Role/Permission/AuditAction enums, MemberPermission/AuditLog models, Post approval fields
3. ✅ Backend RBAC guards & decorators — PermissionsGuard, @RequirePermissions(), updated RolesGuard hierarchy
4. ✅ Audit logging module — AuditService, AuditController, global module
5. ✅ Post approval workflow — submitForReview, approvePost, rejectPost, publishNow role checks
6. ✅ Tenant/member management — permission CRUD, role-based seeding, DEFAULT_PERMISSIONS
7. ✅ Shared types — Role, Permission, AuditAction enums, updated DTOs
8. ✅ Frontend store + API client — role/permissions in auth state, hasRole/hasPermission helpers
9. ✅ Frontend pages + components — MembersPage, AuditLogPage, SettingsLayout, PermissionGate, Select/Table UI components

### Remaining (when database is running)

- Run `npx prisma migrate dev --name add_rbac_audit_approval` to create the database migration
- Data migration script: convert existing ADMIN→OWNER, EDITOR→EDITOR, VIEWER→ANALYST memberships
- Seed default permissions for migrated memberships
