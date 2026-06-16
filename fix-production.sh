#!/bin/bash
# Quick Fix Script for auth.vyntrise.com
# Run this on your production server

echo "=========================================="
echo "🔧 Quick Fix for Vyntrise Auth"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found!"
    echo "Please run this from ~/vyntrise-auth directory"
    exit 1
fi

echo "Step 1: Pulling latest changes from Git..."
echo "----------------------------------------"
git pull origin master
echo ""

echo "Step 2: Pulling latest Docker images..."
echo "----------------------------------------"
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin
docker compose pull
echo ""

echo "Step 3: Stopping all containers..."
echo "----------------------------------------"
docker compose down
echo ""

echo "Step 4: Starting PostgreSQL first..."
echo "----------------------------------------"
docker compose up -d postgres
echo "Waiting for database to be ready..."
sleep 10

# Check if database is ready
for i in {1..30}; do
    if docker exec vyntrise-auth-db pg_isready -U postgres 2>/dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    echo "Waiting for database... ($i/30)"
    sleep 1
done

echo ""
echo "Step 5: Starting backend..."
echo "----------------------------------------"
docker compose up -d backend
echo "Waiting for backend to start..."
sleep 5

echo ""
echo "Step 6: Checking backend logs..."
echo "----------------------------------------"
docker compose logs backend --tail=30
echo ""

echo "Step 7: Testing backend health..."
echo "----------------------------------------"
for i in {1..10}; do
    if curl -f --max-time 2 http://localhost:3021/api/health 2>/dev/null; then
        echo "✅ Backend is responding!"
        break
    fi
    echo "Waiting for backend to respond... ($i/10)"
    sleep 2
done

echo ""
echo "Step 8: Starting frontend..."
echo "----------------------------------------"
docker compose up -d frontend
echo ""

echo "Step 9: Reloading nginx configuration..."
echo "----------------------------------------"
if command -v nginx &> /dev/null; then
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "ℹ️  Nginx not found or running in Docker"
fi

echo ""
echo "=========================================="
echo "📊 Final Status Check"
echo "=========================================="
docker compose ps
echo ""

echo "Testing production endpoint..."
curl -I https://auth.vyntrise.com 2>&1 | head -1

echo ""
echo "=========================================="
echo "✅ Fix attempt complete!"
echo ""
echo "Next steps:"
echo "1. Test login at: https://auth.vyntrise.com"
echo "2. If still not working, run: ./diagnose-production.sh"
echo "3. Check logs: docker compose logs backend -f"
echo "=========================================="
