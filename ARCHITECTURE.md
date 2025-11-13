# OpenSAM Backend Architecture

## 🏗️ 구조 개요

OpenSAM 백엔드는 **API 서버**와 **게임 데몬**으로 분리되어 있습니다.

```
┌─────────────────┐         ┌─────────────────┐
│   API Server    │         │  Game Daemon    │
│   (server.ts)   │         │(daemon-unified) │
├─────────────────┤         ├─────────────────┤
│ • HTTP API      │         │ • Turn Process  │
│ • Socket.IO     │◄───────►│ • Command Exec  │
│ • Auth/Session  │  Redis  │ • Auction/Tour  │
│ • Queue Push    │  Queue  │ • NPC Auto      │
└─────────────────┘         └─────────────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
         ┌───────────────────────┐
         │   MongoDB + Redis     │
         └───────────────────────┘
```

---

## 🚀 실행 방법

### 1단계: 의존성 설치
```bash
npm install
```

### 2단계: 환경변수 설정
```bash
cp .env.example .env
# .env 파일 수정
```

### 3단계: MongoDB 및 Redis 시작
```bash
# MongoDB (기본 포트: 27017)
mongod

# Redis (기본 포트: 6379)
redis-server
```

### 4단계: 서버 실행

**개발 모드**
```bash
# 터미널 1: API 서버
npm run dev

# 터미널 2: 게임 데몬
npm run dev:daemon
```

**프로덕션 모드**
```bash
# 빌드
npm run build

# 터미널 1: API 서버
npm run start

# 터미널 2: 게임 데몬
npm run start:daemon
```

---

## 📦 역할 분담

### API 서버 (`src/server.ts`)

**책임**:
- HTTP 요청 처리 (Express)
- 실시간 통신 (Socket.IO)
- 인증/세션 관리
- 커맨드를 Redis Queue에 전달

**처리하지 않음**:
- ❌ 턴 처리
- ❌ 커맨드 실행
- ❌ 게임 로직

**포트**: 8080 (기본값)

---

### 게임 데몬 (`src/daemon-unified.ts`)

**책임**:
- 턴 스케줄링 (10초마다)
- 커맨드 소비 및 실행 (Redis Streams)
- 경매 종료 처리 (매분)
- 토너먼트 진행 (매분)
- NPC 자동 명령 (5분마다)
- DB 동기화 (5초마다)

**처리하지 않음**:
- ❌ HTTP 요청
- ❌ Socket.IO 통신

**스케줄러**:
| 작업 | 주기 | Cron 표현식 |
|------|------|-------------|
| 턴 처리 | 10초 | `*/10 * * * * *` |
| 커맨드 소비 | 1초 | `* * * * * *` |
| 경매 처리 | 1분 | `* * * * *` |
| 토너먼트 | 1분 | `* * * * *` |
| NPC 명령 | 5분 | `*/5 * * * *` |
| DB 동기화 | 5초 | `*/5 * * * * *` |

---

## 🔄 커맨드 실행 흐름

```
1. 유저가 API 요청
   ↓
2. API 서버가 커맨드를 Redis Queue에 Push
   ↓
3. 게임 데몬이 Queue에서 커맨드 Consume
   ↓
4. 커맨드 실행 (CommandExecutor)
   ↓
5. 결과를 DB에 저장
   ↓
6. Socket.IO로 클라이언트에 알림 (선택적)
```

---

## 🛠️ 개발 가이드

### 새로운 커맨드 추가

1. `src/commands/general/` 또는 `src/commands/nation/`에 커맨드 파일 생성
2. `BaseCommand`를 상속받아 구현
3. `initWithArg()` - 동기 함수로 제약조건 설정
4. `execute()` - 실제 로직 구현
5. barrel export (`index.ts`)에 추가
6. **재시작 필요**: 게임 데몬만 재시작하면 됨 (API 서버 재시작 불필요)

### API 엔드포인트 추가

1. `src/routes/`에 라우터 파일 생성
2. `src/server.ts`에 라우터 등록
3. **재시작 필요**: API 서버만 재시작하면 됨 (데몬 재시작 불필요)

---

## ⚠️ 주의사항

### 반드시 두 프로세스 모두 실행

- API 서버만 실행하면: 커맨드가 Queue에 쌓이기만 하고 실행되지 않음
- 데몬만 실행하면: HTTP 요청을 받을 수 없음

### 커맨드 초기화

- `CommandRegistry.loadAll()`은 **데몬에서만** 호출됨
- API 서버는 커맨드를 로드하지 않음 (속도 향상)

### 세션 초기화

- 현재 세션 자동 초기화는 비활성화됨
- 필요시 수동으로 초기화: `/api/admin/init` 엔드포인트 호출

---

## 📝 환경 변수

```env
# Server
PORT=8080
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/sangokushi

# Redis
REDIS_URL=redis://localhost:6379

# Session
DEFAULT_SESSION_ID=sangokushi_default
DEFAULT_SCENARIO_NUMBER=1010

# Daemon Control (선택적)
ENABLE_UNIFIED_DAEMON=false  # API 서버에서 데몬 자동 시작 방지
```

---

## 🐛 트러블슈팅

### "Port 8080 already in use"
```bash
# 기존 프로세스 확인
lsof -i :8080

# 프로세스 종료
kill -9 <PID>
```

### "Redis connection failed"
```bash
# Redis 실행 확인
redis-cli ping
# PONG이 출력되어야 함

# Redis 시작
redis-server
```

### "MongoDB connection timeout"
```bash
# MongoDB 실행 확인
mongo --eval "db.adminCommand('ping')"

# MongoDB 시작
mongod --dbpath /path/to/data
```

### 커맨드가 실행되지 않음
- 게임 데몬이 실행 중인지 확인: `ps aux | grep daemon-unified`
- Redis Queue 확인: `redis-cli XLEN game:commands`

---

## 📚 관련 문서

- [AGENTS.md](./AGENTS.md) - 코딩 가이드라인
- [package.json](./package.json) - NPM 스크립트 목록
- API 문서: http://localhost:8080/api-docs (서버 실행 후)
