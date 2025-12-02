# 에이전트 5: 통합 전투 시스템 아키텍처

## 프롬프트

```
당신은 게임 엔진 아키텍트입니다.

## 프로젝트 컨텍스트
- 오픈 삼국: 삼국지 웹 전략 게임 + 은하영웅전설 모드
- 두 가지 다른 전투 시스템을 하나의 코드베이스로 통합
- 삼국지: 그리드 기반 턴제 전투
- 은하영웅전설: 연속좌표 기반 실시간 전투

## 작업 내용
1. 통합 Position 시스템 설계
   - GridPosition (정수 좌표, 삼국지용)
   - ContinuousPosition (실수 좌표, 은영전용)
   - 상호 변환 유틸리티

2. 통합 Unit 인터페이스 설계
   - IUnit: 공통 속성 (id, name, hp, position)
   - ISamgukjiUnit extends IUnit: 병종, 병사수, 장수
   - ILoghUnit extends IUnit: 함선, 함대, 제독

3. 통합 Battle 인터페이스 설계
   - IBattle: 공통 전투 로직
   - ITurnBasedBattle: 턴제 전투 (삼국지)
   - IRealtimeBattle: 실시간 전투 (은영전)

4. 이벤트 시스템 설계
   - BattleEvent: 전투 이벤트 타입
   - EventEmitter 패턴으로 UI 연동

## 기술 스택
- TypeScript
- 의존성 주입 (DI) 패턴
- 이벤트 기반 아키텍처

## 주요 요구사항
- 기존 코드 최대한 활용
- 새 게임 추가 시 확장 용이
- 테스트 용이한 구조 (인터페이스 기반)

## 출력물
- src/core/battle/interfaces/ 디렉토리
- 통합 타입 정의 파일들
- 아키텍처 문서
```

---

## 필수 참고 파일

### 1. 기존 전투 타입
```
open-sam-backend/src/core/battle/
├── types.ts              # ⭐ Position3D, IBattleUnit
├── BattleEngine.ts       # 턴제 전투 엔진
├── BattleResolver.ts     # 전투 해결
├── BattleValidator.ts    # 액션 검증
├── BattleAI.ts           # AI 로직
└── index.ts
```

**현재 타입:**
```typescript
// types.ts
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface IBattleUnit {
  id: string;
  generalId: number;
  position: Position3D;
  crew: number;
  crewType: number;
  morale: number;
  hp: number;
  maxHp: number;
}
```

### 2. 전투 모델
```
open-sam-backend/src/models/
├── battle.model.ts       # 전투 모델
└── logh/
    ├── Fleet.model.ts    # ⭐ 함대 모델
    ├── Admiral.model.ts  # 제독 모델
    ├── Ship.model.ts     # 함선 모델
    └── StarSystem.model.ts
```

**Fleet 모델:**
```typescript
// Fleet.model.ts
interface IFleet {
  id: string;
  name: string;
  commander: IAdmiral;
  ships: IShip[];
  strategicPosition: { x: number; y: number };  // 그리드
  tacticalPosition: { x: number; y: number };   // 연속
  velocity: { x: number; y: number };
  facing: number;
  formation: Formation;
  morale: number;
  supply: number;
}
```

### 3. 전투 서비스
```
open-sam-backend/src/services/battle/
├── BattleEngine.service.ts    # 삼국지 전투
├── BattleResult.service.ts    # 결과 저장
└── AutoBattle.service.ts      # 자동 전투

open-sam-backend/src/services/logh/
├── RealtimeCombat.service.ts  # ⭐ 은영전 실시간 전투
├── FleetCombat.service.ts     # 함대 전투
├── FleetMovement.service.ts   # 함대 이동
└── WebSocketHandler.service.ts
```

### 4. 프론트엔드 타입
```
open-sam-front/src/types/battle.ts
```

### 5. 문서
```
open-sam-backend/docs/
├── LOGH7_MANUAL_SUMMARY.md
├── BATTLE_SYSTEM_IMPLEMENTATION.md
└── AUTO_BATTLE_CHECKLIST.md
```

---

## 아키텍처 설계

### 1. Position 시스템

```typescript
// src/core/battle/interfaces/Position.ts

/**
 * 기본 2D 위치 (공통)
 */
export interface IPosition2D {
  x: number;
  y: number;
}

/**
 * 3D 위치 (높이 포함)
 */
export interface IPosition3D extends IPosition2D {
  z: number;
}

/**
 * 그리드 위치 (정수, 삼국지용)
 */
export interface IGridPosition extends IPosition2D {
  readonly type: 'grid';
  x: number;  // 0-39 (정수)
  y: number;  // 0-39 (정수)
}

/**
 * 연속 위치 (실수, 은영전용)
 */
export interface IContinuousPosition extends IPosition2D {
  readonly type: 'continuous';
  x: number;  // 0.0-10000.0 (실수)
  y: number;  // 0.0-10000.0 (실수)
}

/**
 * 통합 위치 타입
 */
export type Position = IGridPosition | IContinuousPosition;

/**
 * 위치 변환 유틸리티
 */
export class PositionConverter {
  static gridToContinuous(
    grid: IGridPosition, 
    gridSize: number = 40,
    worldSize: number = 10000
  ): IContinuousPosition {
    const scale = worldSize / gridSize;
    return {
      type: 'continuous',
      x: grid.x * scale + scale / 2,
      y: grid.y * scale + scale / 2,
    };
  }
  
  static continuousToGrid(
    continuous: IContinuousPosition,
    gridSize: number = 40,
    worldSize: number = 10000
  ): IGridPosition {
    const scale = worldSize / gridSize;
    return {
      type: 'grid',
      x: Math.floor(continuous.x / scale),
      y: Math.floor(continuous.y / scale),
    };
  }
  
  static distance(a: IPosition2D, b: IPosition2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  static gridDistance(a: IGridPosition, b: IGridPosition): number {
    // 맨해튼 거리 (그리드용)
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
}
```

### 2. Unit 시스템

```typescript
// src/core/battle/interfaces/Unit.ts

/**
 * 기본 유닛 인터페이스 (공통)
 */
export interface IUnit {
  id: string;
  name: string;
  position: Position;
  hp: number;
  maxHp: number;
  morale: number;
  faction: string;  // 진영
  isAlive: boolean;
}

/**
 * 삼국지 유닛 (장수 + 병사)
 */
export interface ISamgukjiUnit extends IUnit {
  readonly gameType: 'samgukji';
  position: IGridPosition;
  
  // 장수 정보
  generalId: number;
  generalName: string;
  leadership: number;   // 통솔
  strength: number;     // 무력
  intelligence: number; // 지력
  politics: number;     // 정치
  charm: number;        // 매력
  
  // 병사 정보
  crew: number;         // 병사 수
  crewType: number;     // 병종 ID (units.json)
  train: number;        // 훈련도
  
  // 전투 스탯
  attack: number;
  defense: number;
  speed: number;
  range: number;        // 공격 범위
}

/**
 * 은하영웅전설 유닛 (함대)
 */
export interface ILoghUnit extends IUnit {
  readonly gameType: 'logh';
  position: IContinuousPosition;
  
  // 함대 정보
  fleetId: string;
  fleetName: string;
  ships: number;        // 함선 수
  shipTypes: ShipType[];
  
  // 제독 정보
  admiralId: string;
  admiralName: string;
  command: number;      // 통솔
  combat: number;       // 전투
  intelligence: number; // 지략
  politics: number;     // 정치
  charisma: number;     // 매력
  
  // 이동
  velocity: IPosition2D;
  facing: number;       // 방향 (0-360)
  
  // 상태
  formation: Formation;
  supply: number;       // 보급
  
  // 전투 스탯
  attackPower: number;
  defensePower: number;
  speed: number;
  attackRange: number;
}

/**
 * 통합 유닛 타입
 */
export type BattleUnit = ISamgukjiUnit | ILoghUnit;

/**
 * 유닛 타입 가드
 */
export function isSamgukjiUnit(unit: BattleUnit): unit is ISamgukjiUnit {
  return unit.gameType === 'samgukji';
}

export function isLoghUnit(unit: BattleUnit): unit is ILoghUnit {
  return unit.gameType === 'logh';
}
```

### 3. Battle 시스템

```typescript
// src/core/battle/interfaces/Battle.ts

/**
 * 전투 상태
 */
export type BattleStatus = 'preparing' | 'ongoing' | 'finished';

/**
 * 전투 결과
 */
export type BattleResult = 'attacker_win' | 'defender_win' | 'draw' | 'ongoing';

/**
 * 기본 전투 인터페이스 (공통)
 */
export interface IBattle {
  id: string;
  status: BattleStatus;
  result: BattleResult;
  
  attackerUnits: BattleUnit[];
  defenderUnits: BattleUnit[];
  
  startTime: Date;
  endTime?: Date;
  
  logs: BattleLog[];
}

/**
 * 턴제 전투 (삼국지)
 */
export interface ITurnBasedBattle extends IBattle {
  readonly battleType: 'turn-based';
  
  turn: number;
  phase: 'movement' | 'action' | 'end';
  activeUnitId: string;
  
  mapSize: { width: number; height: number };  // 40x40
  terrain: TerrainType[][];
  
  // 턴제 전용 메서드
  nextTurn(): void;
  getMovablePositions(unitId: string): IGridPosition[];
  getAttackablePositions(unitId: string): IGridPosition[];
  moveUnit(unitId: string, position: IGridPosition): boolean;
  attackUnit(attackerId: string, targetId: string): AttackResult;
}

/**
 * 실시간 전투 (은영전)
 */
export interface IRealtimeBattle extends IBattle {
  readonly battleType: 'realtime';
  
  tickRate: number;  // 50ms = 20 ticks/sec
  elapsedTime: number;
  
  mapSize: { width: number; height: number };  // 10000x10000
  
  // 실시간 전용 메서드
  tick(deltaTime: number): void;
  setDestination(unitId: string, position: IContinuousPosition): void;
  setTarget(unitId: string, targetId: string): void;
  setFormation(unitId: string, formation: Formation): void;
}

/**
 * 통합 전투 타입
 */
export type Battle = ITurnBasedBattle | IRealtimeBattle;

/**
 * 전투 타입 가드
 */
export function isTurnBasedBattle(battle: Battle): battle is ITurnBasedBattle {
  return battle.battleType === 'turn-based';
}

export function isRealtimeBattle(battle: Battle): battle is IRealtimeBattle {
  return battle.battleType === 'realtime';
}
```

### 4. Event 시스템

```typescript
// src/core/battle/interfaces/Event.ts

/**
 * 전투 이벤트 타입
 */
export type BattleEventType = 
  | 'battle:start'
  | 'battle:end'
  | 'turn:start'
  | 'turn:end'
  | 'unit:move'
  | 'unit:attack'
  | 'unit:damage'
  | 'unit:death'
  | 'unit:retreat'
  | 'skill:activate'
  | 'formation:change'
  | 'critical:hit'
  | 'evade';

/**
 * 기본 이벤트 인터페이스
 */
export interface IBattleEvent {
  type: BattleEventType;
  timestamp: number;
  battleId: string;
}

/**
 * 유닛 이동 이벤트
 */
export interface IUnitMoveEvent extends IBattleEvent {
  type: 'unit:move';
  unitId: string;
  from: Position;
  to: Position;
}

/**
 * 유닛 공격 이벤트
 */
export interface IUnitAttackEvent extends IBattleEvent {
  type: 'unit:attack';
  attackerId: string;
  targetId: string;
  damage: number;
  isCritical: boolean;
  isEvaded: boolean;
}

/**
 * 유닛 사망 이벤트
 */
export interface IUnitDeathEvent extends IBattleEvent {
  type: 'unit:death';
  unitId: string;
  killedBy: string;
}

/**
 * 통합 이벤트 타입
 */
export type BattleEvent = 
  | IUnitMoveEvent 
  | IUnitAttackEvent 
  | IUnitDeathEvent
  // ... 기타 이벤트

/**
 * 이벤트 리스너
 */
export type BattleEventListener<T extends BattleEvent = BattleEvent> = 
  (event: T) => void;

/**
 * 이벤트 이미터 인터페이스
 */
export interface IBattleEventEmitter {
  on<T extends BattleEvent>(
    type: T['type'], 
    listener: BattleEventListener<T>
  ): void;
  
  off<T extends BattleEvent>(
    type: T['type'], 
    listener: BattleEventListener<T>
  ): void;
  
  emit<T extends BattleEvent>(event: T): void;
}
```

### 5. 진형 시스템

```typescript
// src/core/battle/interfaces/Formation.ts

/**
 * 진형 타입 (공통)
 */
export type Formation = 
  | 'fishScale'   // 어린 - 공격 중시
  | 'craneWing'   // 학익 - 포위 공격
  | 'circular'    // 방원 - 방어 중시
  | 'arrowhead'   // 봉시 - 기동력
  | 'longSnake';  // 장사 - 회피

/**
 * 진형 스탯
 */
export interface IFormationStats {
  attack: number;   // 공격 보정 (1.0 = 100%)
  defense: number;  // 방어 보정
  speed: number;    // 속도 보정
  range: number;    // 사정거리 보정
}

/**
 * 진형 설정
 */
export const FORMATION_STATS: Record<Formation, IFormationStats> = {
  fishScale: { attack: 1.2, defense: 0.9, speed: 1.0, range: 1.0 },
  craneWing: { attack: 1.1, defense: 1.0, speed: 0.9, range: 1.1 },
  circular:  { attack: 0.9, defense: 1.3, speed: 0.8, range: 1.0 },
  arrowhead: { attack: 1.3, defense: 0.8, speed: 1.2, range: 0.9 },
  longSnake: { attack: 1.0, defense: 1.0, speed: 1.1, range: 1.0 },
};
```

---

## 디렉토리 구조

```
open-sam-backend/src/core/battle/
├── interfaces/
│   ├── index.ts              # 모든 인터페이스 내보내기
│   ├── Position.ts           # 위치 시스템
│   ├── Unit.ts               # 유닛 시스템
│   ├── Battle.ts             # 전투 시스템
│   ├── Event.ts              # 이벤트 시스템
│   └── Formation.ts          # 진형 시스템
├── engines/
│   ├── TurnBasedEngine.ts    # 턴제 전투 엔진 (삼국지)
│   └── RealtimeEngine.ts     # 실시간 전투 엔진 (은영전)
├── calculators/
│   ├── DamageCalculator.ts   # 데미지 계산
│   └── MovementCalculator.ts # 이동 계산
├── utils/
│   ├── PositionConverter.ts  # 위치 변환
│   └── UnitFactory.ts        # 유닛 생성
└── index.ts
```

---

## 체크리스트

- [ ] 기존 types.ts 분석
- [ ] Fleet.model.ts 분석
- [ ] Position 인터페이스 설계
- [ ] Unit 인터페이스 설계
- [ ] Battle 인터페이스 설계
- [ ] Event 시스템 설계
- [ ] Formation 시스템 설계
- [ ] 위치 변환 유틸리티 구현
- [ ] 타입 가드 함수 구현
- [ ] 기존 코드와 호환성 확인
- [ ] 문서 작성




