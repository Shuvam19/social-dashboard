# OAuth Setup Guide

This guide explains how to set up OAuth applications for each social media platform.

## Prerequisites

1. Start the development server with ngrok for callback URLs:
   ```bash
   ngrok http 3000
   ```
2. Note your ngrok URL (e.g., `https://abc123.ngrok.io`)
3. Update `.env` files with the ngrok URL for callback URIs

---

## Meta (Facebook & Instagram)

### Step 1: Create a Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Select "Business" app type
4. Fill in app details and create

### Step 2: Configure Products
1. Add "Facebook Login" product
2. Add "Instagram Basic Display" or "Instagram Graph API"

### Step 3: Configure OAuth Settings
1. Go to Facebook Login → Settings
2. Add Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/oauth/FACEBOOK/callback`
   - `https://your-ngrok-url.ngrok.io/api/oauth/FACEBOOK/callback`

### Step 4: Get Credentials
1. Go to Settings → Basic
2. Copy App ID and App Secret
3. Add to `.env`:
   ```
   META_APP_ID=your-app-id
   META_APP_SECRET=your-app-secret
   META_REDIRECT_URI=http://localhost:3000/api/oauth/FACEBOOK/callback
   ```

### Required Permissions
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `instagram_basic`
- `instagram_content_publish`

---

## LinkedIn

### Step 1: Create a LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers)
2. Click "Create App"
3. Fill in company and app details

### Step 2: Configure OAuth 2.0
1. Go to "Auth" tab
2. Add Redirect URLs:
   - `http://localhost:3000/api/oauth/LINKEDIN/callback`
   - `https://your-ngrok-url.ngrok.io/api/oauth/LINKEDIN/callback`

### Step 3: Request Products
1. Go to "Products" tab
2. Request access to:
   - Sign In with LinkedIn using OpenID Connect
   - Share on LinkedIn

### Step 4: Get Credentials
1. Go to "Auth" tab
2. Copy Client ID and Client Secret
3. Add to `.env`:
   ```
   LINKEDIN_CLIENT_ID=your-client-id
   LINKEDIN_CLIENT_SECRET=your-client-secret
   LINKEDIN_REDIRECT_URI=http://localhost:3000/api/oauth/LINKEDIN/callback
   ```

### Required Scopes
- `openid`
- `profile`
- `email`
- `w_member_social`

---

## X (Twitter)

### Step 1: Create a Twitter Developer Account
1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Sign up for a developer account
3. Create a project and app

### Step 2: Configure OAuth 2.0
1. Go to your App → Settings → User authentication settings
2. Enable OAuth 2.0
3. Select "Web App, Automated App or Bot"
4. Add Callback URLs:
   - `http://localhost:3000/api/oauth/TWITTER/callback`
   - `https://your-ngrok-url.ngrok.io/api/oauth/TWITTER/callback`

### Step 3: Get Credentials
1. Go to "Keys and tokens" tab
2. Generate OAuth 2.0 Client ID and Client Secret
3. Add to `.env`:
   ```
   TWITTER_CLIENT_ID=your-client-id
   TWITTER_CLIENT_SECRET=your-client-secret
   TWITTER_REDIRECT_URI=http://localhost:3000/api/oauth/TWITTER/callback
   ```

### Required Scopes
- `tweet.read`
- `tweet.write`
- `users.read`
- `offline.access`

---

## TikTok

### Step 1: Create a TikTok Developer Account
1. Go to [TikTok for Developers](https://developers.tiktok.com)
2. Sign up and create an app

### Step 2: Configure OAuth
1. Go to App → Manage Apps
2. Configure Login Kit
3. Add Redirect URIs:
   - `http://localhost:3000/api/oauth/TIKTOK/callback`
   - `https://your-ngrok-url.ngrok.io/api/oauth/TIKTOK/callback`

### Step 3: Get Credentials
1. Copy Client Key and Client Secret
2. Add to `.env`:
   ```
   TIKTOK_CLIENT_KEY=your-client-key
   TIKTOK_CLIENT_SECRET=your-client-secret
   TIKTOK_REDIRECT_URI=http://localhost:3000/api/oauth/TIKTOK/callback
   ```

### Required Scopes
- `user.info.basic`
- `video.publish`

---

## Pinterest

### Step 1: Create a Pinterest Developer Account
1. Go to [Pinterest Developers](https://developers.pinterest.com)
2. Create an app

### Step 2: Configure OAuth
1. Go to your app settings
2. Add Redirect URIs:
   - `http://localhost:3000/api/oauth/PINTEREST/callback`
   - `https://your-ngrok-url.ngrok.io/api/oauth/PINTEREST/callback`

### Step 3: Get Credentials
1. Copy App ID and App Secret
2. Add to `.env`:
   ```
   PINTEREST_APP_ID=your-app-id
   PINTEREST_APP_SECRET=your-app-secret
   PINTEREST_REDIRECT_URI=http://localhost:3000/api/oauth/PINTEREST/callback
   ```

### Required Scopes
- `boards:read`
- `pins:read`
- `pins:write`
- `user_accounts:read`

---

## Testing OAuth Locally

1. Start Docker containers:
   ```bash
   pnpm docker:up
   ```

2. Run database migrations:
   ```bash
   cd apps/api
   npx prisma migrate dev
   ```

3. Start ngrok:
   ```bash
   ngrok http 3000
   ```

4. Update `.env` with ngrok URL for callbacks

5. Start the development server:
   ```bash
   pnpm dev
   ```

6. Navigate to `http://localhost:5173/accounts/connect` and test connections

---

## Troubleshooting

### "Invalid redirect URI" Error
- Ensure the redirect URI in your `.env` exactly matches what's configured in the platform's developer console
- Check for trailing slashes

### "Invalid client" Error
- Verify your client ID and secret are correct
- Ensure your app is not in sandbox/development mode that restricts access

### "Scope not approved" Error
- Some platforms require app review for certain scopes
- Use basic scopes during development

### Token Expiration
- Access tokens typically expire after 1-24 hours
- Refresh tokens are used to get new access tokens
- The system automatically handles token refresh
