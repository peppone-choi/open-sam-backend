#!/bin/bash

echo "🚀 OpenSAM Backend 개발 환경 시작"
echo "=================================="
echo ""

# 1. Docker 서비스 시작
echo "📦 Step 1: MongoDB & Redis 시작 중..."
docker-compose -f docker-compose.dev.yml up -d

# 2. 서비스 준비 대기
echo "⏳ Step 2: 서비스 준비 대기 (5초)..."
sleep 5

# 3. 연결 확인
echo "🔍 Step 3: 연결 확인 중..."
echo ""

# MongoDB 확인
if docker exec opensam-mongodb mongosh --eval "db.runCommand({ ping: 1 })" > /dev/null 2>&1; then
    echo "✅ MongoDB: 연결 성공 (port 27017)"
else
    echo "❌ MongoDB: 연결 실패"
fi

# Redis 확인
if docker exec opensam-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 연결 성공 (port 6379)"
else
    echo "❌ Redis: 연결 실패"
fi

echo ""
echo "=================================="
echo "✨ 개발 환경 준비 완료!"
echo ""
echo "다음 명령어로 서버를 시작하세요:"
echo "  npm run dev          # API Server"
echo "  npm run dev:daemon   # Game Daemon"
echo ""
echo "서비스 중지:"
echo "  docker-compose -f docker-compose.dev.yml down"
echo ""
