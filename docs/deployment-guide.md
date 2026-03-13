# 🚀 Social Dashboard — Deployment Guide

Step-by-step guide for first-time server setup and automated deployments via GitHub Actions.

---

## Architecture

```
  Browser ──▶ Your Nginx (already on server)
                  │
                  ├── /           ──▶  sd-web   (port 5173)   React SPA
                  ├── /api/       ──▶  sd-api   (port 3000)   NestJS API
                  └── /socket.io/ ──▶  sd-api   (port 3000)   WebSocket
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                    sd-redis:6379    sd-localstack:4566   External RDS
                    (Docker)         (Docker / S3)        (PostgreSQL)
```

**CI/CD Flow:**
```
Push to main → GitHub Actions → Build Docker images → Push to GHCR → SSH → Pull & restart containers
```

---

## Files Created

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |
| `apps/api/Dockerfile` | Multi-stage API Docker build |
| `apps/web/Dockerfile` | Multi-stage Web Docker build (→ nginx) |
| `apps/web/nginx.conf` | SPA nginx config inside web container |
| `docker/docker-compose.prod.yml` | Production: Redis + LocalStack + API + Web |
| `docker/.env.prod.example` | Template for server env vars |
| `.dockerignore` | Keeps Docker builds small |

---

## Step-by-Step First-Time Setup

### Step 1 — Server Prerequisites

SSH into your server and make sure Docker & Docker Compose are installed:

```bash
ssh your-user@your-server

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker && sudo systemctl start docker

# Make sure your user can run Docker
sudo usermod -aG docker $USER
# Log out and back in for group to take effect

# Verify
docker --version
docker compose version
```

### Step 2 — Create Project Directory on Server

```bash
mkdir -p ~/social-dashboard/docker
```

### Step 3 — Create the `.env.prod` File on the Server

```bash
cd ~/social-dashboard/docker
nano .env.prod
```

Paste and fill in these values:

```env
# ── Docker ───────────────────────────────────────────────────────────────────
DOCKER_REGISTRY=ghcr.io/YOUR_GITHUB_USERNAME
IMAGE_TAG=latest

# ── Ports (match your nginx proxy_pass) ──────────────────────────────────────
API_PORT=3000
WEB_PORT=5173

# ── PostgreSQL (your external RDS) ───────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@your-rds-host.com:5432/social_dashboard?schema=public

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=<generate with: openssl rand -base64 24>

# ── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>

# ── Application ─────────────────────────────────────────────────────────────
FRONTEND_URL=https://your-domain.com
API_PREFIX=api
ENCRYPTION_KEY=<generate with: openssl rand -hex 16>

# ── LocalStack S3 ───────────────────────────────────────────────────────────
AWS_REGION=us-east-1
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_BUCKET=social-dashboard-uploads
# S3_PUBLIC_URL is how the *browser* reaches uploaded files.
# If your nginx proxies :4566, use your domain. Otherwise use server IP.
S3_PUBLIC_URL=http://YOUR_SERVER_IP:4566/social-dashboard-uploads
```

> **Generate secrets quickly:**
> ```bash
> echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
> echo "JWT_SECRET=$(openssl rand -hex 32)"
> echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
> echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
> ```

### Step 4 — Open LocalStack Port (if needed)

Since the browser needs to reach LocalStack to load uploaded images, you may need to allow port `4566` through your firewall, **or** add a proxy rule in your existing nginx.

**Option A — Expose port 4566 directly (simple):**

```bash
# If using ufw
sudo ufw allow 4566/tcp
```

Then set `S3_PUBLIC_URL=http://YOUR_SERVER_IP:4566/social-dashboard-uploads` in `.env.prod`.

**Option B — Proxy through nginx (cleaner):**

Add this to your existing nginx config:

```nginx
location /s3/ {
    proxy_pass http://127.0.0.1:4566/;
    proxy_set_header Host $host;
}
```

Then set `S3_PUBLIC_URL=https://your-domain.com/s3/social-dashboard-uploads` in `.env.prod`.

### Step 5 — Update Your Existing Nginx Config

Add proxy rules for the API and Web app to your existing nginx server block:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # ... your existing SSL config ...

    # ── Frontend (React SPA) ──
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── API ──
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # ── WebSocket (Socket.IO) ──
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Then reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 6 — Configure GitHub Repository Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add these **5 secrets**:

| Secret Name | Value |
|---|---|
| `SERVER_HOST` | Your server's IP address (e.g. `203.0.113.50`) |
| `SERVER_USER` | SSH username (e.g. `ubuntu`, `deploy`, `root`) |
| `SERVER_SSH_KEY` | The **private** SSH key (full content, including `-----BEGIN...` and `-----END...`) |
| `SERVER_PORT` | SSH port (usually `22`) |
| `VITE_API_URL` | Your domain URL (e.g. `https://your-domain.com`) — baked into the frontend at build time |

> **How to get the SSH private key:**
> - If you already SSH into the server, use the same key: `cat ~/.ssh/id_ed25519`
> - Or generate a dedicated one:
>   ```bash
>   ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
>   # Add public key to server
>   ssh-copy-id -i ~/.ssh/github_deploy.pub your-user@your-server
>   # Copy private key to clipboard
>   cat ~/.ssh/github_deploy
>   ```

### Step 7 — Create a GitHub Environment

1. Go to your repo → **Settings** → **Environments**
2. Click **New environment** → name it `production` → click **Configure environment**
3. *(Optional)* Enable **Required reviewers** if you want manual approval before each deploy

### Step 8 — Push to Main & Deploy

```bash
git add .
git commit -m "ci: add deployment pipeline"
git push origin main
```

This triggers the workflow:
1. **Lint & Test** — runs against CI Postgres + Redis
2. **Build API image** — multi-stage Docker build → pushes to `ghcr.io`
3. **Build Web image** — multi-stage Docker build → pushes to `ghcr.io`
4. **Deploy** — SSHs into server, pulls images, restarts containers

Monitor progress: **GitHub repo → Actions tab → click the running workflow**.

### Step 9 — Verify

```bash
ssh your-user@your-server

# Check containers
docker ps
# Should show: sd-api, sd-web, sd-redis, sd-localstack

# Check logs
docker logs sd-api --tail 30
docker logs sd-web --tail 10

# Test API directly
curl http://127.0.0.1:3000/api

# Test via your domain
curl https://your-domain.com/api
```

---

## Manual Deploy / Rollback

### Trigger a manual deploy

GitHub repo → **Actions** → **🚀 Build & Deploy** → **Run workflow** → optionally check "Skip tests".

### Rollback to a previous version

```bash
ssh your-user@your-server
cd ~/social-dashboard/docker

# Edit .env.prod and change IMAGE_TAG to a previous short SHA
nano .env.prod
# IMAGE_TAG=abc1234

# Redeploy
docker compose -f docker-compose.prod.yml --env-file .env.prod pull api web
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Switching from LocalStack to Real AWS S3

When you're ready:

1. Create an S3 bucket and IAM user in AWS
2. Update `docker/.env.prod` on the server:

```env
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=wJal...
S3_BUCKET=your-real-bucket-name
S3_PUBLIC_URL=https://your-real-bucket-name.s3.us-east-1.amazonaws.com
```

3. In `docker/docker-compose.prod.yml`, remove the `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` env vars from the `api` service (or set them to empty):

```yaml
    environment:
      # S3_ENDPOINT: ""              # remove or leave empty
      # S3_FORCE_PATH_STYLE: "false" # default for real AWS
```

4. You can also stop LocalStack to save resources:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop localstack
```

---

## Useful Commands

```bash
# View all logs
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# Restart a single service
docker compose -f docker-compose.prod.yml --env-file .env.prod restart api

# Run Prisma migration manually
docker exec sd-api npx prisma migrate deploy

# Open Prisma Studio (access via SSH tunnel)
docker exec -it sd-api npx prisma studio

# Clean up disk
docker system prune -af
```
