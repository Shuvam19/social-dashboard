# Listing Management — Implementation Plan

> **Created:** February 28, 2026  
> **Status:** Planning  
> **Goal:** Build a Listing Management system that allows uploading a master video once and distributing it to multiple social channels (YouTube, Instagram, Facebook, TikTok, Snapchat) with platform-specific derivations, captions, scheduling, and reliability.

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Gap Analysis Summary](#2-gap-analysis-summary)
3. [Implementation Phases](#3-implementation-phases)
4. [Phase 1 — Data Model & Listing CRUD](#phase-1--data-model--listing-crud)
5. [Phase 2 — Asset Intake & Video Processing](#phase-2--asset-intake--video-processing)
6. [Phase 3 — Auto-Derivations per Platform](#phase-3--auto-derivations-per-platform)
7. [Phase 4 — Captions, Subtitles & Templating](#phase-4--captions-subtitles--templating)
8. [Phase 5 — Scheduling & Publishing Pipeline](#phase-5--scheduling--publishing-pipeline)
9. [Phase 6 — Reliability & Resilience](#phase-6--reliability--resilience)
10. [Phase 7 — Post-Publish Enrichment & Analytics](#phase-7--post-publish-enrichment--analytics)
11. [Phase 8 — Bulk Operations](#phase-8--bulk-operations)
12. [Phase 9 — Governance & Content Policy](#phase-9--governance--content-policy)
13. [Phase 10 — Frontend (Listing UI)](#phase-10--frontend-listing-ui)
14. [Architecture Decisions](#architecture-decisions)
15. [File-by-File Inventory](#file-by-file-inventory)

---

## 1. Current State Audit

### What Exists Today

| Area | Status | Details |
|------|--------|---------|
| **Post CRUD** | ✅ Implemented | `PostsController` + `PostsService` — create, read, update, delete posts. A post is 1:1 with a `SocialAccount`. Creating for multiple accounts creates N separate `Post` rows in a transaction. |
| **Post Types** | ✅ Implemented | `PostType` enum: `TEXT`, `PHOTO`, `VIDEO`, `REEL` (added in migration `20260227205521_add_post_type`). |
| **Post Status Workflow** | ✅ Implemented | `PostStatus`: `DRAFT → PENDING_REVIEW → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED → FAILED`. |
| **Approval Workflow** | ✅ Implemented | `submit-review`, `approve`, `reject` endpoints with RBAC (`PUBLISHER` role + `APPROVE_POSTS` permission). Audit-logged. Review note and reviewer tracked. |
| **RBAC & Permissions** | ✅ Implemented | Roles: `OWNER`, `PUBLISHER`, `EDITOR`, `ANALYST`. Permissions include `PUBLISH_YOUTUBE`, `PUBLISH_TIKTOK`, `EDIT_CAPTIONS`, `SCHEDULE`, `APPROVE_POSTS`, etc. Guards: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`. |
| **Audit Logging** | ✅ Implemented | `AuditService` + `AuditLog` model. Logs post create, update, publish, review, and member actions. |
| **S3 Uploads** | ✅ Partial | `UploadsController` generates presigned PUT URLs via `S3Service`. Client uploads directly to LocalStack/S3. **Single file only, no chunked/multipart/resumable.** No server-side processing. |
| **Platform: Meta (Facebook/Instagram)** | ✅ Implemented | `MetaClient` supports: text post, single photo, multi-photo, video (via `file_url`), and Facebook Reels (3-step: init → transfer → finish). OAuth with long-lived token exchange. |
| **Platform: Twitter** | ✅ Implemented | `TwitterClient` — OAuth + publish (text). |
| **Platform: LinkedIn** | ✅ Implemented | `LinkedInClient` — OAuth + publish. |
| **Platform: Pinterest** | ✅ Implemented | `PinterestClient` — OAuth + publish. |
| **Platform: TikTok** | ⚠️ Partial | `TikTokClient` — OAuth working. **`publishPost()` is a stub** that throws `"TikTok requires video content."` |
| **Platform: YouTube** | ❌ Missing | No YouTube client, no `YOUTUBE` in `Platform` enum. `PUBLISH_YOUTUBE` permission exists in schema but is unused. |
| **Platform: Snapchat** | ❌ Missing | Not mentioned anywhere in codebase. |
| **Scheduling** | ⚠️ Partial | Posts can be set to `SCHEDULED` status with `scheduledAt` timestamp. **No cron job or worker exists to pick up and publish scheduled posts.** It's write-only metadata. |
| **Publishing** | ⚠️ Partial | `PostsService.publishNow()` — synchronous in-request publishing. No background queue, no retries, no idempotency. |
| **BullMQ Infrastructure** | ✅ Implemented | `BullConfigModule` with Redis. Queues: `webhook-ingest` (5 concurrency, rate limited), `metrics-fetch` (3 concurrency). Exponential backoff, job retention configured. |
| **Webhook Ingestion** | ✅ Implemented | Handles Meta/Twitter/LinkedIn/TikTok/Pinterest webhooks. Processes **interactions only** (comments, DMs, mentions). **No post-publish status webhooks.** |
| **Analytics** | ⚠️ Partial | `AnalyticsService` + `MetricsCronService` — fetches **ad campaign metrics only** (Meta Ads API). No organic post metrics. `CampaignMetric` + `AdMetric` models. |
| **Frontend: Post Creation** | ✅ Implemented | `CreatePostPage.tsx` (1116 lines): account selection, drag-drop media upload to S3, reel toggles (IG/FB), scheduling datetime picker, character counter per platform, live previews (Facebook, Instagram, LinkedIn, Twitter, TikTok). |
| **Frontend: Posts List** | ✅ Implemented | `PostsPage.tsx`: list posts with status badges, publish/delete actions, boost post dialog. |
| **Frontend: Routes** | ✅ Implemented | `/posts`, `/posts/create`, `/posts/:id/edit`. **No listing routes, no calendar view, no bulk operations UI.** |
| **Docker Infrastructure** | ✅ Implemented | PostgreSQL 16, Redis 7, Redis Commander, LocalStack (S3). |
| **Shared Package** | ✅ Implemented | `@social-dashboard/shared` with TypeScript enums and DTOs. |

### What Does NOT Exist

| Area | Status |
|------|--------|
| `Listing` data model / concept | ❌ Not implemented |
| `MediaAsset` model (duration, fps, dimensions, codecs) | ❌ Not implemented |
| FFmpeg / video processing | ❌ Not implemented (no dependency installed) |
| Mezzanine normalization pipeline | ❌ Not implemented |
| Multi-audio tracks / SRT/VTT support | ❌ Not implemented |
| Smart crop / face detection | ❌ Not implemented |
| Aspect ratio derivations (9:16, 1:1, 16:9) | ❌ Not implemented |
| Auto-trim / segment for duration limits | ❌ Not implemented |
| Thumbnail generation / frame picker | ❌ Not implemented |
| Caption/SRT generation from transcript | ❌ Not implemented |
| Caption templating with variables (`{title}`, `{episode}`, etc.) | ❌ Not implemented |
| Platform-aware caption rules (IG link removal, hashtag limits) | ❌ Not implemented |
| Scheduler cron (publish scheduled posts) | ❌ Not implemented |
| YouTube client & OAuth | ❌ Not implemented |
| Snapchat client & handoff flow | ❌ Not implemented |
| TikTok video publishing | ❌ Stub only |
| Instagram Reels publishing (only Facebook Reels exist) | ❌ Not implemented |
| Idempotency keys on publish | ❌ Not implemented |
| Chunked/resumable uploads | ❌ Not implemented |
| Retry matrix (network vs policy vs quota) | ❌ Not implemented |
| Post-publish status webhooks/polling | ❌ Not implemented |
| Organic post analytics ingestion | ❌ Not implemented |
| Bulk create / duplicate / schedule | ❌ Not implemented |
| Calendar view | ❌ Not implemented |
| Content policy checks / pre-publish validation | ❌ Not implemented |
| Listings frontend pages | ❌ Not implemented |

---

## 2. Gap Analysis Summary

```
Feature Area               Existing  Needed   Gap
─────────────────────────── ──────── ──────── ─────
Data Model (Listing)           0%     100%    100%
Asset Intake (FFmpeg)          0%     100%    100%
Auto-Derivations               0%     100%    100%
Captions/Subtitles             0%     100%    100%
Scheduling & Publishing       20%     100%     80%
Reliability                    5%     100%     95%
Post-Publish Enrichment       10%     100%     90%
Bulk Operations                0%     100%    100%
Governance                    40%     100%     60%
Frontend (Listings)            0%     100%    100%
```

---

## 3. Implementation Phases

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
 Data Model   Asset      Auto-      Captions
 & CRUD      Intake    Derivations  & SRT

Phase 5 ──► Phase 6 ──► Phase 7
Scheduling  Reliability  Post-Publish
& Publish               Enrichment

Phase 8 ──► Phase 9 ──► Phase 10
  Bulk      Governance   Frontend
  Ops
```

---

## Phase 1 — Data Model & Listing CRUD

### Objective
Create the `Listing` concept — one master video uploaded once, targeting multiple channels.

### Tasks

- [ ] **1.1** Add Prisma models:
  - `Listing` — master record (tenantId, title, description, status, createdById, reviewedById, etc.)
  - `MediaAsset` — source file metadata (s3Key, fileName, contentType, fileSize, duration, width, height, fps, codec, audioCodec, bitrate, thumbnailUrl, mezzanineS3Key, processingStatus)
  - `ListingTarget` — one per platform/account (listingId, socialAccountId, platform, status, caption, scheduledAt, publishedAt, platformPostId, platformPostUrl, idempotencyKey, errorMessage)
  - `ListingDerivation` — per-platform rendition (listingTargetId, aspectRatio, s3Key, width, height, duration, fileSize, processingStatus)
  - `ListingCaption` — SRT/VTT per listing or per target (listingId, listingTargetId, language, format, s3Key, content)

- [ ] **1.2** Add `YOUTUBE` and `SNAPCHAT` to the `Platform` enum in `schema.prisma` and `packages/shared/src/types/enums.ts`.

- [ ] **1.3** Add `ListingStatus` enum: `DRAFT`, `PROCESSING`, `PENDING_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `PARTIALLY_PUBLISHED`, `FAILED`.

- [ ] **1.4** Add new `AuditAction` values: `LISTING_CREATED`, `LISTING_UPDATED`, `LISTING_PUBLISHED`, `LISTING_SUBMITTED_FOR_REVIEW`, `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_DELETED`.

- [ ] **1.5** Create Prisma migration.

- [ ] **1.6** Create NestJS module: `apps/api/src/listings/`
  - `listings.module.ts`
  - `listings.controller.ts` — CRUD endpoints: `POST /listings`, `GET /listings`, `GET /listings/:id`, `PATCH /listings/:id`, `DELETE /listings/:id`
  - `listings.service.ts` — business logic
  - `dto/create-listing.dto.ts`
  - `dto/update-listing.dto.ts`

- [ ] **1.7** Register `ListingsModule` in `app.module.ts`.

- [ ] **1.8** Add shared DTOs in `packages/shared/src/types/dto.ts`.

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Modify — add Listing, MediaAsset, ListingTarget, ListingDerivation, ListingCaption models |
| `packages/shared/src/types/enums.ts` | Modify — add YOUTUBE, SNAPCHAT, ListingStatus, new AuditActions |
| `packages/shared/src/types/dto.ts` | Modify — add Listing DTOs |
| `apps/api/src/listings/listings.module.ts` | Create |
| `apps/api/src/listings/listings.controller.ts` | Create |
| `apps/api/src/listings/listings.service.ts` | Create |
| `apps/api/src/listings/dto/create-listing.dto.ts` | Create |
| `apps/api/src/listings/dto/update-listing.dto.ts` | Create |
| `apps/api/src/app.module.ts` | Modify — import ListingsModule |

---

## Phase 2 — Asset Intake & Video Processing

### Objective
Upload master file(s), extract media info (duration, fps, dimensions, codecs), and run FFmpeg normalization to a mezzanine format.

### Tasks

- [ ] **2.1** Install dependencies:
  - `fluent-ffmpeg` — FFmpeg wrapper for Node.js
  - `@ffprobe-installer/ffprobe` — bundled ffprobe binary
  - `@ffmpeg-installer/ffmpeg` — bundled ffmpeg binary (dev/CI; production should use system FFmpeg or AWS MediaConvert)

- [ ] **2.2** Create `MediaProcessingService`:
  - `extractMediaInfo(s3Key)` — download from S3, run ffprobe, return `{duration, width, height, fps, codec, audioCodec, bitrate}`
  - `normalizeMezzanine(s3Key)` — transcode to H.264/AAC high-bitrate mezzanine, upload back to S3
  - `generateThumbnail(s3Key, timestampSeconds)` — extract frame, upload as JPEG to S3

- [ ] **2.3** Create BullMQ queue `media-processing` with processor:
  - Job types: `extract-info`, `normalize`, `generate-thumbnail`
  - Update `MediaAsset.processingStatus` as jobs progress (`PENDING → PROCESSING → COMPLETED → FAILED`)

- [ ] **2.4** Enhance `UploadsController` or create `ListingUploadsController`:
  - Endpoint to initiate multipart upload (for large files)
  - Endpoint to complete multipart upload
  - On upload completion, auto-enqueue `extract-info` job

- [ ] **2.5** Support multi-audio tracks:
  - Store audio track metadata in `MediaAsset.metadata` JSON
  - Allow selecting which audio track to use per platform derivation

- [ ] **2.6** Support SRT/VTT upload:
  - Upload subtitle files to S3
  - Create `ListingCaption` records linking to the listing

- [ ] **2.7** Add FFmpeg to Docker setup:
  - Add `ffmpeg` to API container in `docker-compose.yml` or use a sidecar
  - For production, consider AWS MediaConvert integration

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/package.json` | Modify — add fluent-ffmpeg, ffprobe-installer, ffmpeg-installer |
| `apps/api/src/media/media-processing.service.ts` | Create |
| `apps/api/src/media/media-processing.processor.ts` | Create |
| `apps/api/src/media/media.module.ts` | Create |
| `apps/api/src/uploads/uploads.controller.ts` | Modify — add multipart upload endpoints |
| `apps/api/src/config/s3.service.ts` | Modify — add multipart upload support (CreateMultipartUpload, UploadPart, CompleteMultipartUpload) |
| `docker/docker-compose.yml` | Modify — add FFmpeg to API container |
| `apps/api/src/app.module.ts` | Modify — import MediaModule |

---

## Phase 3 — Auto-Derivations per Platform

### Objective
Generate platform-specific renditions (aspect ratios, durations, covers/thumbnails) from the mezzanine.

### Tasks

- [ ] **3.1** Define platform derivation configs:
  ```
  YouTube:   16:9, max 12h, custom thumbnail
  IG Reels:  9:16, max 90s (or 15min for some accounts)
  IG Feed:   1:1 or 4:5, max 60s
  FB Reels:  9:16, max 90s
  FB Feed:   16:9 or 1:1, max 240min
  TikTok:    9:16, max 10min
  Shorts:    9:16, max 60s
  Snapchat:  9:16, max 60s (Spotlight) or 10s (Stories)
  ```

- [ ] **3.2** Implement smart crop strategies:
  - Center crop (default)
  - Face/subject detection using `sharp` (for thumbnails) or FFmpeg `cropdetect`/`drawbox`
  - Letterbox/pillarbox fallback

- [ ] **3.3** Create `DerivationService`:
  - `generateDerivation(mezzanineS3Key, targetAspectRatio, maxDuration, options)` — crop/resize + duration trim + re-encode
  - Auto-segment into series if content exceeds platform cap (e.g., 60s for Shorts → split into parts)
  - Flag warnings if content is too long

- [ ] **3.4** Create BullMQ job types in `media-processing` queue:
  - `generate-derivation` — produce one rendition
  - `generate-all-derivations` — fan out to per-platform jobs

- [ ] **3.5** Thumbnail/cover management:
  - YouTube: allow custom thumbnail upload (store in `ListingTarget.metadata`)
  - IG/FB/TikTok: frame picker UI (timestamp → `generateThumbnail`)
  - Preview what platform will auto-choose if no cover set

- [ ] **3.6** Duration validation:
  - On listing target creation, compare mezzanine duration vs. platform max
  - Auto-flag and suggest trim points
  - Offer manual trim (start/end timestamps)

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/media/derivation.service.ts` | Create |
| `apps/api/src/media/platform-specs.ts` | Create — platform config constants |
| `apps/api/src/media/media-processing.processor.ts` | Modify — add derivation job types |
| `apps/api/src/listings/listings.service.ts` | Modify — trigger derivation generation |

---

## Phase 4 — Captions, Subtitles & Templating

### Objective
Generate SRT from transcript, support caption templating with per-platform variable substitution, and enforce platform-specific rules.

### Tasks

- [ ] **4.1** Transcript generation:
  - Option A: Integrate OpenAI Whisper API for speech-to-text
  - Option B: Integrate AWS Transcribe
  - Option C: Accept user-uploaded SRT/VTT
  - Store transcript in `ListingCaption` with `format: 'SRT' | 'VTT' | 'TXT'`

- [ ] **4.2** Create `CaptionTemplateService`:
  - Master caption template with tokens: `{title}`, `{episode}`, `{cta}`, `{link}`, `{hashtags}`
  - Per-platform override capability stored in `ListingTarget.caption`
  - Variable resolution at publish time

- [ ] **4.3** Platform-aware caption rules:
  - **Instagram:** Auto-remove external links → replace with "Link in bio" text. Max 2200 chars. Max 30 hashtags.
  - **Twitter/X:** Max 280 chars. Auto-shorten links.
  - **TikTok:** Max 2200 chars. Hashtags in caption.
  - **YouTube:** Title (100 chars) + Description (5000 chars) separate fields.
  - **Facebook:** Max 63,206 chars.
  - **LinkedIn:** Max 3000 chars.
  - **Snapchat:** Limited caption support.

- [ ] **4.4** Live character counter per platform (frontend).

- [ ] **4.5** Caption editor UI:
  - SRT timeline editor (adjust timestamps)
  - Preview captions over video
  - Upload to YouTube as caption track via YouTube Data API

- [ ] **4.6** Create `CaptionTemplate` Prisma model:
  - `id`, `tenantId`, `name`, `template` (text with tokens), `platformOverrides` (JSON: platform → override text), `createdAt`

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/captions/captions.module.ts` | Create |
| `apps/api/src/captions/captions.controller.ts` | Create |
| `apps/api/src/captions/captions.service.ts` | Create |
| `apps/api/src/captions/caption-template.service.ts` | Create |
| `apps/api/src/captions/platform-rules.ts` | Create — per-platform text processing rules |
| `apps/api/prisma/schema.prisma` | Modify — add CaptionTemplate model |
| `apps/api/src/app.module.ts` | Modify — import CaptionsModule |

---

## Phase 5 — Scheduling & Publishing Pipeline

### Objective
Implement reliable per-platform scheduling with local timezone support and background publishing.

### Tasks

- [ ] **5.1** Create `SchedulerCronService`:
  - Cron job running every minute
  - Query: `ListingTarget WHERE status = 'SCHEDULED' AND scheduledAt <= now()`
  - Enqueue `publish` BullMQ job for each target
  - Update status to `PUBLISHING`

- [ ] **5.2** Also backfill for existing `Post` model:
  - Query: `Post WHERE status = 'SCHEDULED' AND scheduledAt <= now()`
  - This fixes the existing gap where scheduled posts are never published

- [ ] **5.3** Create `publish` BullMQ queue + `PublishProcessor`:
  - Per-platform publish logic
  - On success: update `platformPostId`, `platformPostUrl`, `publishedAt`, status → `PUBLISHED`
  - On failure: update `errorMessage`, status → `FAILED`

- [ ] **5.4** Implement YouTube client (`apps/api/src/social-accounts/clients/youtube.client.ts`):
  - OAuth2 via Google APIs (`googleapis` npm package)
  - Scopes: `youtube.upload`, `youtube.readonly`, `youtube.force-ssl`
  - `publishPost()` — upload video via YouTube Data API v3 resumable upload
  - Set `status.privacyStatus` to `private` + `status.publishAt` for scheduling
  - Upload captions/subtitles via `captions.insert`
  - Custom thumbnail via `thumbnails.set`

- [ ] **5.5** Implement TikTok video publishing (fix stub):
  - TikTok Content Posting API v2
  - `POST /v2/post/publish/video/init/` → get `upload_url`
  - Upload video to `upload_url`
  - `POST /v2/post/publish/status/fetch/` to poll status
  - Handle "Direct Post" vs "Draft" modes based on app approval

- [ ] **5.6** Implement Instagram Reels publishing:
  - Via `MetaClient`: IG Content Publishing API
  - `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url`, `caption`
  - `POST /{ig-user-id}/media_publish` with `creation_id`
  - Poll `GET /{ig-container-id}?fields=status_code` until `FINISHED`

- [ ] **5.7** Implement Facebook Reels chunked upload (already partially done):
  - Current implementation uses `file_url`. Add support for chunked upload via Meta Video API session-based protocol.

- [ ] **5.8** Implement Snapchat handoff flow:
  - Option A: Web Uploader deep-link (`https://story.snapchat.com/`)
  - Option B: Creative Kit share (requires Snap Kit SDK)
  - Store handoff URL in `ListingTarget`, mark status as `PENDING_USER_ACTION`

- [ ] **5.9** Register `YOUTUBE` and `SNAPCHAT` in `PlatformClientFactory`.

- [ ] **5.10** Per-target timezone support:
  - Store timezone in `ListingTarget` (e.g., `America/New_York`)
  - Convert `scheduledAt` to UTC for storage, display in local tz

- [ ] **5.11** "Best time" suggestions:
  - Platform-specific optimal posting windows (configurable per tenant)
  - Display suggestions in scheduling UI

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/scheduler/scheduler.module.ts` | Create |
| `apps/api/src/scheduler/scheduler-cron.service.ts` | Create |
| `apps/api/src/scheduler/publish.processor.ts` | Create |
| `apps/api/src/social-accounts/clients/youtube.client.ts` | Create |
| `apps/api/src/social-accounts/clients/snapchat.client.ts` | Create |
| `apps/api/src/social-accounts/clients/tiktok.client.ts` | Modify — implement `publishPost()` |
| `apps/api/src/social-accounts/clients/meta.client.ts` | Modify — add IG Reels, chunked upload |
| `apps/api/src/social-accounts/clients/platform-client.factory.ts` | Modify — add YOUTUBE, SNAPCHAT cases |
| `apps/api/src/social-accounts/clients/platform-client.interface.ts` | Modify — add optional methods for resumable upload, caption upload, thumbnail upload |
| `apps/api/package.json` | Modify — add `googleapis` for YouTube |
| `apps/api/src/app.module.ts` | Modify — import SchedulerModule |

---

## Phase 6 — Reliability & Resilience

### Objective
Ensure publish operations are idempotent, retryable, and observable.

### Tasks

- [ ] **6.1** Idempotency keys:
  - Generate UUID `idempotencyKey` on `ListingTarget` creation
  - Pass to platform APIs where supported (YouTube, Meta)
  - Check for duplicate before publishing (prevent double-publish on retry)

- [ ] **6.2** Chunked/resumable uploads:
  - **YouTube:** Use resumable upload protocol (already supported by YouTube Data API)
  - **Meta Video API:** Session-based chunked upload for videos > 1GB
  - **S3:** Implement multipart upload in `S3Service` (CreateMultipartUpload → UploadPart → CompleteMultipartUpload)

- [ ] **6.3** Retry matrix:
  - Classify errors:
    - `RETRYABLE_NETWORK` — timeout, connection reset → retry with exponential backoff
    - `RETRYABLE_RATE_LIMIT` — 429 → retry after `Retry-After` header
    - `RETRYABLE_SERVER` — 500/502/503 → retry with backoff
    - `NON_RETRYABLE_POLICY` — content policy violation → fail permanently
    - `NON_RETRYABLE_AUTH` — 401/403 → fail, flag for token refresh
    - `NON_RETRYABLE_QUOTA` — daily quota exceeded → fail, schedule for next day
  - Implement in `PublishProcessor` with BullMQ's `backoff` + custom `shouldRetry` logic

- [ ] **6.4** Post-publish status webhooks:
  - **Meta:** Register webhook for `feed` topic to receive video processing status
  - **YouTube:** Poll `videos.list` with `id` to check `status.uploadStatus`
  - **TikTok:** Poll `POST /v2/post/publish/status/fetch/`
  - Create `publish-status-poll` BullMQ queue for platforms without webhooks

- [ ] **6.5** Health monitoring:
  - Dashboard showing publish queue depth, failure rates, retry counts
  - Alert on stuck jobs (publishing > 30 min)

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/scheduler/publish.processor.ts` | Modify — add retry matrix, idempotency |
| `apps/api/src/scheduler/publish-status.processor.ts` | Create — poll for publish status |
| `apps/api/src/scheduler/retry-classifier.ts` | Create — error classification logic |
| `apps/api/src/config/s3.service.ts` | Modify — add multipart upload methods |
| `apps/api/src/webhooks/webhook-ingest.processor.ts` | Modify — handle publish status events |
| `apps/api/src/social-accounts/clients/meta.client.ts` | Modify — add chunked video upload |
| `apps/api/src/social-accounts/clients/youtube.client.ts` | Modify — resumable upload |

---

## Phase 7 — Post-Publish Enrichment & Analytics

### Objective
After publishing, collect platform IDs/URLs, thumbnails, moderation flags, and organic engagement metrics.

### Tasks

- [ ] **7.1** Post-publish enrichment job:
  - After status → `PUBLISHED`, enqueue `post-publish-enrichment` job (delayed 5 min)
  - Fetch final video URL, thumbnail URL, view count, moderation status
  - Store in `ListingTarget` metadata

- [ ] **7.2** Organic post analytics ingestion:
  - Create `PostMetric` Prisma model: `{postId/listingTargetId, date, views, likes, comments, shares, retention, watchTime}`
  - Create `organic-metrics-fetch` BullMQ queue
  - Cron job to fetch daily metrics for all published posts
  - Platform API calls:
    - **YouTube:** `youtube.videos.list` with `statistics` part
    - **Meta:** `/{post-id}/insights` with `post_impressions`, `post_engaged_users`
    - **TikTok:** `GET /v2/video/query/` for video stats
    - **LinkedIn:** `GET /socialActions/{ugcPostUrn}`

- [ ] **7.3** Versioned API mappers:
  - Meta changes Insights fields frequently
  - Create `MetaInsightsMapper_v18`, `MetaInsightsMapper_v19`, etc.
  - Select mapper based on API version

- [ ] **7.4** Store server-side moderation flags:
  - YouTube: `status.rejectionReason`, `contentDetails.contentRating`
  - Meta: `is_eligible_for_promotion`, `status` field on videos
  - Surface in listings UI

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Modify — add PostMetric model |
| `apps/api/src/analytics/organic-metrics.service.ts` | Create |
| `apps/api/src/analytics/organic-metrics-cron.service.ts` | Create |
| `apps/api/src/analytics/organic-metrics-fetch.processor.ts` | Create |
| `apps/api/src/analytics/mappers/meta-insights.mapper.ts` | Create |
| `apps/api/src/analytics/mappers/youtube-insights.mapper.ts` | Create |
| `apps/api/src/scheduler/post-publish-enrichment.processor.ts` | Create |
| `apps/api/src/analytics/analytics.module.ts` | Modify — register new services |

---

## Phase 8 — Bulk Operations

### Objective
Duplicate a listing to many stores with overrides, and provide a bulk schedule calendar.

### Tasks

- [ ] **8.1** Bulk create / duplicate:
  - `POST /listings/:id/duplicate` — clone listing to specified social accounts with optional overrides (caption, scheduledAt)
  - `POST /listings/bulk-create` — create one listing targeting N accounts at once (already somewhat supported by multi-account post creation pattern)

- [ ] **8.2** Store/account selector:
  - UI component to select which stores/accounts to include
  - "Select all" / filter by platform

- [ ] **8.3** Bulk schedule:
  - `POST /listings/bulk-schedule` — set `scheduledAt` for multiple listing targets
  - Conflict detection: warn if another listing is scheduled within a configurable window for the same account

- [ ] **8.4** Calendar view:
  - Monthly/weekly/daily calendar showing all scheduled listings
  - Drag-and-drop rescheduling
  - Color-coded by platform
  - Quota window indicators (e.g., TikTok daily post limit)
  - Team approval status overlay

- [ ] **8.5** Bulk status management:
  - `POST /listings/bulk-action` — approve, reject, publish, delete multiple listings

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/listings/listings.controller.ts` | Modify — add bulk endpoints |
| `apps/api/src/listings/listings.service.ts` | Modify — add bulk operations |
| `apps/api/src/listings/dto/bulk-create.dto.ts` | Create |
| `apps/api/src/listings/dto/bulk-schedule.dto.ts` | Create |
| `apps/web/src/features/listings/CalendarPage.tsx` | Create |

---

## Phase 9 — Governance & Content Policy

### Objective
Enforce approval workflows and content policy checks before publishing.

### Tasks

- [ ] **9.1** Listing approval workflow:
  - Reuse existing `submit-review → approve → reject` pattern from `PostsController`
  - Apply at `Listing` level (all targets inherit approval)
  - `POST /listings/:id/submit-review`
  - `POST /listings/:id/approve`
  - `POST /listings/:id/reject`

- [ ] **9.2** Content policy pre-checks:
  - Create `ContentPolicyService`:
    - Check for prohibited words/phrases (configurable per tenant)
    - Check video content against platform community guidelines (manual flag or automated)
    - Check media dimensions/duration/codec compatibility per target platform
    - Check caption length per platform
    - Return `{ passed: boolean, violations: PolicyViolation[] }`
  - Block "Publish" button until all checks pass

- [ ] **9.3** Platform-specific pre-publish validation:
  - YouTube: require title, ensure video < 12h
  - Instagram: ensure Reel ≤ 90s, aspect ratio 9:16
  - TikTok: ensure video ≤ 10min, has video content
  - Facebook: check page permissions

- [ ] **9.4** Audit trail:
  - Log all approval/rejection actions with reviewer ID, notes, timestamp
  - Log content policy check results

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/api/src/listings/listing-approval.service.ts` | Create |
| `apps/api/src/listings/content-policy.service.ts` | Create |
| `apps/api/src/listings/platform-validator.ts` | Create |
| `apps/api/src/listings/listings.controller.ts` | Modify — add approval & policy check endpoints |

---

## Phase 10 — Frontend (Listing UI)

### Objective
Build the complete frontend experience for listing management.

### Tasks

- [ ] **10.1** Listings list page (`/listings`):
  - Table/grid view with status, platform icons, scheduled date, approval status
  - Filters: status, platform, date range
  - Bulk action toolbar

- [ ] **10.2** Create/edit listing page (`/listings/create`, `/listings/:id/edit`):
  - Step 1: Upload video (drag-drop, progress bar, resumable)
  - Step 2: Media info display (duration, resolution, fps, codecs)
  - Step 3: Select target accounts/platforms
  - Step 4: Per-platform preview with derivation (aspect ratio, duration trim)
  - Step 5: Caption editor with template variables and per-platform overrides
  - Step 6: Thumbnail/cover selection (frame picker, custom upload for YouTube)
  - Step 7: Schedule or publish immediately

- [ ] **10.3** Calendar page (`/listings/calendar`):
  - Install `@fullcalendar/react` (or similar)
  - Monthly/weekly/daily views
  - Drag-drop scheduling
  - Conflict indicators

- [ ] **10.4** Listing detail page (`/listings/:id`):
  - Overview with media player
  - Per-platform target status cards
  - Post-publish metrics (views, likes, comments)
  - Approval workflow UI (submit, approve, reject buttons)

- [ ] **10.5** Bulk operations UI:
  - Multi-select listings
  - Bulk schedule dialog
  - Bulk approve/reject
  - Duplicate to accounts dialog

- [ ] **10.6** Caption template manager (`/settings/caption-templates`):
  - CRUD for caption templates
  - Variable insertion toolbar
  - Platform preview

- [ ] **10.7** Update navigation:
  - Add "Listings" to sidebar
  - Add "Calendar" to sidebar

- [ ] **10.8** Frontend API client:
  - Add `listingsApi` to `apps/web/src/lib/api.ts`

### Files to Create/Modify
| File | Action |
|------|--------|
| `apps/web/src/features/listings/ListingsPage.tsx` | Create |
| `apps/web/src/features/listings/CreateListingPage.tsx` | Create |
| `apps/web/src/features/listings/ListingDetailPage.tsx` | Create |
| `apps/web/src/features/listings/CalendarPage.tsx` | Create |
| `apps/web/src/features/listings/components/VideoUploader.tsx` | Create |
| `apps/web/src/features/listings/components/PlatformPreview.tsx` | Create |
| `apps/web/src/features/listings/components/CaptionEditor.tsx` | Create |
| `apps/web/src/features/listings/components/ThumbnailPicker.tsx` | Create |
| `apps/web/src/features/listings/components/AccountSelector.tsx` | Create |
| `apps/web/src/features/listings/components/DerivationPreview.tsx` | Create |
| `apps/web/src/features/settings/CaptionTemplatesPage.tsx` | Create |
| `apps/web/src/lib/api.ts` | Modify — add listingsApi |
| `apps/web/src/App.tsx` | Modify — add listing routes |
| `apps/web/src/layouts/DashboardLayout.tsx` | Modify — add sidebar nav items |
| `apps/web/package.json` | Modify — add @fullcalendar/react, video player lib |

---

## Architecture Decisions

### AD-1: Listing vs. Post Relationship
**Decision:** `Listing` creates child `Post` records per platform target.
**Rationale:** The existing `Post` model is well-integrated (webhooks, interactions, campaigns, ads). A `ListingTarget` will create a `Post` when published. This avoids duplicating all post-related features.

### AD-2: FFmpeg Execution Environment
**Decision:** Docker sidecar for dev/staging; AWS MediaConvert for production.
**Rationale:** FFmpeg in the API process is risky (memory, CPU). MediaConvert scales independently and handles codec licensing.

### AD-3: YouTube First, Snapchat Second
**Decision:** Implement YouTube before Snapchat.
**Rationale:** YouTube has the most feature-rich API (scheduling, thumbnails, captions) and higher demand. Snapchat is a handoff flow with limited API control.

### AD-4: Transcript Generation
**Decision:** Start with user-uploaded SRT/VTT. Add Whisper API integration as a follow-up.
**Rationale:** SRT upload covers the immediate need without external API costs. Whisper can be added behind a feature flag.

---

## File-by-File Inventory

### Existing Files That Will Be Modified

| File | Phase | Changes |
|------|-------|---------|
| `apps/api/prisma/schema.prisma` | 1, 4, 7 | Add Listing models, CaptionTemplate, PostMetric |
| `apps/api/src/app.module.ts` | 1, 2, 4, 5 | Import new modules |
| `apps/api/package.json` | 2, 5 | Add fluent-ffmpeg, googleapis, etc. |
| `apps/api/src/config/s3.service.ts` | 2, 6 | Add multipart upload |
| `apps/api/src/uploads/uploads.controller.ts` | 2 | Add multipart upload endpoints |
| `apps/api/src/social-accounts/clients/tiktok.client.ts` | 5 | Implement publishPost() |
| `apps/api/src/social-accounts/clients/meta.client.ts` | 5 | Add IG Reels, chunked upload |
| `apps/api/src/social-accounts/clients/platform-client.factory.ts` | 5 | Add YOUTUBE, SNAPCHAT |
| `apps/api/src/social-accounts/clients/platform-client.interface.ts` | 5 | Extended interface |
| `apps/api/src/webhooks/webhook-ingest.processor.ts` | 6 | Handle publish status events |
| `apps/api/src/analytics/analytics.module.ts` | 7 | Register organic metrics services |
| `packages/shared/src/types/enums.ts` | 1 | Add YOUTUBE, SNAPCHAT, ListingStatus |
| `packages/shared/src/types/dto.ts` | 1 | Add Listing DTOs |
| `apps/web/src/lib/api.ts` | 10 | Add listingsApi |
| `apps/web/src/App.tsx` | 10 | Add listing routes |
| `apps/web/src/layouts/DashboardLayout.tsx` | 10 | Add sidebar items |
| `apps/web/package.json` | 10 | Add calendar, video player deps |
| `docker/docker-compose.yml` | 2 | Add FFmpeg |

### New Files to Create

| File | Phase |
|------|-------|
| `apps/api/src/listings/listings.module.ts` | 1 |
| `apps/api/src/listings/listings.controller.ts` | 1 |
| `apps/api/src/listings/listings.service.ts` | 1 |
| `apps/api/src/listings/dto/create-listing.dto.ts` | 1 |
| `apps/api/src/listings/dto/update-listing.dto.ts` | 1 |
| `apps/api/src/listings/dto/bulk-create.dto.ts` | 8 |
| `apps/api/src/listings/dto/bulk-schedule.dto.ts` | 8 |
| `apps/api/src/listings/listing-approval.service.ts` | 9 |
| `apps/api/src/listings/content-policy.service.ts` | 9 |
| `apps/api/src/listings/platform-validator.ts` | 9 |
| `apps/api/src/media/media.module.ts` | 2 |
| `apps/api/src/media/media-processing.service.ts` | 2 |
| `apps/api/src/media/media-processing.processor.ts` | 2 |
| `apps/api/src/media/derivation.service.ts` | 3 |
| `apps/api/src/media/platform-specs.ts` | 3 |
| `apps/api/src/captions/captions.module.ts` | 4 |
| `apps/api/src/captions/captions.controller.ts` | 4 |
| `apps/api/src/captions/captions.service.ts` | 4 |
| `apps/api/src/captions/caption-template.service.ts` | 4 |
| `apps/api/src/captions/platform-rules.ts` | 4 |
| `apps/api/src/scheduler/scheduler.module.ts` | 5 |
| `apps/api/src/scheduler/scheduler-cron.service.ts` | 5 |
| `apps/api/src/scheduler/publish.processor.ts` | 5 |
| `apps/api/src/scheduler/publish-status.processor.ts` | 6 |
| `apps/api/src/scheduler/retry-classifier.ts` | 6 |
| `apps/api/src/social-accounts/clients/youtube.client.ts` | 5 |
| `apps/api/src/social-accounts/clients/snapchat.client.ts` | 5 |
| `apps/api/src/analytics/organic-metrics.service.ts` | 7 |
| `apps/api/src/analytics/organic-metrics-cron.service.ts` | 7 |
| `apps/api/src/analytics/organic-metrics-fetch.processor.ts` | 7 |
| `apps/api/src/analytics/mappers/meta-insights.mapper.ts` | 7 |
| `apps/api/src/analytics/mappers/youtube-insights.mapper.ts` | 7 |
| `apps/api/src/scheduler/post-publish-enrichment.processor.ts` | 7 |
| `apps/web/src/features/listings/ListingsPage.tsx` | 10 |
| `apps/web/src/features/listings/CreateListingPage.tsx` | 10 |
| `apps/web/src/features/listings/ListingDetailPage.tsx` | 10 |
| `apps/web/src/features/listings/CalendarPage.tsx` | 10 |
| `apps/web/src/features/listings/components/VideoUploader.tsx` | 10 |
| `apps/web/src/features/listings/components/PlatformPreview.tsx` | 10 |
| `apps/web/src/features/listings/components/CaptionEditor.tsx` | 10 |
| `apps/web/src/features/listings/components/ThumbnailPicker.tsx` | 10 |
| `apps/web/src/features/listings/components/AccountSelector.tsx` | 10 |
| `apps/web/src/features/listings/components/DerivationPreview.tsx` | 10 |
| `apps/web/src/features/settings/CaptionTemplatesPage.tsx` | 10 |

---

## Estimated Effort

| Phase | Description | Complexity | Est. Days |
|-------|-------------|------------|-----------|
| 1 | Data Model & CRUD | Medium | 3-4 |
| 2 | Asset Intake & FFmpeg | High | 5-7 |
| 3 | Auto-Derivations | High | 5-7 |
| 4 | Captions & Templating | Medium | 3-5 |
| 5 | Scheduling & Publishing | High | 7-10 |
| 6 | Reliability | High | 4-6 |
| 7 | Post-Publish Enrichment | Medium | 3-5 |
| 8 | Bulk Operations | Medium | 3-4 |
| 9 | Governance | Low-Medium | 2-3 |
| 10 | Frontend | High | 8-12 |
| **Total** | | | **43-63 days** |

---

## Dependencies & Prerequisites

1. **YouTube Developer Console:** Create project, enable YouTube Data API v3, configure OAuth consent screen.
2. **Snapchat Developer Portal:** Create Snap Kit app (if going beyond deep-link handoff).
3. **TikTok Developer Portal:** Ensure app has Content Posting API access (requires review).
4. **FFmpeg:** Available in Docker image or system PATH.
5. **OpenAI API key** (optional): For Whisper transcript generation.
6. **AWS MediaConvert** (optional): For production video processing at scale.
