#!/bin/bash
# Production Diagnostic Script for auth.vyntrise.com
# Run this on your production server

echo "=========================================="
echo "🔍 Vyntrise Auth Production Diagnostics"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found!"
    echo "Please run this from ~/vyntrise-auth directory"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

echo "1️⃣ Checking container status..."
echo "----------------------------------------"
docker compose ps
echo ""

echo "2️⃣ Checking backend container specifically..."
echo "----------------------------------------"
BACKEND_STATUS=$(docker inspect vyntrise-auth-backend --format='{{.State.Status}}' 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "Backend container status: $BACKEND_STATUS"
    if [ "$BACKEND_STATUS" != "running" ]; then
        echo "⚠️  Backend is not running!"
    fi
else
    echo "❌ Backend container not found!"
fi
echo ""

echo "3️⃣ Checking if backend is listening on port 3021..."
echo "----------------------------------------"
docker exec vyntrise-auth-backend netstat -tlnp 2>/dev/null | grep 3021 || echo "❌ Port 3021 not listening"
echo ""

echo "4️⃣ Testing backend health endpoint..."
echo "----------------------------------------"
docker exec vyntrise-auth-backend wget -qO- http://localhost:3021/api/health 2>/dev/null || echo "❌ Health check failed"
echo ""

echo "5️⃣ Checking database connection..."
echo "----------------------------------------"
POSTGRES_STATUS=$(docker inspect vyntrise-auth-db --format='{{.State.Status}}' 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "Postgres container status: $POSTGRES_STATUS"
    if [ "$POSTGRES_STATUS" = "running" ]; then
        docker exec vyntrise-auth-db pg_isready -U postgres || echo "❌ Postgres not ready"
    fi
else
    echo "❌ Postgres container not found!"
fi
echo ""

echo "6️⃣ Backend logs (last 50 lines)..."
echo "----------------------------------------"
docker compose logs backend --tail=50
echo ""

echo "7️⃣ Checking for errors in logs..."
echo "----------------------------------------"
echo "Recent errors:"
docker compose logs backend --tail=200 | grep -i "error\|exception\|fatal" | tail -10
echo ""

echo "8️⃣ Checking environment variables..."
echo "----------------------------------------"
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo "Checking critical variables (values hidden):"
    grep -q "DATABASE_URL" .env && echo "✅ DATABASE_URL present" || echo "❌ DATABASE_URL missing"
    grep -q "JWT_SECRET" .env && echo "✅ JWT_SECRET present" || echo "❌ JWT_SECRET missing"
    grep -q "JWT_REFRESH_SECRET" .env && echo "✅ JWT_REFRESH_SECRET present" || echo "❌ JWT_REFRESH_SECRET missing"
else
    echo "❌ .env file not found!"
fi
echo ""

echo "9️⃣ Checking nginx configuration..."
echo "----------------------------------------"
if command -v nginx &> /dev/null; then
    sudo nginx -t 2>&1 | tail -5
else
    echo "ℹ️  Nginx not found (might be in Docker)"
fi
echo ""

echo "🔟 Network connectivity test..."
echo "----------------------------------------"
echo "Testing backend from nginx/host:"
curl -f --max-time 5 http://localhost:3021/api/health 2>/dev/null && echo "✅ Backend reachable" || echo "❌ Backend not reachable"
echo ""

echo "=========================================="
echo "📊 Summary & Recommendations"
echo "=========================================="

# Determine the issue
BACKEND_RUNNING=$(docker inspect vyntrise-auth-backend --format='{{.State.Status}}' 2>/dev/null)

if [ "$BACKEND_RUNNING" != "running" ]; then
    echo ""
    echo "🔴 CRITICAL: Backend container is not running!"
    echo ""
    echo "Recommended actions:"
    echo "1. Check why it stopped:"
    echo "   docker compose logs backend --tail=100"
    echo ""
    echo "2. Try restarting:"
    echo "   docker compose restart backend"
    echo ""
    echo "3. If restart fails, check database:"
    echo "   docker compose logs postgres --tail=50"
    echo "   docker compose restart postgres"
    echo "   docker compose restart backend"
else
    echo ""
    echo "🟡 Backend is running but not responding"
    echo ""
    echo "Recommended actions:"
    echo "1. Check if it's stuck on startup (look for startup logs above)"
    echo ""
    echo "2. Try restarting backend:"
    echo "   docker compose restart backend"
    echo "   docker compose logs backend -f"
    echo ""
    echo "3. If database connection is the issue:"
    echo "   docker exec vyntrise-auth-backend npx prisma migrate status"
    echo ""
    echo "4. Last resort - full restart:"
    echo "   docker compose down"
    echo "   docker compose up -d"
fi

echo ""
echo "=========================================="
echo "✅ Diagnostic complete!"
echo "=========================================="
