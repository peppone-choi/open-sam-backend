# 백엔드 시작 가이드

## ✅ 완료된 작업

1. **모든 API 라우터 마운트 완료** (24개)
   - P0 (Critical): 4개 - auth, command, nation, nation-command
   - P1 (High): 7개 - session, game, global, general, troop, battle, battlemap
   - P2 (Medium): 7개 - auction, betting, message, vote, inheritance, inheritaction, misc
   - P3 (Low): 6개 - admin, game-sessions, v2 APIs

2. **엔드포인트 활성화**
   - ✅ /api/auth/* - 인증 (로그인/회원가입)
   - ✅ /api/command/* - 명령 시스템
   - ✅ /api/nation/* - 국가 시스템
   - ✅ 그 외 21개 라우터

## 🚀 빠른 시작

### 1. 환경 변수 설정

```bash
cd /mnt/e/opensam/open-sam-backend
cp .env.example .env
```

`.env` 파일 수정:
```bash
# MongoDB 연결 (필수)
MONGODB_URI=mongodb://localhost:27017/sangokushi

# Redis 연결 (필수)
REDIS_URL=redis://localhost:6379

# 서버 식별자
SERVER_ID=sangokushi_default
SERVER_NAME=OpenSAM
SERVER_HIDDEN_SEED=opensam_hidden_seed
SERVER_SEASON_INDEX=0
SESSION_IDENTITY_CACHE_TTL=600

# 세션 스토어 설정
SESSION_STORE=redis # redis 또는 mongo
SESSION_COLLECTION=sessions
SESSION_COOKIE_MAX_AGE=86400000
SESSION_TTL_SECONDS=86400
SESSION_REDIS_PREFIX=opensam:sess:
SESSION_COOKIE_NAME=opensam.sid
SESSION_DISABLE_PERSISTENCE=false
SESSION_AUTOREMOVE_INTERVAL=10
SESSION_MONGO_URI=

# JWT 시크릿 (필수)
JWT_SECRET=your-secret-key-here
```


### 2. 의존성 설치

```bash
npm install
```

### 3. 서버 시작

#### Development Mode (권장)
```bash
# API Server
npm run dev

# 새 터미널에서 Game Daemon
npm run dev:daemon
```

#### Production Mode
```bash
# 빌드
npm run build

# API Server
npm start

# 새 터미널에서 Game Daemon
npm run start:daemon
```

### 4. 엔드포인트 테스트

```bash
# 전체 엔드포인트 테스트
./test-endpoints.sh

# 또는 수동으로
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/login -X POST
curl http://localhost:3000/api/nation/list
```

## 📊 서버 구조

```
┌─────────────────────────────────────────┐
│         API Server (port 3000)          │
│                                         │
│  ├─ P0: /api/auth/*                    │
│  ├─ P0: /api/command/*                 │
│  ├─ P0: /api/nation/*                  │
│  ├─ P1: /api/game/*                    │
│  ├─ P1: /api/general/*                 │
│  └─ ... (24 routes total)              │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│          Redis (port 6379)              │
│  - Game STATE (실시간)                  │
│  - Command Queue (CQRS)                 │
│  - 3-Layer Cache (L2)                   │
└─────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│        MongoDB (port 27017)             │
│  - Persistence (히스토리)                │
│  - Command History                      │
│  - Turn Snapshots                       │
└─────────────────────────────────────────┘
```

## 🎮 게임 데몬

```bash
npm run dev:daemon
```

**역할:**
- Redis Stream에서 Command 소비
- Command 실행 (단일 Writer)
- 게임 상태 업데이트 (Redis)
- MongoDB에 Persist (비동기)

## 🧪 테스트

### Health Check
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"..."}
```

### 인증 테스트
```bash
# 회원가입
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### Command 테스트
```bash
# 명령 제출 (인증 필요)
curl -X POST http://localhost:3000/api/command/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type":"TRAIN_SOLDIER","generalId":1,"arg":{"amount":100}}'
```

## 📝 로그

서버 시작 시 다음 정보가 표시됩니다:

```
✅ All API routes mounted successfully
📍 Total routes: 24
   P0 (Critical): 4 routes
   P1 (High): 7 routes
   P2 (Medium): 7 routes
   P3 (Low): 6 routes

🚀 서버가 성공적으로 시작되었습니다!
📍 포트: 3000
🌍 환경: development
🎮 커맨드: 97개 (General: 55, Nation: 38)
```

## 🔧 문제 해결

### MongoDB 연결 실패
```
Error: MongoDB 연결 실패
```
**해결:** MongoDB가 실행 중인지 확인
```bash
# MongoDB 시작 (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# 또는 로컬 설치
sudo systemctl start mongod
```

### Redis 연결 실패
```
Error: Redis 연결 시간 초과
```
**해결:** Redis가 실행 중인지 확인
```bash
# Redis 시작 (Docker)
docker run -d -p 6379:6379 --name redis redis:latest

# 또는 로컬 설치
sudo systemctl start redis
```

### Port 3000 이미 사용 중
```
Error: listen EADDRINUSE: address already in use :::3000
```
**해결:** .env 파일에서 PORT 변경
```bash
PORT=3001
```

## 🎯 다음 단계

1. ✅ **백엔드 완료** - 모든 엔드포인트 활성화됨
2. ⏭️ **프론트엔드 연결** - open-sam-front와 API 통합
3. ⏭️ **GameStateManager 구현** - Redis State 관리
4. ⏭️ **Turn Processor 완성** - 턴 시스템 작동

## 📚 참고 문서

- [BACKEND_ARCHITECTURE_ANALYSIS.md](./BACKEND_ARCHITECTURE_ANALYSIS.md) - 아키텍처 상세
- [BACKEND_CRITICAL_ISSUES.md](../BACKEND_CRITICAL_ISSUES.md) - 해결된 이슈
- [README.md](./README.md) - 프로젝트 개요

---

**작성자:** AI Assistant  
**작성일:** 2025-11-01  
**상태:** ✅ Ready for Development
