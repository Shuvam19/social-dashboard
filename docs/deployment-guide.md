# 🚀 Social Dashboard — Deployment Guide

Step-by-step guide for first-time server setup and automated deployments via GitHub Actions.

---

## Architecture

```
  Browser ──▶ Nginx (already on server — social.shuvamkumar.com)
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

**What runs where:**
| Component | Where | Notes |
|---|---|---|
| Nginx | Already on server | You manage it — just add proxy rules |
| PostgreSQL | External RDS | You provide the `DATABASE_URL` |
| Redis | Docker on server | Managed by `docker-compose.prod.yml` |
| LocalStack (S3) | Docker on server | For file uploads; switch to real AWS S3 later |
| API (NestJS) | Docker on server | Port `3000` |
| Web (React) | Docker on server | Port `5173` |

**CI/CD Flow:**
```
Push to main → GitHub Actions → Build Docker images → Push to GHCR → SSH → Pull & restart containers
```

**Server project directory:**
```
/home/shuvamkumar-social/htdocs/social.shuvamkumar.com/
```

---

## Files Overview

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

### Step 1 — Install Docker on the Server

SSH into your server and install Docker (if not already):

```bash
ssh shuvamkumar-social@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker && sudo systemctl start docker

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# ⚠️ Log out and back in for the group change to take effect
exit
ssh shuvamkumar-social@your-server-ip

# Verify
docker --version
docker compose version
```

### Step 2 — Create the Project Directory on Server

```bash
mkdir -p /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker
```

### Step 3 — Copy Docker Files to the Server (first time only)

From your **local machine**, copy the required files:

```bash
scp docker/docker-compose.prod.yml \
    docker/localstack-init.sh \
    shuvamkumar-social@your-server-ip:/home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker/
```

> After the first deploy, GitHub Actions will automatically sync these files on every push.

### Step 4 — Create the `.env.prod` File on the Server

```bash
cd /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker
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

# ── PostgreSQL (your external RDS URL) ───────────────────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@your-rds-host.com:5432/social_dashboard?schema=public

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=<generate-see-below>

# ── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=<generate-see-below>
JWT_REFRESH_SECRET=<generate-see-below>

# ── Application ─────────────────────────────────────────────────────────────
FRONTEND_URL=https://social.shuvamkumar.com
API_PREFIX=api
ENCRYPTION_KEY=<generate-see-below>

# ── LocalStack S3 ───────────────────────────────────────────────────────────
AWS_REGION=us-east-1
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_BUCKET=social-dashboard-uploads
# How the browser reaches uploaded files (set after configuring nginx — see Step 5)
S3_PUBLIC_URL=https://social.shuvamkumar.com/s3/social-dashboard-uploads
```

**Generate all secrets in one go:**

```bash
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
```

Copy each generated value into your `.env.prod`.

### Step 5 — Update Your Existing Nginx Config

Since you already have Nginx and the domain `social.shuvamkumar.com` set up, add these proxy rules to your existing server block:

```nginx
server {
    listen 443 ssl;
    server_name social.shuvamkumar.com;

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

    # ── LocalStack S3 (serves uploaded images) ──
    location /s3/ {
        proxy_pass http://127.0.0.1:4566/;
        proxy_set_header Host $host;
    }
}
```

Then test & reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> The `/s3/` proxy lets the browser load uploaded images via `https://social.shuvamkumar.com/s3/social-dashboard-uploads/...` without exposing port 4566 directly.

### Step 6 — Configure GitHub Repository Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add these **5 secrets**:

| Secret Name | Value |
|---|---|
| `SERVER_HOST` | Your server's IP address (e.g. `203.0.113.50`) |
| `SERVER_USER` | `shuvamkumar-social` |
| `SERVER_SSH_KEY` | The **private** SSH key (full content including `-----BEGIN...` and `-----END...` lines) |
| `SERVER_PORT` | SSH port (usually `22`) |
| `VITE_API_URL` | `https://social.shuvamkumar.com` |

> **How to get / create the SSH key:**
>
> If you already SSH into the server with a key, use that same private key:
> ```bash
> cat ~/.ssh/id_ed25519
> ```
>
> Or generate a dedicated deploy key:
> ```bash
> ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
> # Add the public key to the server
> ssh-copy-id -i ~/.ssh/github_deploy.pub shuvamkumar-social@your-server-ip
> # Copy the private key — paste this into the GitHub secret
> cat ~/.ssh/github_deploy
> ```

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

This triggers the GitHub Actions workflow:
1. **Lint & Test** — runs against CI Postgres + Redis
2. **Build API image** — multi-stage Docker build → pushes to `ghcr.io`
3. **Build Web image** — multi-stage Docker build → pushes to `ghcr.io`
4. **Deploy** — SSHs into server, copies docker files, pulls images, restarts containers

Monitor progress: **GitHub repo → Actions tab → click the running workflow**.

### Step 9 — Verify

```bash
ssh shuvamkumar-social@your-server-ip

# Check containers are running
docker ps
# Should show: sd-api, sd-web, sd-redis, sd-localstack

# Check API logs
docker logs sd-api --tail 30

# Check web logs
docker logs sd-web --tail 10

# Test API directly on the server
curl http://127.0.0.1:3000/api

# Test via your domain
curl https://social.shuvamkumar.com/api
```

---

## Manual Deploy / Rollback

### Trigger a manual deploy

GitHub repo → **Actions** → **🚀 Build & Deploy** → **Run workflow** → optionally check "Skip tests".

### Rollback to a previous version

```bash
ssh shuvamkumar-social@your-server-ip
cd /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker

# Edit .env.prod and change IMAGE_TAG to a previous short SHA
nano .env.prod
# IMAGE_TAG=abc1234

# Pull that version and restart
docker compose -f docker-compose.prod.yml --env-file .env.prod pull api web
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Switching from LocalStack to Real AWS S3

When you're ready to use real S3:

1. Create an S3 bucket and IAM user in AWS
2. Update `.env.prod` on the server:

```env
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=wJal...
S3_BUCKET=your-real-bucket-name
S3_PUBLIC_URL=https://your-real-bucket-name.s3.us-east-1.amazonaws.com
```

3. In `docker/docker-compose.prod.yml`, remove or comment out `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` from the `api` service:

```yaml
    environment:
      # S3_ENDPOINT: ""              # remove or leave empty
      # S3_FORCE_PATH_STYLE: "false" # default for real AWS
```

4. Stop LocalStack to free up resources:

```bash
cd /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker
docker compose -f docker-compose.prod.yml --env-file .env.prod stop localstack
```

5. Remove the `/s3/` location block from your nginx config and reload nginx.

---

## Useful Commands

```bash
# SSH into server
ssh shuvamkumar-social@your-server-ip

# Go to project
cd /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker

# View all logs (live)
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# View logs for a specific service
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api

# Restart a single service
docker compose -f docker-compose.prod.yml --env-file .env.prod restart api

# Run Prisma migration manually
docker exec sd-api npx prisma migrate deploy

# Open Prisma Studio (access via SSH tunnel on your local machine)
# On server:
docker exec -it sd-api npx prisma studio
# Then SSH tunnel from local:  ssh -L 5555:127.0.0.1:5555 shuvamkumar-social@your-server-ip

# Stop everything
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Clean up disk space
docker system prune -af
```
