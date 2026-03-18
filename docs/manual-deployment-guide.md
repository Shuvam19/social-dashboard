# 🛠️ Manual Deployment Guide

Use this guide to deploy the project manually from your local machine to the production server.

---

## 1. Prerequisites

Ensure you have the following installed locally:
*   **Docker & Docker Compose**
*   **SSH Access** to the production server
*   **Git**

---

## 2. Prepare the Server (One-time)

If you haven't already, create the project directory on your server:

```bash
ssh shuvamkumar-social@your-server-ip "mkdir -p /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker"
```

Ensure your `.env.prod` file exists on the server in that directory. (See `docs/deployment-guide.md` for the template).

---

## 3. Step-by-Step Deployment

Run these commands from the **root of the project** on your local machine:

### Step 3.1 — Build the Docker Images
We will build the images locally. Replace `shuvam19` with your GitHub username if different.

```bash
# 1. Build API
docker build -t ghcr.io/shuvam19/social-dashboard-api:latest -f apps/api/Dockerfile .

# 2. Build Web
docker build --build-arg VITE_API_URL=https://social.shuvamkumar.com \
  -t ghcr.io/shuvam19/social-dashboard-web:latest -f apps/web/Dockerfile .
```

### Step 3.2 — Push Images to Registry
You must be logged into GHCR (`docker login ghcr.io`).

```bash
docker push ghcr.io/shuvam19/social-dashboard-api:latest
docker push ghcr.io/shuvam19/social-dashboard-web:latest
```

### Step 3.3 — Sync Docker Configuration
Copy the production compose files to the server:

```bash
scp docker/docker-compose.prod.yml \
    docker/localstack-init.sh \
    shuvamkumar-social@your-server-ip:/home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker/
```

### Step 3.4 — Refresh the Server
SSH into the server and pull the new images:

```bash
ssh shuvamkumar-social@your-server-ip << 'EOF'
  cd /home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker
  
  # Pull the latest images we just pushed
  docker compose -f docker-compose.prod.yml --env-file .env.prod pull api web
  
  # Restart the containers with the new images
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
  
  # Optional: Clean up old unused images to save space
  docker image prune -f
EOF
```

---

## 4. Troubleshooting Manual Deploys

### "Permission Denied" during SCP/SSH
Ensure your SSH key is added to your local agent:
```bash
ssh-add ~/.ssh/your_private_key
```

### API Fails to Start (Database Errors)
Check the logs on the server:
```bash
docker logs sd-api --tail 50
```
If you see Prisma errors, ensure your `DATABASE_URL` in `.env.prod` is correct and accessible from the server.

### Web Shows Old Version
Hard-refresh your browser (`Ctrl + F5` or `Cmd + Shift + R`) to clear the cache.
