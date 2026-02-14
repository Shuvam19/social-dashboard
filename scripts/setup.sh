#!/bin/bash

# Social Dashboard - Development Setup Script

set -e

echo "🚀 Social Dashboard - Development Setup"
echo "========================================"

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi
echo "✅ Docker installed"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v20+."
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) installed"

if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm installed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Setup environment files
echo ""
echo "🔧 Setting up environment files..."
if [ ! -f "docker/.env" ]; then
    cp docker/.env.example docker/.env
    echo "  Created docker/.env"
fi
if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    echo "  Created apps/api/.env"
fi
if [ ! -f "apps/web/.env" ]; then
    cp apps/web/.env.example apps/web/.env
    echo "  Created apps/web/.env"
fi

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Generate Prisma client
echo ""
echo "🗃️  Generating Prisma client..."
cd apps/api
npx prisma generate
cd ../..

# Run database migrations
echo ""
echo "🗃️  Running database migrations..."
cd apps/api
npx prisma migrate dev --name init
cd ../..

echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  pnpm dev"
echo ""
echo "URLs:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo "  API Docs: http://localhost:3000/api/docs"
echo "  Redis UI: http://localhost:8081"
echo ""
echo "Next steps:"
echo "  1. Configure OAuth credentials in apps/api/.env"
echo "  2. See docs/oauth-setup.md for platform setup guides"
echo ""
