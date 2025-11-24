#!/bin/bash

# Manual Validation Testing Script
# Tests NoSQL injection prevention and input validation

API_URL="http://localhost:8080"
TOKEN="" # Add your JWT token here

echo "=========================================="
echo "NoSQL Injection Validation Tests"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -e "${YELLOW}Test: $name${NC}"
    echo "Endpoint: $method $endpoint"
    echo "Data: $data"
    
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$data")
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
    fi
    echo "Response: $body"
    echo "=========================================="\n
}

echo "1. Testing Admin Routes - Valid Input"
echo "----------------------------------------"
test_endpoint \
    "Valid penalty level" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": 1001, "penaltyLevel": 5}' \
    "200"

echo "2. Testing Admin Routes - MongoDB Injection"
echo "--------------------------------------------"
test_endpoint \
    "MongoDB \$gt operator injection" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": {"$gt": 0}, "penaltyLevel": 5}' \
    "400"

test_endpoint \
    "MongoDB \$ne operator injection" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": 1001, "penaltyLevel": {"$ne": null}}' \
    "400"

test_endpoint \
    "MongoDB \$or operator injection" \
    "POST" \
    "/api/admin/general" \
    '{"generalID": {"$or": [{"data.no": 1}, {"data.no": 2}]}}' \
    "400"

echo "3. Testing Admin Routes - Invalid Types"
echo "----------------------------------------"
test_endpoint \
    "String instead of number" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": "not-a-number", "penaltyLevel": 5}' \
    "400"

test_endpoint \
    "Object instead of number" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": {"value": 1001}, "penaltyLevel": 5}' \
    "400"

echo "4. Testing Admin Routes - Range Validation"
echo "-------------------------------------------"
test_endpoint \
    "Penalty level too high" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": 1001, "penaltyLevel": 99}' \
    "400"

test_endpoint \
    "Negative general number" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": -1, "penaltyLevel": 5}' \
    "400"

test_endpoint \
    "Negative penalty level" \
    "POST" \
    "/api/admin/user/set-block" \
    '{"generalNo": 1001, "penaltyLevel": -1}' \
    "400"

echo "5. Testing LOGH Routes - Commander Validation"
echo "----------------------------------------------"
test_endpoint \
    "Valid commander number" \
    "GET" \
    "/api/logh/commanders/42" \
    "" \
    "200"

test_endpoint \
    "Invalid commander number" \
    "GET" \
    "/api/logh/commanders/not-a-number" \
    "" \
    "400"

echo "6. Testing Battle Routes - Battle ID Validation"
echo "------------------------------------------------"
test_endpoint \
    "Valid UUID battle ID" \
    "GET" \
    "/api/battle/550e8400-e29b-41d4-a716-446655440000" \
    "" \
    "200"

test_endpoint \
    "Invalid battle ID" \
    "GET" \
    "/api/battle/not-a-uuid" \
    "" \
    "400"

test_endpoint \
    "MongoDB injection in battle ID" \
    "GET" \
    "/api/battle/\$ne" \
    "" \
    "400"

echo "7. Testing Error Log Pagination"
echo "--------------------------------"
test_endpoint \
    "Valid pagination" \
    "POST" \
    "/api/admin/error-log" \
    '{"from": 0, "limit": 10}' \
    "200"

test_endpoint \
    "Pagination limit too high" \
    "POST" \
    "/api/admin/error-log" \
    '{"from": 0, "limit": 10000}' \
    "400"

test_endpoint \
    "Negative offset" \
    "POST" \
    "/api/admin/error-log" \
    '{"from": -10, "limit": 10}' \
    "400"

echo "8. Testing User ID Validation"
echo "------------------------------"
test_endpoint \
    "Valid MongoDB ObjectId" \
    "POST" \
    "/api/admin/update-user" \
    '{"userID": "507f1f77bcf86cd799439011", "action": "grade", "data": {"grade": 5}}' \
    "200"

test_endpoint \
    "Invalid ObjectId" \
    "POST" \
    "/api/admin/update-user" \
    '{"userID": "not-an-objectid", "action": "grade", "data": {"grade": 5}}' \
    "400"

test_endpoint \
    "MongoDB injection in userID" \
    "POST" \
    "/api/admin/update-user" \
    '{"userID": {"$ne": null}, "action": "grade", "data": {"grade": 5}}' \
    "400"

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Check the results above."
echo "Expected: Most tests should PASS with correct status codes"
echo "- Valid inputs: 200 OK"
echo "- Invalid inputs: 400 Bad Request"
echo "- MongoDB injections: 400 Bad Request"
echo ""
echo "If you see many FAILs, check:"
echo "1. Is the server running? (npm run dev:api)"
echo "2. Did you add a valid JWT token to this script?"
echo "3. Are the validation middleware applied to routes?"
