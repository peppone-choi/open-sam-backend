# AGENTS.md - 삼국지 게임 백엔드 (Express.js)

## Build/Test Commands
```bash
npm run build          # TypeScript 컴파일
npm run dev           # 개발 서버 (ts-node)
npm test              # Jest 테스트 실행
npm run test:watch    # 테스트 Watch 모드
npm run lint          # ESLint
npm run typecheck     # TypeScript 타입 체크
```

## Architecture
- **Stack**: Node.js 20+ + Express.js + TypeScript + Prisma + PostgreSQL + Redis
- **Pattern**: CQRS + Single Writer + DDD + Event-Driven
- **Structure**: API Server (N instances, read-only) + Game Daemon (1 instance, single writer)
- **Cache**: 2-tier (node-cache L1 3s TTL + Redis L2)
- **Queue**: Redis Streams for commands (cmd:game)
- **Time**: 24x real-time (1 real hour = 1 game day)

## Code Style
- Use TypeScript with strict mode
- Follow DDD patterns: Aggregate Root, Value Objects, Repository
- Use Prisma for ORM, tsyringe for DI
- class-validator for DTOs
- Async/await over callbacks/promises chains
- No hardcoding: use DB entities (7 core: General, City, Nation, Battle, Command, Item, SpecialAbility)
- Error handling: throw domain errors, catch in middleware
