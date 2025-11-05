# TypeScript Build Fixes

## 🔧 수정된 타입 에러

### 1. Redis Client 타입 에러 (48개 에러)

**문제:**
```
error TS2742: The inferred type of 'redis' cannot be named without a reference to '.pnpm/@redis+client@5.9.0/node_modules/@redis/client'
error TS7056: The inferred type of this node exceeds the maximum length the compiler will serialize
```

**원인:**
- pnpm의 node_modules 구조 때문에 타입 추론 경로가 복잡해짐
- Redis client의 복잡한 타입 구조 때문에 명시적 타입 필요

**해결:**
```typescript
// Before (src/config/redis.ts:3)
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// After
import { createClient, RedisClientType } from 'redis';

export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
}) as RedisClientType;

export const redisClient: RedisClientType = redis;
```

### 2. Repository Delete 메서드 타입 에러 (6개 파일)

**문제:**
```
error TS2742: The inferred type of 'deleteById' cannot be named without a reference to '.pnpm/mongodb@6.20.0/node_modules/mongodb'
```

**원인:**
- MongoDB의 DeleteResult 타입을 명시하지 않아 pnpm 경로 추론 실패

**해결:**

#### city.repository.ts
```typescript
import { City } from '../models/city.model';
import { DeleteResult } from 'mongodb';  // ✅ 추가

async deleteById(cityId: string): Promise<DeleteResult> {  // ✅ 타입 명시
  return City.deleteOne({ _id: cityId });
}
```

#### command.repository.ts
```typescript
import { Command } from '../models/command.model';
import { DeleteResult } from 'mongodb';  // ✅ 추가

async deleteById(commandId: string): Promise<DeleteResult> {
  return Command.deleteOne({ _id: commandId });
}

async deleteBySession(sessionId: string): Promise<DeleteResult> {
  return Command.deleteMany({ session_id: sessionId });
}
```

#### general.repository.ts
```typescript
import { General } from '../models/general.model';
import { DeleteResult } from 'mongodb';  // ✅ 추가

async deleteById(generalId: string): Promise<DeleteResult> {
  return General.deleteOne({ _id: generalId });
}
```

#### nation.repository.ts
```typescript
import { Nation } from '../models/nation.model';
import { DeleteResult } from 'mongodb';  // ✅ 추가

async deleteById(nationId: string): Promise<DeleteResult> {
  return Nation.deleteOne({ _id: nationId });
}

async deleteBySession(sessionId: string): Promise<DeleteResult> {
  return Nation.deleteMany({ session_id: sessionId });
}
```

#### session.repository.ts
```typescript
import { Session } from '../models/session.model';
import { DeleteResult } from 'mongodb';  // ✅ 추가

async deleteBySessionId(sessionId: string): Promise<DeleteResult> {
  return Session.deleteOne({ session_id: sessionId });
}
```

## 📊 수정 결과

### Before
- **에러 수**: 48개
- **빌드**: ❌ 실패

### After
- **에러 수**: 0개
- **빌드**: ✅ 성공
- **컴파일된 파일**: 52개

## 🔍 pnpm vs npm 차이점

### npm (node_modules 구조)
```
node_modules/
  redis/
    dist/
      ...
  mongodb/
    dist/
      ...
```

### pnpm (symlink 구조)
```
node_modules/
  .pnpm/
    redis@5.9.0/
      node_modules/
        redis/
          ...
    mongodb@6.20.0/
      node_modules/
        mongodb/
          ...
  redis -> .pnpm/redis@5.9.0/node_modules/redis
  mongodb -> .pnpm/mongodb@6.20.0/node_modules/mongodb
```

pnpm은 디스크 공간 절약을 위해 심볼릭 링크를 사용하는데, TypeScript가 타입 추론 시 이 긴 경로를 참조하려다가 에러 발생.

## ✅ Best Practice

### 1. 복잡한 타입은 항상 명시
```typescript
// ❌ Bad - 타입 추론에 의존
export const client = createClient({ ... });

// ✅ Good - 명시적 타입
export const client: RedisClientType = createClient({ ... });
```

### 2. MongoDB 반환 타입 명시
```typescript
// ❌ Bad
async deleteById(id: string) {
  return Model.deleteOne({ _id: id });
}

// ✅ Good
async deleteById(id: string): Promise<DeleteResult> {
  return Model.deleteOne({ _id: id });
}
```

### 3. pnpm 사용 시 주의사항
- 복잡한 타입 구조를 가진 패키지는 명시적 타입 필요
- `@types/*` 패키지가 있으면 반드시 설치
- tsconfig.json에서 `skipLibCheck: true` 고려 (하지만 권장하지 않음)

## 🚀 빌드 확인

```bash
# npm으로 빌드
npm run build

# pnpm으로 빌드 (Windows MINGW64에서 테스트 완료)
pnpm build

# 빌드 결과 확인
ls dist/ | wc -l  # 52 files
```

## 📝 관련 파일

- `src/config/redis.ts` - Redis client 타입 수정
- `src/repositories/city.repository.ts` - DeleteResult 타입 추가
- `src/repositories/command.repository.ts` - DeleteResult 타입 추가
- `src/repositories/general.repository.ts` - DeleteResult 타입 추가
- `src/repositories/nation.repository.ts` - DeleteResult 타입 추가
- `src/repositories/session.repository.ts` - DeleteResult 타입 추가
