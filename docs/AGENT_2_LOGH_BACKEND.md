# 에이전트 2: 은하영웅전설 실시간 전투 엔진 (백엔드)

## 프롬프트

```
당신은 은하영웅전설 스타일 실시간 전투 엔진 개발자입니다.

## 프로젝트 컨텍스트
- 오픈 삼국 프로젝트의 확장으로 은하영웅전설 모드 개발
- 기존 실시간 전투 서비스 존재, 완성도 향상 필요
- 연속 좌표 시스템 + WebSocket 실시간 통신

## 작업 내용
1. 기존 `RealtimeCombat.service.ts` 분석 및 개선
2. 연속 좌표 시스템 (10000x10000) 완성
3. deltaTime 기반 이동 (50ms tick)
4. 함대 진형 시스템
   - 어린(Fish Scale), 학익(Crane Wing), 방원(Circular)
   - 봉시(Arrowhead), 장사(Long Snake)
5. 사정거리 기반 공격 시스템
6. 실시간 WebSocket 통신

## 기술 스택
- TypeScript, Node.js, MongoDB, Redis
- WebSocket (Socket.io)
- 연속 좌표: float (0.0 ~ 10000.0)

## 주요 요구사항
- 함대 이동: velocity 기반 (속도 × deltaTime)
- 회전: facing 각도 (0-360도)
- 공격: 사정거리 내 적 자동 타겟팅
- 진형별 공격/방어 보정
- 보급 시스템: 보급 부족 시 전투력 감소
- 사기 시스템: 0이 되면 항복/궤멸

## 출력물
- 개선된 RealtimeCombat.service.ts
- 새로운 FleetBattle.service.ts
- WebSocket 이벤트 정의
- 단위 테스트 파일
```

---

## 필수 참고 파일

### 1. 실시간 전투 서비스
```
open-sam-backend/src/services/logh/
├── RealtimeCombat.service.ts    # ⭐ 메인 실시간 전투 (수정 대상)
├── FleetCombat.service.ts       # 함대 전투 로직
├── FleetMovement.service.ts     # 함대 이동 로직
├── RealtimeMovement.service.ts  # 실시간 이동
├── WebSocketHandler.service.ts  # ⭐ WebSocket 핸들러
├── GalaxyBattle.service.ts      # 은하 전투
├── GalaxyOperation.service.ts   # 은하 작전
└── GameLoop.service.ts          # 게임 루프
```

### 2. 함대 모델
```
open-sam-backend/src/models/logh/
├── Fleet.model.ts      # ⭐ 함대 모델 (strategicPosition, tacticalPosition)
├── Admiral.model.ts    # 제독 모델
├── Ship.model.ts       # 함선 모델
└── StarSystem.model.ts # 항성계 모델
```

**핵심 인터페이스:**
```typescript
// Fleet.model.ts
interface IFleet {
  id: string;
  name: string;
  commander: IAdmiral;
  ships: IShip[];
  
  // 전략 맵 위치 (그리드, 100x50)
  strategicPosition: { x: number; y: number };
  
  // 전술 맵 위치 (연속 좌표, 10000x10000)
  tacticalPosition: { x: number; y: number };
  
  // 이동
  velocity: { x: number; y: number };
  facing: number;  // 0-360도
  
  // 상태
  formation: Formation;
  morale: number;
  supply: number;
}
```

### 3. 전투 엔진 코어 (삼국지용, 참고)
```
open-sam-backend/src/core/battle/
├── types.ts          # Position3D 타입
├── BattleEngine.ts   # 턴제 전투 엔진
└── BattleAI.ts       # AI 로직
```

### 4. 문서
```
open-sam-backend/docs/
├── LOGH7_MANUAL_SUMMARY.md   # ⭐ 은하영웅전설 VII 매뉴얼 요약
├── GIN7_MODE.md              # GIN7 모드 문서
└── BATTLE_SYSTEM_IMPLEMENTATION.md
```

---

## 은하영웅전설 VII 매뉴얼 핵심 요약

### 1. 좌표 시스템
| 맵 종류 | 좌표 타입 | 범위 | 용도 |
|---------|----------|------|------|
| 전략 맵 | 그리드 | 100x50 | 은하계 전체, 함대 배치 |
| 전술 맵 | 연속 | 10000x10000 | 실제 전투, 실시간 이동 |

### 2. 진형 시스템
| 진형 | 일본어 | 특징 |
|------|--------|------|
| 어린 | 魚鱗 | 공격 중시, 돌파력 ↑ |
| 학익 | 鶴翼 | 포위 공격, 측면 강화 |
| 방원 | 方円 | 방어 중시, 전방위 대응 |
| 봉시 | 鋒矢 | 기동력 ↑, 돌격용 |
| 장사 | 長蛇 | 회피력 ↑, 후퇴 용이 |

### 3. 제독 능력치
| 능력치 | 영향 |
|--------|------|
| 통솔 (Command) | 함대 규모, 지휘 범위 |
| 전투 (Combat) | 공격력/방어력 |
| 지략 (Intelligence) | 전술 옵션, 기습 성공률 |
| 정치 (Politics) | 외교, 내정 |
| 매력 (Charisma) | 사기, 충성도 |

### 4. 전투 명령
- **전진 (Advance)**: 적에게 접근
- **공격 (Attack)**: 사정거리 내 적 공격
- **후퇴 (Retreat)**: 전투 이탈
- **대기 (Hold)**: 현 위치 유지
- **포위 (Encircle)**: 적 측면/후방 공격
- **돌격 (Charge)**: 근접 전투
- **집중포화 (Concentrated Fire)**: 단일 목표 집중

---

## 구현 가이드

### 1. 실시간 게임 루프
```typescript
class RealtimeBattleEngine {
  private tickInterval = 50; // 50ms = 20 ticks/sec
  
  start() {
    setInterval(() => this.tick(), this.tickInterval);
  }
  
  tick() {
    const deltaTime = this.tickInterval / 1000; // 초 단위
    
    // 1. 이동 처리
    this.updatePositions(deltaTime);
    
    // 2. 공격 처리
    this.processAttacks(deltaTime);
    
    // 3. 상태 업데이트
    this.updateStates();
    
    // 4. 클라이언트 브로드캐스트
    this.broadcastState();
  }
}
```

### 2. 이동 시스템
```typescript
function updateFleetPosition(fleet: IFleet, deltaTime: number) {
  // 속도 기반 이동
  fleet.tacticalPosition.x += fleet.velocity.x * deltaTime;
  fleet.tacticalPosition.y += fleet.velocity.y * deltaTime;
  
  // 경계 체크
  fleet.tacticalPosition.x = clamp(fleet.tacticalPosition.x, 0, 10000);
  fleet.tacticalPosition.y = clamp(fleet.tacticalPosition.y, 0, 10000);
}

function setFleetDestination(fleet: IFleet, target: Position) {
  const direction = normalize({
    x: target.x - fleet.tacticalPosition.x,
    y: target.y - fleet.tacticalPosition.y,
  });
  
  const speed = getFleetSpeed(fleet); // 진형, 함선 타입에 따라
  fleet.velocity = {
    x: direction.x * speed,
    y: direction.y * speed,
  };
  
  // facing 계산 (라디안 → 도)
  fleet.facing = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
}
```

### 3. 공격 시스템
```typescript
function processFleetAttack(attacker: IFleet, defender: IFleet) {
  const distance = getDistance(attacker.tacticalPosition, defender.tacticalPosition);
  const range = getFleetAttackRange(attacker);
  
  if (distance > range) return; // 사정거리 밖
  
  // 데미지 계산
  const baseDamage = calculateBaseDamage(attacker);
  const formationBonus = getFormationBonus(attacker.formation);
  const admiralBonus = attacker.commander.combat / 100;
  
  const damage = baseDamage * formationBonus * (1 + admiralBonus);
  
  // 피해 적용
  applyDamage(defender, damage);
  
  // 사기 감소
  defender.morale -= damage * 0.01;
}
```

### 4. 진형 보정
```typescript
const FORMATION_STATS: Record<Formation, FormationStats> = {
  fishScale: { 
    attack: 1.2, 
    defense: 0.9, 
    speed: 1.0, 
    range: 1.0,
    description: '공격 중시, 돌파력 증가'
  },
  craneWing: { 
    attack: 1.1, 
    defense: 1.0, 
    speed: 0.9, 
    range: 1.1,
    description: '포위 공격, 측면 강화'
  },
  circular: { 
    attack: 0.9, 
    defense: 1.3, 
    speed: 0.8, 
    range: 1.0,
    description: '방어 중시, 전방위 대응'
  },
  arrowhead: { 
    attack: 1.3, 
    defense: 0.8, 
    speed: 1.2, 
    range: 0.9,
    description: '기동력 증가, 돌격용'
  },
  longSnake: { 
    attack: 1.0, 
    defense: 1.0, 
    speed: 1.1, 
    range: 1.0,
    description: '회피력 증가, 후퇴 용이'
  },
};
```

### 5. WebSocket 이벤트
```typescript
// 서버 → 클라이언트
interface BattleStateEvent {
  type: 'battle:state';
  data: {
    timestamp: number;
    fleets: FleetState[];
    projectiles: Projectile[];
  };
}

interface FleetDestroyedEvent {
  type: 'fleet:destroyed';
  data: {
    fleetId: string;
    destroyedBy: string;
  };
}

// 클라이언트 → 서버
interface MoveCommandEvent {
  type: 'command:move';
  data: {
    fleetId: string;
    destination: Position;
  };
}

interface AttackCommandEvent {
  type: 'command:attack';
  data: {
    fleetId: string;
    targetId: string;
  };
}

interface FormationChangeEvent {
  type: 'command:formation';
  data: {
    fleetId: string;
    formation: Formation;
  };
}
```

### 6. 보급 시스템
```typescript
function updateSupply(fleet: IFleet, deltaTime: number) {
  // 시간당 보급 소모
  const consumptionRate = fleet.ships.length * 0.1; // 함선당 0.1/시간
  fleet.supply -= consumptionRate * deltaTime;
  
  if (fleet.supply <= 0) {
    fleet.supply = 0;
    // 보급 부족 페널티
    fleet.morale -= 1 * deltaTime;
    // 전투력 감소 (공격력/방어력 50%)
  }
}
```

---

## 테스트 시나리오

### 시나리오 1: 기본 이동
- 함대 A를 (1000, 1000)에서 (5000, 5000)으로 이동
- 예상: 일정 속도로 부드럽게 이동

### 시나리오 2: 전투
- 함대 A (어린 진형) vs 함대 B (방원 진형)
- 예상: A가 공격력 높지만, B가 방어력 높음

### 시나리오 3: 사정거리
- 함대 A (사정거리 500) vs 함대 B (거리 600)
- 예상: A가 접근해야 공격 가능

### 시나리오 4: 보급
- 함대 A 보급 0 상태로 전투
- 예상: 전투력 50% 감소, 사기 지속 감소

---

## 체크리스트

- [ ] Fleet.model.ts 분석
- [ ] RealtimeCombat.service.ts 분석
- [ ] LOGH7_MANUAL_SUMMARY.md 숙지
- [ ] 연속 좌표 이동 시스템 구현
- [ ] facing(방향) 시스템 구현
- [ ] 사정거리 기반 공격 구현
- [ ] 진형 시스템 구현
- [ ] 보급 시스템 구현
- [ ] 사기 시스템 구현
- [ ] WebSocket 이벤트 정의
- [ ] 게임 루프 (50ms tick) 구현
- [ ] 단위 테스트 작성




