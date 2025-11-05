#!/bin/bash

# OpenSAM Backend - Dependency Installation Script
# Usage: ./install.sh [clean]

set -e

echo "================================================"
echo "  OpenSAM Backend - Dependency Installation"
echo "================================================"
echo ""

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js: $NODE_VERSION"

REQUIRED_VERSION="20.0.0"
CURRENT_VERSION=$(node -v | sed 's/v//')

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$CURRENT_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Error: Node.js version must be >= $REQUIRED_VERSION"
    exit 1
fi

echo "✅ Node.js version OK"
echo ""

# Clean install if requested
if [ "$1" == "clean" ]; then
    echo "🧹 Cleaning previous installation..."
    rm -rf node_modules package-lock.json dist
    echo "✅ Cleaned"
    echo ""
fi

# Check if npm cache needs cleaning
if [ "$1" == "clean-cache" ]; then
    echo "🧹 Cleaning npm cache..."
    npm cache clean --force
    echo "✅ Cache cleaned"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Installation failed"
    exit 1
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Show summary
echo "📊 Installation Summary:"
npm list --depth=0 | head -20
echo "   ..."
echo ""

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""

# Check MongoDB and Redis
echo "🔍 Checking services..."

if command -v docker &> /dev/null; then
    MONGO_RUNNING=$(docker ps --filter "name=opensam-mongodb" --format "{{.Names}}" 2>/dev/null)
    REDIS_RUNNING=$(docker ps --filter "name=opensam-redis" --format "{{.Names}}" 2>/dev/null)
    
    if [ -n "$MONGO_RUNNING" ]; then
        echo "✅ MongoDB container is running"
    else
        echo "⚠️  MongoDB container not running - start with: docker-compose up -d"
    fi
    
    if [ -n "$REDIS_RUNNING" ]; then
        echo "✅ Redis container is running"
    else
        echo "⚠️  Redis container not running - start with: docker-compose up -d"
    fi
else
    echo "⚠️  Docker not found - cannot check service status"
fi

echo ""
echo "================================================"
echo "  🎉 Installation Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Start services: docker-compose up -d"
echo "  2. Start dev server: npm run dev"
echo "  3. Check health: curl http://localhost:3000/health"
echo ""
