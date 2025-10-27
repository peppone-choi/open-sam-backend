# Battle 시스템 Entity 마이그레이션 완료

## 개요
battle/ 폴더의 모든 파일을 Entity 시스템 기반으로 완전히 수정 완료

## 수정된 파일

### 1. 타입 정의 (`@types/battle.types.ts`)
- ✅ `generalId` → `commanderId`로 변경
- ✅ `attackerGenerals` → `attackerCommanders`로 변경
- ✅ `defenderGenerals` → `defenderCommanders`로 변경
- ✅ `capturedGenerals` → `capturedCommanders`로 변경
- ✅ `killedGenerals` → `killedCommanders`로 변경
- ✅ `IBattleUnit` 주석 업데이트 (Entity ID 명시)

### 2. BattleService (`service/battle.service.ts`)
#### Entity 기반 병력 관리
- ✅ `EntityRepository` import 및 사용
- ✅ Entity의 `resources.crew_total`, `resources.crew_reserved` 사용
- ✅ Entity의 `attributes` 사용 (attack, defense, speed)
- ✅ Entity의 `resources.crewType`, `resources.morale` 사용

#### Lua 스크립트 연동
- ✅ `reserveTroops()`: 병력 예약 시 Lua 스크립트 호출
- ✅ `applyBattleCasualties()`: 전투 종료 시 Lua 스크립트 호출
- ✅ Entity 키 생성 (`s:${sessionId}:entity:${commanderId}`)

#### 전사 처리
- ✅ 병력 0인 지휘관 Entity의 `metadata.status`를 'dead'로 변경
- ✅ `EntityRepository.patch()` 사용하여 낙관적 잠금 적용

#### 메서드 이름 변경
- ✅ `findByGeneralId()` → `findByCommanderId()`

### 3. BattleEngine (`engine/battle-engine.ts`)
#### Entity 기반 유닛 관리
- ✅ `EntityRepository` import
- ✅ Entity 속성 기반 전투 수치 계산
- ✅ `troops_current` 감소 처리

#### 웹소켓 이벤트
- ✅ `BATTLE_TICK`: 유닛 상태 전송
- ✅ `UNIT_DAMAGED`: 피해 이벤트
- ✅ `GENERAL_KIA`: 전사 이벤트 (commanderId 사용)
- ✅ `BATTLE_FINALIZED`: 전투 종료 이벤트

#### 전투 로직
- ✅ `attackerCommanders`, `defenderCommanders` 사용
- ✅ `findNearbyEnemies()`: commanderId 기반 적군 판별

### 4. BattleRepository (`repository/battle.repository.ts`)
#### Redis 기반 Repository
- ✅ `findByCommanderId()`: 지휘관 ID로 전투 조회
- ✅ `findActive()`: 진행 중인 전투 조회 (PREPARING, IN_PROGRESS)
- ✅ `findById()`: 전투 ID로 조회
- ✅ `save()`: 전투 저장 (1시간 TTL)
- ✅ `delete()`: 전투 삭제
- ✅ `findAll()`: 세션의 모든 전투 조회
- ✅ `findByTargetCity()`: 도시 ID로 전투 조회

### 5. BattleController (`controller/battle.controller.ts`)
- ✅ 쿼리 파라미터: `generalId` → `commanderId`
- ✅ `findByCommanderId()` 호출
- ✅ 응답 추가 (`res.json(battles)`)

### 6. Model (`model/battle-session.model.ts`)
- ✅ Schema 필드명 변경:
  - `attackerGenerals` → `attackerCommanders`
  - `defenderGenerals` → `defenderCommanders`
  - `capturedGenerals` → `capturedCommanders`
  - `killedGenerals` → `killedCommanders`

### 7. BattleUnitModel (`model/battle-unit.model.ts`)
- ✅ `commanderId` 필드 사용 (이미 적용됨)
- ✅ `troops_reserved`, `troops_current` 필드 유지

## Entity 통합 포인트

### 1. Entity 조회
```typescript
const parts = commanderId.split(':');
const scenario = parts[0];
const role = parts[1] as any;
const id = parts[2];

const entity = await EntityRepository.findById({ scenario, role, id });
```

### 2. Entity 속성 사용
```typescript
// 병력 정보
crewTotal = entity.resources?.crew_total || 0
crewReserved = entity.resources?.crew_reserved || 0

// 병종
unitType = entity.resources?.crewType || 0

// 전투 능력치
attack = entity.attributes?.attack || 100
defense = entity.attributes?.defense || 100
speed = entity.attributes?.speed || 10
morale = entity.resources?.morale || 100
```

### 3. Lua 스크립트 연동
```typescript
// 병력 예약
await client.evalsha(
  luaScriptSha,
  1,
  entityKey,  // s:${sessionId}:entity:${commanderId}
  'reserve',
  battleId,
  amount.toString()
);

// 병력 정산
await client.evalsha(
  luaScriptSha,
  1,
  entityKey,
  'finalize',
  battleId,
  casualties.toString()
);
```

### 4. Entity 업데이트 (전사 처리)
```typescript
await EntityRepository.patch(
  { scenario, role, id },
  { 'metadata.status': 'dead' },
  entity.version  // 낙관적 잠금
);
```

## 주요 변경 사항 요약

| 변경 전 | 변경 후 | 위치 |
|---------|---------|------|
| `generalId` | `commanderId` | 모든 파일 |
| `attackerGenerals` | `attackerCommanders` | IBattleSession, Model |
| `defenderGenerals` | `defenderCommanders` | IBattleSession, Model |
| MongoDB 직접 조회 | EntityRepository 사용 | BattleService |
| 하드코딩 속성값 | Entity 속성 동적 조회 | BattleService |
| - | Lua 스크립트 병력 예약/정산 | BattleService |
| - | 웹소켓 이벤트 발행 | BattleEngine |

## TODO 항목

1. **commanderId 포맷 표준화**
   - 현재: 문자열 split 방식
   - 개선: `gid()`, `parseGid()` 유틸 함수 사용

2. **국가 ID 조회**
   - Entity의 Edge를 통해 FACTION 조회 필요
   - `attackerNationId`, `defenderNationId` 자동 설정

3. **수비 지휘관 자동 배치**
   - 공격 대상 도시의 수비 지휘관 자동 선정 로직

4. **초기 배치 로직**
   - BattleUnit의 position 초기값 알고리즘
   - 공격군/수비군 위치 분리

5. **Lua 스크립트 파일**
   - `infrastructure/lua/battle-reservation.lua` 구현 확인
   - reserve, finalize 함수 검증

## 빌드 상태
- ✅ battle/ 폴더 타입 에러 없음
- ✅ Entity 기반 병력 관리 완료
- ✅ Lua 스크립트 연동 준비 완료

## 테스트 필요 항목
1. Entity 조회 및 속성 접근
2. Lua 스크립트 병력 예약/정산
3. 전사 처리 및 Entity 업데이트
4. 웹소켓 이벤트 발행
5. BattleEngine 전투 로직
