# ---- Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build shared package first, then API
RUN pnpm --filter @social-dashboard/shared build
RUN pnpm --filter @social-dashboard/api build

# ---- Production ----
FROM node:22-alpine AS production
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Copy root node_modules (includes prisma CLI + generated client)
COPY --from=build /app/node_modules ./node_modules

# Copy API node_modules (workspace-local deps)
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

# Copy prisma schema (needed for migrate deploy)
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Copy built output
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

# Copy shared package (needed at runtime)
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json

WORKDIR /app/apps/api

EXPOSE 3000

# Run migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
