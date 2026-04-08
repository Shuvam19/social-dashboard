# YouTube OAuth Setup Guide

To enable YouTube automated uploads (videos and Shorts), you need to configure a Google Cloud Platform project and obtain OAuth credentials. Follow these steps:

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project drop-down menu at the top and click **New Project**.
3. Enter a Project Name (e.g., "Social Dashboard YouTube") and click **Create**.

## 2. Enable YouTube Data API v3
1. In the Google Cloud Console, navigate to **APIs & Services > Library**.
2. Search for **YouTube Data API v3**.
3. Click on it and click **Enable**.

## 3. Configure the OAuth Consent Screen
1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select **External** (or Internal if you're using this inside a Google Workspace) and click **Create**.
3. Fill in the required App information:
   - **App name**: e.g., "Social Dashboard"
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the Scopes screen, click **Add or Remove Scopes** and add the following:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
6. Click **Save and Continue**.
7. If your app is not yet verified by Google, add yourself and any testers to the **Test users** section.

## 4. Create OAuth Client ID Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials** and select **OAuth client ID**.
3. Set the Application type to **Web application**.
4. Set a name like "Social Dashboard Web Client".
5. Under **Authorized redirect URIs**, add your redirect URI:
   - Development: `http://localhost:3000/api/oauth/youtube/callback`
   - Production: `https://your-domain.com/api/oauth/youtube/callback`
6. Click **Create**.
7. You will be presented with your **Client ID** and **Client Secret**.

## 5. Add Credentials to the Project
Copy the credentials generated in the previous step and add them to your `apps/api/.env` file:

```env
YOUTUBE_CLIENT_ID=your-client-id-here
YOUTUBE_CLIENT_SECRET=your-client-secret-here
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/oauth/youtube/callback
```

### Important Notes on Quotas:
Uploading videos via the YouTube Data API is expensive. An upload costs **1600 quota units**, and the default limit is typically 10,000 units per day. This means you can upload roughly 6 videos per day by default. If you need more, you must request a quota extension from Google.
