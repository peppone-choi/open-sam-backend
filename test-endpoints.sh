#!/bin/bash

# 엔드포인트 테스트 스크립트
# Usage: ./test-endpoints.sh

BASE_URL="http://localhost:3000"
echo "🧪 Testing OpenSAM Backend Endpoints"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  
  printf "%-50s " "$description"
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
  else
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$path")
  fi
  
  if [ "$response" = "200" ] || [ "$response" = "201" ] || [ "$response" = "401" ] || [ "$response" = "400" ]; then
    echo -e "${GREEN}✓${NC} ($response)"
  else
    echo -e "${RED}✗${NC} ($response)"
  fi
}

echo "P0: Critical Routes"
echo "-------------------"
test_endpoint "GET"  "/health" "Health Check"
test_endpoint "POST" "/api/auth/login" "Auth: Login"
test_endpoint "POST" "/api/auth/register" "Auth: Register"
test_endpoint "GET"  "/api/command/list" "Command: List"
test_endpoint "GET"  "/api/nation/list" "Nation: List"

echo ""
echo "P1: High Priority Routes"
echo "------------------------"
test_endpoint "GET"  "/api/session/list" "Session: List"
test_endpoint "GET"  "/api/game/info" "Game: Info"
test_endpoint "GET"  "/api/global/constants" "Global: Constants"
test_endpoint "GET"  "/api/general/get-front-info" "General: Front Info"
test_endpoint "GET"  "/api/troop/list" "Troop: List"
test_endpoint "GET"  "/api/battle/list" "Battle: List"

echo ""
echo "P2: Medium Priority Routes"
echo "--------------------------"
test_endpoint "GET"  "/api/auction/list" "Auction: List"
test_endpoint "GET"  "/api/betting/list" "Betting: List"
test_endpoint "GET"  "/api/message/list" "Message: List"
test_endpoint "GET"  "/api/vote/list" "Vote: List"
test_endpoint "GET"  "/api/inheritance/points" "Inheritance: Points"

echo ""
echo "P3: Low Priority Routes"
echo "-----------------------"
test_endpoint "GET"  "/api/admin/status" "Admin: Status"
test_endpoint "GET"  "/api/game-sessions/list" "Game Sessions: List"
test_endpoint "GET"  "/api/v2/entities/general" "Entity v2: General"

echo ""
echo "======================================"
echo "Test complete!"
