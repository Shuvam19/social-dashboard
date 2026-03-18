pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = "ghcr.io/shuvam19"
        PROJECT_NAME = "social-dashboard"
        IMAGE_TAG = "latest"
        API_IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${IMAGE_TAG}"
        WEB_IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${IMAGE_TAG}"
        DEPLOY_PATH = "/home/shuvamkumar-social/htdocs/social.shuvamkumar.com/docker"
        // These should be set as credentials in Jenkins
        // SERVER_HOST, SERVER_USER, SERVER_SSH_KEY_ID, GHCR_TOKEN_ID
    }

    stages {
        stage('🛠️ Setup') {
            steps {
                script {
                    // Get short SHA for unique tagging
                    IMAGE_TAG = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    API_IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${IMAGE_TAG}"
                    WEB_IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${IMAGE_TAG}"
                }
            }
        }

        stage('📦 Build API Image') {
            steps {
                script {
                    docker.build(API_IMAGE, "-f apps/api/Dockerfile .")
                }
            }
        }

        stage('📦 Build Web Image') {
            steps {
                script {
                    // Build arg needed for Vite
                    docker.build(WEB_IMAGE, "--build-arg VITE_API_URL=https://social.shuvamkumar.com -f apps/web/Dockerfile .")
                }
            }
        }

        stage('🔑 Push to Registry') {
            steps {
                script {
                    docker.withRegistry("https://ghcr.io", "GHCR_TOKEN_ID") {
                        docker.image(API_IMAGE).push()
                        docker.image(WEB_IMAGE).push()
                        // Also push 'latest' tag
                        docker.image(API_IMAGE).push("latest")
                        docker.image(WEB_IMAGE).push("latest")
                    }
                }
            }
        }

        stage('🚀 Deploy') {
            steps {
                sshagent(['SERVER_SSH_KEY_ID']) {
                    sh """
                        # Copy docker files
                        scp -o StrictHostKeyChecking=no -P ${SERVER_PORT} docker/docker-compose.prod.yml docker/localstack-init.sh ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/

                        # Run deployment commands
                        ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << 'EOF'
                            set -e
                            cd ${DEPLOY_PATH}

                            # Update IMAGE_TAG in .env.prod
                            sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" .env.prod

                            # Login and pull
                            echo "${GHCR_TOKEN}" | docker login ghcr.io -u "shuvam19" --password-stdin
                            docker compose -f docker-compose.prod.yml --env-file .env.prod pull api web

                            # Deploy
                            docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
                            
                            # Clean up old images
                            docker image prune -af --filter "until=168h"
                        EOF
                    """
                }
            }
        }
    }

    post {
        always {
            // Cleanup workspace
            cleanWs()
        }
        success {
            echo "🎉 Deployment Successful! (Tag: ${IMAGE_TAG})"
        }
        failure {
            echo "❌ Deployment Failed!"
        }
    }
}
