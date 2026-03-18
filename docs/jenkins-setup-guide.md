# 🏗️ Jenkins Setup & Multi-Project Deployment Guide

This guide explains how to set up Jenkins to manage and deploy multiple projects (including this one).

---

## 1. Jenkins Installation

### Option A: Install via Docker (Recommended)
Run Jenkins inside a Docker container on your build server:

```bash
docker run -d -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name jenkins jenkins/jenkins:lts
```

### Option B: Native Installation (Ubuntu)
```bash
sudo apt update
sudo apt install openjdk-17-jre
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/ | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install jenkins
```

---

## 2. Required Plugins

Go to **Manage Jenkins** -> **Plugins** -> **Available Plugins** and install:
1.  **Docker Pipeline**: For building and pushing Docker images.
2.  **SSH Agent**: For secure deployments via SSH.
3.  **Pipeline: GitHub**: To trigger builds on code pushes.
4.  **Credentials Binding**: To safely use secrets.

---

## 3. Configure Credentials

Go to **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials** and add:

| ID | Type | Description |
|---|---|---|
| `GHCR_TOKEN_ID` | Username with password | GitHub Username + Personal Access Token (PAT) |
| `SERVER_SSH_KEY_ID` | SSH Username with private key | The private key for `shuvamkumar-social` |
| `SERVER_HOST` | Secret text | Your server's IP address |
| `SERVER_PORT` | Secret text | SSH port (usually 22) |
| `SERVER_USER` | Secret text | `shuvamkumar-social` |

---

## 4. Setting up a New Project Pipeline

For **every** project you want to deploy, follow these steps:

1.  **Create a New Item**:
    *   Click **New Item** on the Jenkins dashboard.
    *   Enter the project name (e.g., `social-dashboard`).
    *   Select **Pipeline** and click OK.
2.  **Configure Pipeline**:
    *   Scroll down to **Pipeline** section.
    *   Definition: `Pipeline script from SCM`.
    *   SCM: `Git`.
    *   Repository URL: Your project's Git URL.
    *   Script Path: `Jenkinsfile` (ensure this file exists in your repo).
3.  **Webhook (Auto-deploy)**:
    *   Check **GitHub hook trigger for GITScm polling**.
    *   In your GitHub Repo -> **Settings** -> **Webhooks** -> Add `http://your-jenkins-ip:8080/github-webhook/`.

---

## 5. Multi-Project Management Strategies

To efficiently manage many projects in one Jenkins instance:

### A. Folders
Organize your projects by client or type.
*   Click **New Item** -> **Folder**.
*   Move projects inside folders (e.g., `/Social-Apps/social-dashboard`).

### B. Shared Libraries
If all your projects use the same build/deploy logic, create a **Jenkins Shared Library**. 
Instead of a full `Jenkinsfile` in every repo, you just use:
```groovy
@Library('my-shared-library') _
myDeployPipeline(
    projectName: 'my-app',
    apiPort: 3172
)
```

### C. Jenkins Multibranch Pipelines
If you want Jenkins to automatically create a job for every branch (`main`, `dev`, `feature/*`):
*   Click **New Item** -> **Multibranch Pipeline**.
*   Jenkins will scan your repo and run the `Jenkinsfile` for every branch it finds.

---

## 6. Troubleshooting Jenkins

*   **Docker Permissions**: If Jenkins fails to run `docker`, run:
    ```bash
    sudo usermod -aG docker jenkins
    sudo systemctl restart jenkins
    ```
*   **Workspace Disk Space**: Jenkins can use a lot of disk space. Add a cleanup stage in your `Jenkinsfile`:
    ```groovy
    post { always { cleanWs() } }
    ```
*   **Memory Issues**: Jenkins needs at least 2GB of RAM. If it crashes, check `dmesg` for Out Of Memory (OOM) errors.
