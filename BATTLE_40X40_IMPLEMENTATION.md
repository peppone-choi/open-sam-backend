# 40x40 전투 시스템 구현 계획 (백엔드)

**작성일**: 2025-11-05  
**대상**: open-sam-backend 40x40 전투 시스템

---

## 📋 개요

실시간 턴제 전략 전투 시스템 (40x40 그리드)을 Socket.IO 기반으로 구현합니다.

---

## 🎯 핵심 기능

### 1. 전투 생성 및 참가
- 공격자가 전투 시작 (도시 공격/야전)
- 방어자 자동 참가 또는 수동 참가
- 최대 참가 인원 제한

### 2. 유닛 배치
- 각 장수가 병력을 여러 유닛으로 분할 배치
- 배치 영역 제한 (아군 진영 내)
- 병종별 특성 반영

### 3. 턴 진행
- 동시 턴 방식 (모든 플레이어 동시 행동)
- 유닛 이동 및 공격
- 전투 결과 계산

### 4. 승패 판정
- 승리 조건: 적 전멸 또는 점령
- 결과 월드 반영: 도시 점령, 국가 멸망 등

---

## 🗂️ 데이터 구조

### Battle 모델
```typescript
interface Battle {
  id: string;
  session_id: string;
  type: 'city_attack' | 'field' | 'duel';
  city_id?: number;  // 도시 공격 시
  
  attackers: BattleSide;
  defenders: BattleSide;
  
  state: 'waiting' | 'deploying' | 'fighting' | 'ended';
  current_turn: number;
  max_turns: number;
  
  map_template_id: string;
  created_at: Date;
  started_at?: Date;
  ended_at?: Date;
  
  winner?: 'attackers' | 'defenders';
  result: BattleResult;
}

interface BattleSide {
  nation_id: number;
  nation_name: string;
  generals: BattleGeneral[];
  total_crew: number;
  ready: boolean;
}

interface BattleGeneral {
  general_id: number;
  general_name: string;
  crew: number;
  crewtype: number;
  leadership: number;
  strength: number;
  intel: number;
  units: BattleUnit[];  // 배치된 유닛들
  ready: boolean;
}

interface BattleUnit {
  id: string;  // 유닛 고유 ID
  general_id: number;
  crew: number;  // 병사 수
  crewtype: number;
  position: { x: number; y: number };
  hp: number;  // 현재 병사 수
  status: 'alive' | 'dead';
  
  // 턴 액션
  action?: {
    type: 'move' | 'attack' | 'wait';
    target?: { x: number; y: number };
    target_unit_id?: string;
  };
}

interface BattleResult {
  winner: 'attackers' | 'defenders';
  city_occupied?: boolean;
  nation_destroyed?: boolean;
  casualties: {
    attackers: number;
    defenders: number;
  };
  experience_gained: {
    [general_id: number]: number;
  };
}
```

### BattleMapTemplate 모델
```typescript
interface BattleMapTemplate {
  id: string;
  name: string;
  width: number;  // 40
  height: number;  // 40
  terrain: number[][];  // 지형 데이터 (0: 평지, 1: 산, 2: 물 등)
  deployment_zones: {
    attackers: { x1: number; y1: number; x2: number; y2: number };
    defenders: { x1: number; y1: number; x2: number; y2: number };
  };
}
```

---

## 🔄 전투 플로우

### Phase 1: 전투 생성
```typescript
// src/services/battle/BattleCreation.service.ts
class BattleCreationService {
  static async createBattle(data: {
    sessionId: string;
    type: 'city_attack' | 'field';
    attackerGeneralId: number;
    defenderNationId: number;
    cityId?: number;
  }): Promise<Battle> {
    // 1. 전투 참가자 검증
    // 2. 맵 템플릿 선택
    // 3. Battle 문서 생성
    // 4. Socket 룸 생성
    // 5. 양측에 알림
  }
}
```

### Phase 2: 유닛 배치
```typescript
// src/services/battle/DeployUnits.service.ts
class DeployUnitsService {
  static async deployUnits(data: {
    battleId: string;
    generalId: number;
    units: Array<{
      crew: number;
      crewtype: number;
      position: { x: number; y: number };
    }>;
  }): Promise<void> {
    // 1. 배치 영역 검증
    // 2. 병력 합계 검증 (총 병사 수 초과 불가)
    // 3. 유닛 생성
    // 4. 배치 완료 표시
    // 5. 양측 모두 ready면 전투 시작
  }
}
```

### Phase 3: 턴 진행
```typescript
// src/handlers/battle.socket.ts
socket.on('battle:submit_action', async (data) => {
  // 1. 유닛 액션 등록 (이동/공격/대기)
  // 2. 모든 유닛 ready 체크
  // 3. 모두 ready면 턴 해결
  await resolveTurn(battleId);
});

async function resolveTurn(battleId: string) {
  // 1. 모든 유닛 액션 수집
  // 2. 이동 처리
  // 3. 공격 처리
  // 4. 데미지 계산
  // 5. 사망 유닛 처리
  // 6. 승패 판정
  // 7. 결과 브로드캐스트
  
  if (battleEnded) {
    await BattleEventHook.onBattleEnded(battle);
  }
}
```

### Phase 4: 월드 반영
```typescript
// src/services/battle/BattleEventHook.service.ts
class BattleEventHook {
  static async onBattleEnded(battle: Battle): Promise<void> {
    // 1. 경험치 분배
    // 2. 사상자 반영
    
    if (battle.type === 'city_attack' && battle.winner === 'attackers') {
      await this.onCityOccupied({
        cityId: battle.city_id!,
        oldNation: battle.defenders.nation_id,
        newNation: battle.attackers.nation_id
      });
    }
  }
  
  static async onCityOccupied(data: {
    cityId: number;
    oldNation: number;
    newNation: number;
  }): Promise<void> {
    // 1. 도시 소유권 변경
    // 2. 국가 장수 이동
    // 3. 국가 국력 재계산
    // 4. 월드 히스토리 기록
    // 5. Socket 브로드캐스트
    
    // 멸망 체크
    const destroyed = await this.checkNationDestroyed(data.oldNation);
    if (destroyed) {
      await this.onNationDestroyed({ nationId: data.oldNation });
    }
    
    // 통일 체크
    const unified = await this.checkUnified();
    if (unified) {
      await this.onUnified({ nationId: data.newNation });
    }
  }
  
  static async checkNationDestroyed(nationId: number): Promise<boolean> {
    // 도시 수 == 0 체크
    const cityCount = await City.countDocuments({ nation: nationId });
    return cityCount === 0;
  }
  
  static async onNationDestroyed(data: { nationId: number }): Promise<void> {
    // 1. 장수들 재야로 전환
    // 2. 국가 상태 변경
    // 3. 외교 관계 정리
    // 4. 월드 히스토리 기록
  }
  
  static async checkUnified(): Promise<boolean> {
    // 국가 수 == 1 체크
    const nationCount = await Nation.countDocuments({ level: { $gte: 1 } });
    return nationCount === 1;
  }
  
  static async onUnified(data: { nationId: number }): Promise<void> {
    // 1. 승리 메시지
    // 2. 게임 종료 이벤트
    // 3. 통일 기록
  }
}
```

---

## 🎮 전투 해결 알고리즘

### 이동 처리
```typescript
function processMovement(units: BattleUnit[]): void {
  for (const unit of units) {
    if (unit.action?.type !== 'move') continue;
    
    const target = unit.action.target!;
    const distance = calculateDistance(unit.position, target);
    const maxMove = getMaxMoveDistance(unit.crewtype);
    
    if (distance <= maxMove && !isBlocked(target)) {
      unit.position = target;
    }
  }
}
```

### 공격 처리
```typescript
function processAttacks(units: BattleUnit[]): void {
  for (const unit of units) {
    if (unit.action?.type !== 'attack') continue;
    
    const target = findUnit(unit.action.target_unit_id!);
    if (!target || !inRange(unit, target)) continue;
    
    const damage = calculateDamage(unit, target);
    target.hp -= damage;
    
    if (target.hp <= 0) {
      target.status = 'dead';
    }
  }
}
```

### 데미지 계산
```typescript
function calculateDamage(attacker: BattleUnit, defender: BattleUnit): number {
  const general = getGeneral(attacker.general_id);
  
  // 기본 공격력 = 병사 수 * 병종 공격력 * 무력 보정
  let damage = attacker.hp * getUnitAttack(attacker.crewtype);
  damage *= (general.strength / 100);
  
  // 병종 상성 보정
  const affinity = getUnitAffinity(attacker.crewtype, defender.crewtype);
  damage *= affinity;
  
  // 지형 보정
  const terrain = getTerrain(defender.position);
  damage *= getTerrainDefenseBonus(terrain);
  
  return Math.floor(damage);
}
```

---

## 📡 Socket.IO 이벤트

### 클라이언트 → 서버
```typescript
// 전투 참가
socket.emit('battle:join', { battleId, generalId });

// 유닛 배치
socket.emit('battle:deploy', {
  battleId,
  generalId,
  units: [{ crew: 1000, crewtype: 1, position: { x: 5, y: 5 } }]
});

// 배치 완료
socket.emit('battle:ready', { battleId, generalId });

// 턴 액션 제출
socket.emit('battle:submit_action', {
  battleId,
  unitId,
  action: { type: 'move', target: { x: 10, y: 10 } }
});
```

### 서버 → 클라이언트
```typescript
// 전투 상태 업데이트
socket.emit('battle:state', battle);

// 배치 업데이트
socket.emit('battle:deploy_update', { generalId, units });

// 전투 시작
socket.emit('battle:started', { turn: 1 });

// 턴 시작
socket.emit('battle:turn_start', { turn: 5, timeLimit: 30 });

// 턴 결과
socket.emit('battle:turn_result', {
  movements: [...],
  attacks: [...],
  casualties: [...]
});

// 전투 종료
socket.emit('battle:ended', {
  winner: 'attackers',
  result: { ... }
});
```

---

## 🗄️ 데이터베이스 스키마

### battles 컬렉션
```typescript
{
  _id: ObjectId,
  session_id: String,
  type: String,
  city_id: Number,
  attackers: {
    nation_id: Number,
    generals: [{ general_id, units: [...] }],
    ready: Boolean
  },
  defenders: { ... },
  state: String,
  current_turn: Number,
  map_template_id: String,
  created_at: Date,
  result: { winner, casualties, ... }
}
```

### battle_map_templates 컬렉션
```typescript
{
  _id: ObjectId,
  name: String,
  width: 40,
  height: 40,
  terrain: [[0, 0, 1, ...], ...],  // 40x40 배열
  deployment_zones: {
    attackers: { x1: 0, y1: 0, x2: 10, y2: 40 },
    defenders: { x1: 30, y1: 0, x2: 40, y2: 40 }
  }
}
```

---

## 🧪 테스트 계획

### 단위 테스트
```typescript
describe('Battle Resolution', () => {
  it('should process movement correctly', () => {
    // 이동 처리 테스트
  });
  
  it('should calculate damage correctly', () => {
    // 데미지 계산 테스트
  });
  
  it('should detect victory conditions', () => {
    // 승리 판정 테스트
  });
});
```

### 통합 테스트
```typescript
describe('Battle Flow', () => {
  it('should complete full battle cycle', async () => {
    // 1. 전투 생성
    // 2. 유닛 배치
    // 3. 턴 진행
    // 4. 승패 판정
    // 5. 월드 반영
  });
});
```

---

## 📁 파일 구조

```
src/
├── models/
│   ├── battle.model.ts
│   └── battle-map-template.model.ts
├── handlers/
│   └── battle.socket.ts              # Socket 이벤트 핸들러
├── services/battle/
│   ├── BattleCreation.service.ts     # ✅ 구현됨
│   ├── DeployUnits.service.ts        # ✅ 구현됨
│   ├── StartBattle.service.ts        # ✅ 구현됨
│   ├── SubmitAction.service.ts       # ✅ 구현됨
│   ├── BattleResolution.service.ts   # ❌ 보완 필요 (턴 해결)
│   └── BattleEventHook.service.ts    # ❌ 연결 필요 (월드 반영)
└── utils/
    └── battle-calculator.ts           # 데미지/이동 계산
```

---

## ⚙️ 설정

### 환경 변수
```env
BATTLE_MAX_TURNS=100
BATTLE_TURN_TIMEOUT=30000  # 30초
BATTLE_MAX_UNITS_PER_GENERAL=10
```

### 게임 상수
```typescript
export const BattleConstants = {
  MAP_SIZE: 40,
  MAX_TURNS: 100,
  TURN_TIMEOUT: 30000,
  MAX_UNITS_PER_GENERAL: 10,
  
  UNIT_MOVE_SPEED: {
    1: 5,  // 보병
    2: 7,  // 기병
    3: 3,  // 궁병
  },
  
  UNIT_ATTACK_RANGE: {
    1: 1,  // 보병
    2: 1,  // 기병
    3: 5,  // 궁병
  },
  
  UNIT_AFFINITY: {
    '1-2': 0.8,  // 보병 vs 기병
    '1-3': 1.2,  // 보병 vs 궁병
    '2-3': 1.2,  // 기병 vs 궁병
  }
};
```

---

## 🚀 구현 우선순위

### P0 - 핵심 로직 (완료)
- ✅ 전투 생성
- ✅ 유닛 배치
- ✅ 턴 진행
- ✅ Socket.IO 이벤트

### P1 - 월드 반영 (3일)
- ❌ `BattleEventHook` 연결
- ❌ 도시 점령 처리
- ❌ 국가 멸망 처리
- ❌ 통일 체크

### P2 - 고도화 (선택)
- AI 자동 전투
- 전투 리플레이
- 전투 통계

---

## 📚 참고 자료

- [Socket.IO 문서](https://socket.io/docs/v4/)
- PHP 버전 전투 로직: `sammo-php/src/sammo/WarUnit.php`
- 기존 구현: `src/handlers/battle.socket.ts`
