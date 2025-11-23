# 캐시 구조와 데이터 모델 호환성 분석 (Session 11)

**작성일**: 2025-11-23  
**목적**: Session/Nation/General 데이터 모델과 캐시 시스템의 궁합 점검 및 문제점 도출

---

## 📊 현재 캐시 아키텍처

### 3단계 캐싱 시스템

```
L1 (메모리) → L2 (Redis) → L3 (MongoDB)
   ↓             ↓             ↓
  3초 TTL     360초 TTL      영구 저장
```

### CQRS 패턴

- **Query (읽기)**: L1 → L2 → DB 순서 (캐시 미스 시만 DB 접근)
- **Command (쓰기)**: Redis L2 → sync-queue → 데몬이 5초마다 DB 동기화

---

## 🔴 발견된 주요 문제점

### 1. **Session 모델 필드 불일치 (CRITICAL)**

#### 문제: 중복 필드 정의
- `session.model.ts`에 정의된 필드:
  ```typescript
  turn_config?: { default_hour, default_minute, allow_custom }
  realtime_config?: { speed_multiplier }
  config?: Record<string, any>
  ```

- 실제 사용 사례:
  ```typescript
  // sessionState.service.ts
  sessionData.is_locked
  sessionData.isunited
  sessionData.online_user_cnt
  sessionData.online_nation
  
  // scenario-reset.service.ts
  session.data.game_env.develcost
  session.data.game_env.isunited
  ```

#### 충돌 패턴:
1. **`config` vs `turn_config/realtime_config`**: 
   - 스키마에 `config: Record<string, any>` 있음
   - 동시에 `turn_config`, `realtime_config` 별도 필드 존재
   - **혼란**: 어디에 저장해야 하는지 불명확

2. **`isunited` 필드 3곳에 중복**:
   ```typescript
   sessionData.isunited           // 최상위
   sessionData.data.isunited      // data 내부
   sessionData.data.game_env.isunited  // game_env 내부
   ```
   - `routes/admin.routes.ts:289`에서 복잡한 폴백 로직 발견:
     ```typescript
     const isunited = gameEnv.isunited !== undefined 
       ? gameEnv.isunited 
       : (sessionData.isunited !== undefined ? sessionData.isunited : 0);
     ```

3. **`develcost` 필드 중복**:
   ```typescript
   sessionData.develcost           // 최상위 (기본값 100)
   sessionData.data.game_env.develcost  // game_env 내부
   ```

#### 영향:
- **캐시 무효화 실패**: 업데이트 시 어떤 필드를 무효화할지 모름
- **데이터 불일치**: sync-queue에서 어떤 필드를 동기화할지 불명확
- **프론트엔드 혼란**: API가 반환하는 필드가 불일치

---

### 2. **Nation/General 모델의 이중 구조 (HIGH)**

#### 문제: 최상위 필드 vs `data` 필드

**Nation 모델**:
```typescript
{
  gold: number,           // 최상위
  rice: number,           // 최상위
  data: {
    gold?: number,        // data 내부에도 존재 가능
    rice?: number
  }
}
```

**General 모델**:
```typescript
{
  leadership: number,     // 최상위
  strength: number,
  nation: number,
  data: {
    leadership?: number,  // data 내부에도 존재 가능
    strength?: number,
    nation?: number
  }
}
```

#### 실제 사례:
```typescript
// general.repository.ts:69-74
General.findOne({
  session_id: sessionId,
  $or: [
    { 'data.no': generalId },    // data 내부 검색
    { no: generalId }             // 최상위 검색
  ]
})
```

#### 영향:
- **쿼리 성능 저하**: `$or` 연산자로 두 곳을 모두 검색
- **인덱스 비효율**: `data.no`는 인덱스 불가 (Mixed 타입)
- **캐시 키 충돌**: `general:byId:session:123`과 `general:byNo:session:123` 중복 관리

---

### 3. **Sync Queue의 Mongoose 내부 필드 제거 로직 (MEDIUM)**

#### 문제: sanitizeForSync 함수의 한계

```typescript
// model-cache.helper.ts:16-26
function sanitizeForSync(data: any): any {
  const cleaned = { ...data };
  delete cleaned.__v;
  delete cleaned._id;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  return cleaned;
}
```

#### 문제점:
1. **얕은 복사**: `data.data` 내부의 Mongoose 필드는 제거 안 됨
2. **타입 불일치**: MongoDB Document → Plain Object 변환 시 메서드 손실
3. **TTL 24시간**: sync-queue 아이템이 24시간 유지되면 메모리 낭비

#### 실제 영향:
```typescript
// general이 Mongoose Document인 경우
general.getLeadership()  // 메서드 존재
↓ saveGeneral()
↓ sanitizeForSync()
↓ Redis 저장 (plain object)
↓ 캐시에서 조회
general.getLeadership()  // ❌ TypeError: not a function
```

---

### 4. **RootDB 의존성 미해결 (HIGH)**

#### 발견된 RootDB 참조:

1. **user.repository.ts**:
   ```typescript
   /**
    * RootDB의 member 테이블에 접근합니다.
    */
   ```

2. **AdjustIcon.service.ts**:
   ```typescript
   if (FeatureFlags.isRootDBEnabled()) {
     throw new Error({ reason: 'RootDB 연결이 필요합니다' });
   }
   ```

3. **KakaoUtil.ts**:
   ```typescript
   // const cnt = RootDB::db()->queryFirstField('SELECT count(no) FROM member WHERE `id` = %s LIMIT 1', usernameLower);
   ```

4. **AdminServerManagement.service.ts**:
   ```typescript
   // FUTURE: RootDB의 system 테이블에 저장
   ```

#### 문제:
- **기능 플래그만 존재**: `ROOTDB_ENABLED` 환경변수만 있고 실제 대체 구현 없음
- **하드코딩된 주석**: 주석 처리된 RootDB 쿼리가 여전히 존재
- **사용자 인증 불가**: RootDB 없이는 member 테이블 접근 불가

---

### 5. **캐시 무효화 패턴 불일치 (MEDIUM)**

#### 문제: 목록 캐시 무효화 누락

```typescript
// model-cache.helper.ts:165-166
await invalidateCache('general', sessionId, generalId, { targets: ['lists'] });
```

위 코드가 `saveGeneral`에서 호출되지만, 실제로는:

```typescript
// general.repository.ts:202
await this._invalidateListCaches(sessionId);
```

별도 메서드로 호출됨.

#### 중복 무효화:
1. `saveGeneral()` → `invalidateCache(..., { targets: ['lists'] })`
2. `generalRepository.create()` → `_invalidateListCaches()`

**결과**: 같은 캐시를 2번 무효화 → Redis 부하 증가

---

## 🎯 권장 해결 방안

### 1. Session 필드 정리 (우선순위: HIGH)

#### 방안 A: 단일 `data` 필드로 통일 (권장)

```typescript
export interface ISession extends Document {
  session_id: string;
  name: string;
  scenario_id?: string;
  status: 'preparing' | 'running' | 'paused' | 'finished' | 'united';
  
  // 모든 동적 필드는 data에 저장
  data: {
    // 게임 설정
    turn_config?: { default_hour, default_minute, allow_custom };
    realtime_config?: { speed_multiplier };
    
    // 게임 상태
    year: number;
    month: number;
    turn: number;
    turntime: Date;
    
    // 게임 환경
    game_env: {
      isunited: number;
      develcost: number;
      killturn: number;
    };
    
    // 잠금/온라인 상태
    is_locked: boolean;
    online_user_cnt: number;
    online_nation: number[];
    lastVote: number;
  };
}
```

**장점**:
- 필드 위치 명확 (항상 `data.xxx`)
- MongoDB 쿼리 단순화
- 캐시 무효화 단순화

**마이그레이션**:
```javascript
// scripts/migrate-session-fields.js
db.sessions.updateMany({}, [
  {
    $set: {
      'data.turn_config': '$turn_config',
      'data.realtime_config': '$realtime_config',
      'data.is_locked': { $ifNull: ['$is_locked', false] },
      'data.game_env.isunited': { 
        $ifNull: ['$isunited', { $ifNull: ['$data.game_env.isunited', 0] }] 
      },
      'data.game_env.develcost': { 
        $ifNull: ['$develcost', { $ifNull: ['$data.game_env.develcost', 100] }] 
      }
    }
  },
  {
    $unset: ['turn_config', 'realtime_config', 'is_locked', 'isunited', 'develcost']
  }
]);
```

#### 방안 B: 명시적 필드 분리 (보수적)

```typescript
export interface ISession extends Document {
  // 스키마 정의 필드 (인덱싱 가능)
  session_id: string;
  name: string;
  scenario_id?: string;
  status: string;
  is_locked: boolean;
  online_user_cnt: number;
  
  // 게임 설정 (중첩 객체)
  game_config: {
    mode: 'turn' | 'realtime';
    turn?: { default_hour, default_minute, allow_custom };
    realtime?: { speed_multiplier };
  };
  
  // 게임 환경 (PHP 호환)
  game_env: {
    isunited: number;
    develcost: number;
    year: number;
    month: number;
    turn: number;
  };
  
  // 동적 데이터 (나머지)
  data: Record<string, any>;
}
```

**장점**:
- 자주 조회되는 필드는 최상위 (인덱싱 가능)
- 명확한 구조
- PHP 코드와 호환성 유지

---

### 2. Nation/General 필드 통일 (우선순위: HIGH)

#### 규칙 수립:

**원칙**: **최상위 필드는 인덱싱용, `data`는 동적 데이터용**

```typescript
// General 모델
export interface IGeneral extends Document {
  // 인덱스 필드 (검색/정렬용)
  no: number;              // 인덱스
  session_id: string;      // 인덱스
  owner: string;           // 인덱스
  nation: number;          // 인덱스
  city: number;            // 인덱스
  
  // 동적 데이터 (게임 로직용)
  data: {
    name: string;
    leadership: number;
    strength: number;
    intel: number;
    gold: number;
    rice: number;
    crew: number;
    // ... 나머지 모든 게임 필드
  };
}
```

**마이그레이션**:
```javascript
// scripts/migrate-general-fields.js
db.generals.updateMany({}, [
  {
    $set: {
      // 최상위 인덱스 필드 설정
      no: { $ifNull: ['$no', '$data.no'] },
      nation: { $ifNull: ['$nation', '$data.nation'] },
      city: { $ifNull: ['$city', '$data.city'] },
      
      // data 필드로 통합
      'data.name': { $ifNull: ['$data.name', '$name'] },
      'data.leadership': { $ifNull: ['$data.leadership', '$leadership'] }
    }
  }
]);
```

---

### 3. Sync Queue 개선 (우선순위: MEDIUM)

#### 문제점:
- `sanitizeForSync`가 얕은 복사만 수행
- Mongoose Document → Plain Object 변환 불완전

#### 해결:

```typescript
// model-cache.helper.ts
function sanitizeForSync(data: any): any {
  if (!data) return data;
  
  // Mongoose Document인 경우 toObject() 사용
  let plain = data;
  if (typeof data.toObject === 'function') {
    plain = data.toObject();
  } else if (typeof data === 'object') {
    plain = JSON.parse(JSON.stringify(data)); // deep clone
  }
  
  // Mongoose 내부 필드 제거 (재귀적)
  const cleanObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const cleaned: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      // Mongoose 내부 필드 스킵
      if (key.startsWith('_') || key === '__v' || key === 'createdAt' || key === 'updatedAt') {
        continue;
      }
      
      // 재귀적으로 정리
      cleaned[key] = cleanObject(obj[key]);
    }
    return cleaned;
  };
  
  return cleanObject(plain);
}
```

---

### 4. RootDB 대체 구현 (우선순위: HIGH)

#### 현재 RootDB 기능:

1. **User/Member 관리** → MongoDB `users` 컬렉션으로 마이그레이션
2. **아이콘/패널티** → MongoDB `icons`, `penalties` 컬렉션
3. **Login Token** → Redis (휘발성 데이터)
4. **NPC 자동 실행/환생** → MongoDB `npc_configs` 컬렉션
5. **통계** → MongoDB `statistics` 컬렉션

#### 구현 계획:

```typescript
// models/user.model.ts (RootDB member → MongoDB users)
export interface IUser extends Document {
  user_id: string;       // RootDB의 id
  username: string;      // 닉네임
  password_hash: string; // bcrypt 해시
  email?: string;
  grade: number;         // 권한 등급
  kakao_id?: string;     // 카카오 연동
  created_at: Date;
  last_login?: Date;
}

// repositories/user.repository.ts
class UserRepository {
  async findByUsername(username: string) {
    return User.findOne({ user_id: username.toLowerCase() });
  }
  
  async createUser(data: any) {
    return User.create(data);
  }
}
```

#### 환경변수 설정:

```env
# RootDB 대체 모드 (기본: MongoDB 사용)
ROOTDB_ENABLED=false

# User 인증 방식
AUTH_MODE=mongodb  # mongodb | rootdb | hybrid
```

---

### 5. 캐시 무효화 패턴 통일 (우선순위: LOW)

#### 현재 문제:
- `saveGeneral()`과 `generalRepository.create()`에서 중복 무효화

#### 해결:

```typescript
// model-cache.helper.ts
export async function saveGeneral(sessionId: string, generalId: number, data: any) {
  // ... Redis 저장 로직
  
  // 목록 캐시 무효화는 repository에서만 수행
  // 여기서는 하지 않음 (중복 방지)
}

// general.repository.ts
async create(data: any) {
  // ... 생성 로직
  await saveGeneral(sessionId, generalId, data);
  
  // 목록 캐시 무효화 (한 곳에서만)
  await this._invalidateListCaches(sessionId);
}
```

---

## 📝 마이그레이션 스크립트 작성 계획

### 1. Session 필드 정리
```bash
npm run migrate:session-fields
```

### 2. Nation/General 필드 통일
```bash
npm run migrate:general-fields
npm run migrate:nation-fields
```

### 3. RootDB → MongoDB 마이그레이션
```bash
npm run migrate:rootdb-users
```

---

## 🔍 규칙 차이 비교 (PHP vs Node.js)

| 항목 | PHP (core/) | Node.js (open-sam-backend/) | 비고 |
|-----|-------------|----------------------------|------|
| **전투 시스템** | 고정 맵 + 턴제 | 40x40 좌표 기반 실시간 | 완전히 다름 |
| **데이터 구조** | MySQL RootDB + 세션DB | MongoDB + Redis | 스키마 차이 |
| **캐시 전략** | PHP APC/Memcached | L1(메모리) + L2(Redis) | Node.js가 더 복잡 |
| **Session 필드** | `turn_config` 없음 | `turn_config`, `realtime_config` 분리 | Node.js 확장됨 |
| **isunited 위치** | 최상위 | 최상위 + data + game_env | 중복 심함 |
| **General 능력치** | 최상위 | 최상위 + data 중복 | 통일 필요 |

---

## ✅ 다음 단계 (Session 11 작업)

1. ✅ **캐시 구조 분석 완료**
2. ⏳ **Session 필드 정리 및 마이그레이션 스크립트 작성**
3. ⏳ **RootDB 기능 분석 및 대체 구현**
4. ⏳ **규칙 차이 비교 문서 작성**
5. ⏳ **API 스펙 업데이트 및 프론트엔드 UX 계획**

---

## 📌 결론

**현재 상태**: 캐시 시스템은 잘 설계되었으나, **데이터 모델과의 궁합이 맞지 않음**

**주요 문제**:
1. Session 필드 중복 (config, isunited, develcost)
2. Nation/General 이중 구조 (최상위 vs data)
3. Sync Queue의 얕은 복사
4. RootDB 의존성 미해결

**권장 사항**:
- **즉시 조치**: Session 필드 정리 (마이그레이션 스크립트 작성)
- **단기 조치**: Nation/General 필드 통일 규칙 수립
- **중기 조치**: RootDB 대체 구현 완료
- **장기 조치**: 캐시 무효화 패턴 최적화
