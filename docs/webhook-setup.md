# Webhook Setup Guide

This guide explains how to set up webhooks to receive real-time interactions (comments, DMs, mentions) from social media platforms.

## Prerequisites

1. Ensure Docker services (Postgres + Redis) are running:
   ```bash
   cd docker && docker-compose up -d
   ```
2. Start ngrok for webhook callbacks:
   ```bash
   ngrok http 3000
   ```
3. Note your ngrok URL (e.g., `https://abc123.ngrok.io`)

---

## Architecture Overview

```
Social Platform → POST /api/webhooks/:platform
                      ↓
              Signature Validation
                      ↓
              BullMQ Queue (webhook-ingest)
                      ↓
              Webhook Processor Worker
                      ↓
              Parse → Save to DB → WebSocket Broadcast
                      ↓
              Real-time Inbox UI update
```

Webhooks are:
- **Unauthenticated** (no JWT required — platforms send directly)
- **Signature-verified** per platform (HMAC-SHA256)
- **Async-processed** via BullMQ to avoid platform timeouts
- **Logged** to `webhook_logs` table for debugging

---

## Environment Variables

Add these to `apps/api/.env`:

```env
# ── Webhook Secrets ──────────────────────────────────

# Meta (Facebook/Instagram)
META_WEBHOOK_VERIFY_TOKEN=your-custom-verify-token    # You choose this
META_APP_SECRET=your-meta-app-secret                  # From Meta Developer Dashboard

# Twitter / X
TWITTER_WEBHOOK_SECRET=your-twitter-consumer-secret

# LinkedIn
LINKEDIN_WEBHOOK_SECRET=your-linkedin-webhook-secret

# TikTok
TIKTOK_WEBHOOK_SECRET=your-tiktok-webhook-secret

# Pinterest
PINTEREST_WEBHOOK_SECRET=your-pinterest-webhook-secret
```

> **Dev mode:** If a platform's secret is not set and `NODE_ENV !== 'production'`, signature validation is skipped for convenience.

---

## Platform-Specific Setup

### Meta (Facebook & Instagram)

1. Go to your app in [Meta Developer Dashboard](https://developers.facebook.com)
2. Navigate to **Webhooks** product
3. Click **Add Subscription**:
   - **Callback URL**: `https://your-ngrok-url.ngrok.io/api/webhooks/meta`
   - **Verify Token**: Same value as `META_WEBHOOK_VERIFY_TOKEN` in `.env`
4. Subscribe to these fields:
   - **Page**: `feed` (comments), `messages` (DMs)
   - **Instagram**: `comments`, `mentions`, `messages`
5. Click **Verify and Save**

#### Testing Meta Webhooks
```bash
# Simulate a Meta comment webhook locally
curl -X POST http://localhost:3000/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "PAGE_ID",
      "time": 1700000000,
      "changes": [{
        "field": "feed",
        "value": {
          "item": "comment",
          "comment_id": "123456",
          "post_id": "POST_ID",
          "from": { "id": "USER_123", "name": "John Doe" },
          "message": "Great post!"
        }
      }]
    }]
  }'
```

---

### Twitter / X (Account Activity API)

1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Set up **Account Activity API** environment
3. Register webhook URL:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/twitter
   ```
4. Twitter will send a GET request with `crc_token` for verification
5. Subscribe the user account to receive events

#### Testing Twitter Webhooks
```bash
curl -X POST http://localhost:3000/api/webhooks/twitter \
  -H "Content-Type: application/json" \
  -d '{
    "for_user_id": "USER_ID",
    "tweet_create_events": [{
      "id_str": "tweet_123",
      "text": "@youraccount Love this!",
      "user": {
        "id_str": "sender_456",
        "screen_name": "janedoe",
        "name": "Jane Doe",
        "profile_image_url_https": "https://pbs.twimg.com/..."
      },
      "in_reply_to_status_id_str": "original_tweet_id",
      "created_at": "Thu Jan 01 00:00:00 +0000 2026"
    }]
  }'
```

---

### LinkedIn

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com)
2. Navigate to your app → **Webhooks**
3. Register webhook:
   - **URL**: `https://your-ngrok-url.ngrok.io/api/webhooks/linkedin`
   - **Events**: Organization Social Actions
4. LinkedIn will verify via challenge-response

---

### TikTok

1. Go to [TikTok Developer Portal](https://developers.tiktok.com)
2. Navigate to your app → **Webhooks**
3. Register:
   - **URL**: `https://your-ngrok-url.ngrok.io/api/webhooks/tiktok`
   - **Events**: `comment.create`, `comment.reply`, `direct_message.receive`, `mention.create`

---

### Pinterest

1. Go to [Pinterest Developer Portal](https://developers.pinterest.com)
2. Set up webhooks:
   - **URL**: `https://your-ngrok-url.ngrok.io/api/webhooks/pinterest`
   - **Events**: `pin_comment`, `pin_reply`, `mention`, `message`

---

## Database Migration

After setting up the environment, run the Phase 2 migration:

```bash
cd apps/api
npx prisma migrate dev
```

This adds:
- `is_read` column to `interactions` table
- `parent_id` column for threaded replies
- `raw_payload` column for webhook debugging
- `webhook_logs` table for audit trail

---

## Monitoring & Debugging

### Check Webhook Logs
Use Prisma Studio to inspect received webhooks:
```bash
cd apps/api && npx prisma studio
```
Navigate to the `WebhookLog` table to see:
- All received payloads
- Processing status (`processedAt`)
- Error messages for failed processing

### Redis Queue Monitoring
Access Redis Commander at `http://localhost:8081` to inspect:
- `webhook-ingest` queue jobs
- Failed/completed job counts
- Job retry attempts

### WebSocket Connection
The inbox WebSocket connects on the `/inbox` namespace:
- Clients authenticate via JWT token in handshake
- Auto-joins tenant room: `tenant:<tenantId>`
- Events: `interaction:new`, `interaction:updated`, `interaction:read`

---

## Extending for New Platforms

To add a new platform:

1. **Create parser**: `apps/api/src/webhooks/parsers/newplatform.parser.ts`
   - Export a function matching the `WebhookParseResult` interface
2. **Register parser**: Add to `parsers/index.ts` and `webhook-ingest.processor.ts`
3. **Add to controller**: Add the platform name to `SUPPORTED_PLATFORMS` array
4. **Add signature validation**: Add a case in `validateSignature()`
5. **Add env var**: `NEWPLATFORM_WEBHOOK_SECRET`
