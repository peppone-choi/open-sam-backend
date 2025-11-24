#!/bin/bash

echo "==================================="
echo "Rate Limiting Implementation Check"
echo "==================================="
echo ""

echo "1. Checking if express-rate-limit is installed..."
if grep -q "express-rate-limit" package.json; then
  echo "✅ express-rate-limit found in package.json"
  VERSION=$(grep "express-rate-limit" package.json | head -1 | sed 's/.*: "//;s/".*//')
  echo "   Version: $VERSION"
else
  echo "❌ express-rate-limit NOT found in package.json"
fi
echo ""

echo "2. Checking rate-limit middleware file..."
if [ -f "src/middleware/rate-limit.middleware.ts" ]; then
  echo "✅ Rate limit middleware file exists"
  echo "   Contains:"
  grep "export const" src/middleware/rate-limit.middleware.ts | sed 's/^/   - /'
else
  echo "❌ Rate limit middleware file NOT found"
fi
echo ""

echo "3. Checking server.ts integration..."
if grep -q "globalLimiter" src/server.ts; then
  echo "✅ Rate limiter imported in server.ts"
  echo "   Usage count: $(grep -c "globalLimiter" src/server.ts)"
else
  echo "❌ Rate limiter NOT imported in server.ts"
fi
echo ""

echo "4. Checking server-minimal.ts integration..."
if grep -q "globalLimiter" src/server-minimal.ts; then
  echo "✅ Rate limiter imported in server-minimal.ts"
  echo "   Usage count: $(grep -c "globalLimiter" src/server-minimal.ts)"
else
  echo "❌ Rate limiter NOT imported in server-minimal.ts"
fi
echo ""

echo "5. Checking auth.routes.ts protection..."
if grep -q "authLimiter" src/routes/auth.routes.ts; then
  echo "✅ Auth limiter applied to auth.routes.ts"
  echo "   Protected endpoints:"
  grep -n "authLimiter" src/routes/auth.routes.ts | sed 's/^/   Line /'
else
  echo "❌ Auth limiter NOT applied to auth.routes.ts"
fi
echo ""

echo "6. Checking gateway.routes.ts protection..."
if grep -q "authLimiter" src/routes/gateway.routes.ts; then
  echo "✅ Auth limiter applied to gateway.routes.ts"
  echo "   Protected endpoints:"
  grep -n "authLimiter" src/routes/gateway.routes.ts | sed 's/^/   Line /'
else
  echo "❌ Auth limiter NOT applied to gateway.routes.ts"
fi
echo ""

echo "==================================="
echo "Implementation Summary"
echo "==================================="
echo ""
echo "Protected Endpoints:"
echo "  - POST /api/auth/login (5 req/15min)"
echo "  - POST /api/auth/register (5 req/15min)"
echo "  - POST /api/gateway/change-password (5 req/15min)"
echo ""
echo "Global Rate Limit: 1000 req/15min"
echo ""
