# OpenSAM Backend

삼국지 기반 전략 시뮬레이션 게임 백엔드 서버

## 🚀 Quick Start

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 데몬 서버 시작 (턴 처리)
npm run dev:daemon
```

## 📁 프로젝트 구조

```
src/
├── api/              - API 계층 (통합 API)
├── commands/         - 게임 명령 구현체
├── common/           - 공통 모듈
├── config/           - 설정 파일
├── core/             - 핵심 엔진 (전투, 명령)
├── daemon/           - 백그라운드 데몬
├── models/           - Mongoose 모델 (44개)
├── repositories/     - 데이터 접근 레이어
├── routes/           - Express 라우터
├── services/         - 비즈니스 로직
└── utils/            - 유틸리티 함수

config/
└── scenarios/        - 게임 시나리오 데이터
    └── sangokushi/   - 삼국지 시나리오
        ├── data/     - 도시, 아이템, 병과 등
        └── scenario.json
```

## 📚 문서

- [데이터베이스 스키마](./docs/DATABASE_SCHEMA.md)
- [백엔드 아키텍처](./docs/BACKEND_ARCHITECTURE_ANALYSIS.md)
- [게임 로직 플로우](./docs/GAME_LOGIC_FLOW.md)
- [API 통합 리포트](./docs/API_UNIFICATION_REPORT.md)
- [마이그레이션 가이드](./docs/MIGRATION_GUIDE.md)
- [API 문서](./docs/API_DOCUMENTATION.md)
- [Swagger 설정](./docs/SWAGGER_SETUP.md)
- [시작 가이드](./docs/START_BACKEND.md)

## 🛠️ 기술 스택

- **Runtime**: Node.js v22+
- **Framework**: Express.js
- **Database**: MongoDB + Redis
- **ORM**: Mongoose
- **Language**: TypeScript
- **API Doc**: Swagger/OpenAPI

## 🎮 주요 기능

- 턴제 전략 게임 엔진
- 실시간 전투 시스템
- 명령 시스템 (장수/국가 명령)
- 시나리오 기반 게임 세션 관리
- RESTful API + WebSocket

## 🔧 환경 설정

`.env` 파일 생성:
```env
NODE_ENV=development
PORT=8080
MONGODB_URI=mongodb://localhost:27017/sangokushi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

## 📊 데이터 모델

**게임 엔티티**: General, Nation, City, Troop  
**시스템**: Session, Command, Battle  
**기능**: Message, Diplomacy, Auction, Vote, Betting  
**로그**: TurnRecord, WorldHistory, UserRecord

총 44개 모델

## 🔄 개발 워크플로우

1. **서버 시작**: `npm run dev`
2. **타입 체크**: `npm run typecheck`
3. **빌드**: `npm run build`
4. **프로덕션**: `npm start`

## 🌐 API 엔드포인트

- **Health Check**: `GET /health`
- **API Docs**: `GET /api-docs`
- **Sessions**: `/api/session`
- **Generals**: `/api/general`
- **Battles**: `/api/battle`
- **Messages**: `/api/message`

자세한 내용은 `/api-docs`에서 확인하세요.

## 📝 License

MIT
