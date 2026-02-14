# Social Dashboard - Multi-Tenant Social Media Management

A comprehensive social media management dashboard that allows users to manage multiple social media accounts across different platforms.

## Features

### Phase 1 (Current)
- 🔐 **Unified Identity & Access**: OAuth2 connectivity for Meta (FB/IG), LinkedIn, X (Twitter), TikTok, and Pinterest
- 👥 **Multi-Tenancy**: Support for multiple users with multiple accounts each
- 🛡️ **RBAC**: Role-Based Access Control (Admin, Editor, Viewer)
- 📝 **Simple Posting**: Text-only posting to connected accounts

### Phase 2 (Upcoming)
- 📥 **Grand Central Inbox**: Aggregated comments, DMs, mentions with real-time updates
- 🔔 **Webhooks**: Real-time notifications from social platforms

### Phase 3 (Planned)
- 📊 **Ad Manager**: Boost posts, create campaigns, consolidated reporting

### Phase 4 (Future)
- 🤖 **AI Integration**: Sentiment analysis, reply suggestions

## Tech Stack

### Frontend
- React 18 + Vite
- TanStack Query (React Query)
- Zustand for state management
- Shadcn/UI + Tailwind CSS
- Socket.io for real-time updates

### Backend
- Node.js + NestJS (TypeScript)
- Prisma ORM
- PostgreSQL
- Redis + BullMQ for job queues
- Passport.js for OAuth2

## Prerequisites

1. **Docker Desktop**: Installed and running
2. **Node.js**: v20+
3. **pnpm**: v8+
4. **Ngrok**: For testing webhooks locally

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd social-dashboard
pnpm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
pnpm docker:up
```

### 3. Configure Environment

```bash
# Copy environment templates
cp docker/.env.example docker/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 4. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### 5. Start Development

```bash
# Start both frontend and backend
pnpm dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/docs

## Project Structure

```
social-dashboard/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/        # JWT + OAuth2 modules
│   │   │   ├── users/       # User management
│   │   │   ├── tenants/     # Multi-tenancy logic
│   │   │   ├── social-accounts/  # OAuth connections
│   │   │   ├── posts/       # Unified posting service
│   │   │   ├── interactions/  # Comments, DMs, mentions
│   │   │   ├── campaigns/   # Ad campaigns
│   │   │   └── common/      # Guards, decorators
│   │   └── prisma/          # Database schema
│   └── web/                 # React + Vite frontend
│       └── src/
│           ├── features/    # Feature modules
│           ├── components/  # Shared components
│           └── lib/         # Utilities
├── packages/
│   └── shared/              # Shared types & utils
└── docker/                  # Docker configs
```

## OAuth Setup

You'll need to create developer apps for each platform:

| Platform | Developer Portal |
|----------|-----------------|
| Meta (FB/IG) | https://developers.facebook.com |
| LinkedIn | https://www.linkedin.com/developers |
| X (Twitter) | https://developer.twitter.com |
| TikTok | https://developers.tiktok.com |
| Pinterest | https://developers.pinterest.com |

See `docs/oauth-setup.md` for detailed instructions.

## License

MIT
