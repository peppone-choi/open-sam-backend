# LOGH 시스템 아키텍처

## 1. 데이터 구조 개요

### 1.1 게임 데이터 (JSON 파일)

#### 핵심 설정
- `game-constants.json` - 게임 상수 (시간, 그리드, 계급 제한 등)
- `game-mechanics.json` - 게임 메커니즘 (시간 시스템, 승패 조건 등)
- `game-systems.json` - 게임 시스템 (세션, 커맨드 포인트, 통신 등)

#### 진영 데이터
- `factions.json` - 진영 정보 (제국, 동맹)
- `empire-organization.json` - 제국 조직도
- `alliance-organization.json` - 동맹 조직도
- `empire-initial-deployment.json` - 제국 초기 배치
- `alliance-initial-deployment.json` - 동맹 초기 배치

#### 함선 데이터
- `ship-types.json` - 함선 유형 정의
- `empire-ship-specifications.json` - 제국 함선 스펙
- `alliance-ship-specifications.json` - 동맹 함선 스펙
- `ships-detailed.json` - 상세 함선 데이터

#### 지상군 데이터
- `ground-forces.json` - 지상군 유닛 (장갑병, 장갑척탄병, 경장 육전병)
- `military-units.json` - 군사 유닛 체계

#### 맵/공간 데이터
- `planets-and-systems-with-stats.json` - 행성/성계 데이터 (138KB, 가장 큰 파일)
- `map-grid-system.json` - 그리드 시스템
- `map-navigation-grid.json` - 항행 그리드 (46KB)

#### 캐릭터 데이터
- `admirals.json` - 제독 목록
- `character-parameters.json` - 캐릭터 파라미터
- `character-stats.json` - 캐릭터 능력치

#### 커맨드 데이터
- `commands.json` - 커맨드 그룹 (30KB)
- `complete-commands-table.json` - 전략 커맨드 일람 (25KB)
- `strategic-commands-complete.json` - 전략 커맨드 상세 (25KB)
- `tactical-commands.json` - 전술 커맨드

#### 기타 시스템
- `decorations.json` - 훈장 시스템 (37KB)
- `economic-systems.json` - 경제 시스템
- `political-systems.json` - 정치 시스템
- `facilities-buildings.json` - 시설/건물
- `tactical-mechanics.json` - 전술 메커니즘

## 2. 데이터베이스 모델

### 2.1 핵심 모델

#### Commander (지휘관)
```typescript
{
  no: number;
  name: string;
  faction: 'empire' | 'alliance';
  rank: string;              // 계급
  jobPosition: string;       // 직책
  commandPoints: number;     // 커맨드 포인트 (PCP/MCP)
  leadership: number;        // 통솔력
  tactics: number;           // 전술
  politics: number;          // 정치
  personalFunds: number;     // 개인 자금
  fleetId: string;          // 소속 함대
  status: 'active' | 'imprisoned' | 'defected' | 'executed';
  customData: any;          // 유연한 데이터 저장
}
```

#### Fleet (함대/부대)
```typescript
{
  fleetId: string;
  name: string;
  fleetType: 'single_ship' | 'fleet' | 'patrol' | 'transport' | 'ground_force' | 'garrison';
  faction: 'empire' | 'alliance' | 'neutral';
  
  // 함선 구성 (1 유닛 = 300척)
  ships: Array<{
    type: string;
    count: number;           // 유닛 수
    health: number;
  }>;
  totalShips: number;        // 총 유닛 수
  
  // 육전대 (1 유닛 ≈ 2,000명)
  groundTroops: Array<{
    type: string;            // 장갑병, 장갑척탄병, 경장 육전병
    count: number;
    health: number;
  }>;
  totalGroundTroops: number;
  
  // 자원
  supplies: number;          // 보급품
  fuel: number;             // 연료
  morale: number;           // 사기
  
  // 훈련도
  training: {
    discipline: number;      // 군기
    space: number;          // 항주
    ground: number;         // 육전
    air: number;            // 공전
  };
  
  // 위치 (100x50 그리드)
  strategicPosition: { x: number; y: number };
  gridPosition: { x: number; y: number };
  
  // 상태
  status: 'idle' | 'moving' | 'combat' | 'retreating' | 'docked' | 'destroyed';
}
```

#### Planet (행성)
```typescript
{
  planetId: string;
  name: string;
  owner: 'empire' | 'alliance' | 'neutral';
  
  // 통계
  stats: {
    population: number;      // 인구
    industry: number;        // 공업력
    technology: number;      // 기술력
    defense: number;         // 방어력
    resources: number;       // 자원
    loyalty: number;         // 충성도
  };
  
  // 생산
  production: {
    ships: number;
    resources: number;
    shipTypes: string[];
  };
  
  // 수비군 (1 유닛 ≈ 2,000명)
  garrison: {
    troops: Array<{
      type: string;
      count: number;
      health: number;
    }>;
    totalTroops: number;
    morale: number;
    training: number;
  };
  
  // 경제
  economy: {
    taxRate: number;         // 세율
    treasury: number;        // 재정
    income: number;          // 수입
  };
  
  // 위치
  gridCoordinates: { x: number; y: number };
  
  // 요새 여부
  isFortress: boolean;
  fortressGuns: number;
}
```

#### StarSystem (성계)
```typescript
{
  systemId: string;
  name: string;
  planets: string[];         // 소속 행성 ID 목록
  gridPosition: { x: number; y: number };
  owner: 'empire' | 'alliance' | 'neutral';
}
```

## 3. 게임 시스템

### 3.1 유닛 규모 (game-constants.json)
- **함선 유닛**: 1 유닛 = 300척 (매뉴얼 명시)
- **함선 승무원**: 1척 = 100명 (역산: 900척 = 90,000명)
- **육전대 유닛**: 1 유닛 ≈ 2,000명 (연대급)

### 3.2 부대 편성 (FLEET_TYPE_LIMITS)
| 부대 유형 | 함선 유닛 | 함선 수 | 육전대 유닛 | 병력 | 지휘관 |
|---------|----------|---------|-----------|------|-------|
| 단독함 (single_ship) | 0 | 1척 | 0 | 0 | 1명 |
| 함대 (fleet) | 60 | 18,000척 | 0 | 0 | 10명 |
| 순찰대 (patrol) | 3 | 900척 | 0 | 0 | 3명 |
| 수송함대 (transport) | 23 | 6,900척 | 0 | 0 | 3명 |
| 지상부대 (ground_force) | 3 | 900척 | 3 | 6,000명 | 1명 |
| 행성수비대 (garrison) | 0 | 1척 | 10 | 20,000명 | 1명 |

### 3.3 그리드 시스템
- 전략 맵: **100x50 그리드** (각 1 그리드 = 100광년)
- 그리드당 최대 유닛: **진영당 300 유닛**
- 그리드당 최대 진영: **2개**

### 3.4 시간 시스템
- 실시간 배율: **24배속**
- CP 회복: 게임시간 **2분**마다, 실시간 **5분**
- 자동 승진 체크: 게임시간 **30일**마다
- 작전 기간: 게임시간 **30일**
- 게임 종료: **우주력 801년 7월 27일**

### 3.5 계급 제한 (rankLimits)
- 원수 (Marshal): 5명
- 상급대장 (Senior Admiral): 5명
- 대장 (Admiral): 10명
- 중장 (Vice Admiral): 20명
- 소장 (Rear Admiral): 40명
- 준장 (Commodore): 80명
- 대령 이하: 무제한

### 3.6 커맨드 포인트 (CP)
- **PCP (Personal Command Point)**: 개인 커맨드 포인트
- **MCP (Military Command Point)**: 군사 커맨드 포인트
- CP 대체: MCP를 PCP로 **2배**로 대체 가능

## 4. 커맨드 시스템

### 4.1 전략 커맨드 (83개)
#### 작전 커맨드군 (18개)
- Warp, Port, LongDistanceMove, ShortDistanceMove
- Transport, TransportPlan, TransportCancel
- AlertDispatch, WithdrawOperation
- 등

#### 인사 커맨드군 (21개)
- Promotion, Demotion, Appointment, Dismissal
- Arrest, ArrestOrder, ExecutionOrder
- Defection, Retirement, Join
- 등

#### 사령부 커맨드군 (15개)
- UnitFormation, UnitDissolution
- OperationPlan, IssueOrder
- NationalGoal, GovernanceGoal
- 등

#### 병참 커맨드군 (10개)
- Production, Allocation, Reorganization, Replenishment
- FuelSupply, CompleteSupply, CompleteRepair
- 등

#### 정무 커맨드군 (12개)
- TaxRate, TariffRate, BudgetManagement
- FiefGrant, FiefDirect, Peerage
- ArmedSuppression, SpecialSecurity
- 등

#### 정보 커맨드군 (7개)
- MassSearch, Espionage, Infiltration, Sabotage
- Surveillance, Conspiracy
- 등

### 4.2 전술 커맨드 (14개)
- Move, ParallelMove, Stop, Turn, Reverse
- Attack, Fire, Formation
- Retreat, GroundDeploy, GroundWithdraw
- Sortie, AirCombat, StanceChange

## 5. 경제 시스템

### 5.1 생산 시스템
- 함선 생산: 조병공창(造兵工廠) 필요
- 병사 생산: 인구에서 모병
- 훈련 레벨: 엘리트, 베테랑, 노멀, 그린

### 5.2 창고 시스템
- 행성 창고: 행성별 저장
- 부대 창고: 함대/순찰대/지상부대별 저장
- 일괄 부대 창고: 순찰대/지상부대 공용

### 5.3 세금 시스템
- 세율: 0-100% 설정 가능
- 세율이 충성도에 영향
- 요직 캐릭터 통솔력이 세수에 영향

## 6. 정치 시스템

### 6.1 쿠데타/반란
- 쿠데타 성공률: 계급, 함대 규모, 공적, 사기에 영향
- 반란 진압: 무력 진압, 설득 가능

### 6.2 충성도 시스템
- 세율, 통치 정책에 따라 변동
- 낮은 충성도 → 반란 위험

### 6.3 우호도/영향력
- 캐릭터 간 우호도
- 정치적 영향력

## 7. 전투 시스템

### 7.1 전술 게임 발동
- 적 유닛과 같은 그리드에 진입
- 함선 유닛 수 비율 10배 이상 → 회피 가능

### 7.2 실시간 전투
- WebSocket 기반 실시간 처리
- 전술 맵에서 진행
- 진형, 공격, 이동 등 실시간 명령

### 7.3 지상전
- 육전대 강하
- 행성 수비대와 교전
- 점령 조건: 적 육전대 전멸

## 8. 승리 조건

### 8.1 결정적 승리
- 인구 90% 이상 지배
- 함대 비율 10:1 이상

### 8.2 패배 조건
- 수도 포함 3개 성계 이하 통제 시 패배

## 9. 구현 우선순위

### Phase 1: 기본 시스템 (완료)
- ✅ 모델 정의 (Commander, Fleet, Planet)
- ✅ 유닛 규모 정의
- ✅ 부대 편성 체계
- ✅ 게임 상수 로딩

### Phase 2: 핵심 커맨드 (진행중)
- ⏳ 이동 커맨드 (Warp, Port, Move)
- ⏳ 생산 커맨드 (Production, Allocation)
- ⏳ 인사 커맨드 (Promotion, Appointment)
- ⏳ 전투 커맨드 (Attack, Fire)

### Phase 3: 고급 시스템
- ⏳ 실시간 전투 시스템
- ⏳ 경제 시스템
- ⏳ 정치 시스템 (쿠데타, 반란)
- ⏳ 정보 시스템 (첩보, 침투)

### Phase 4: 완성
- ⏳ AI 시스템
- ⏳ 전사 시스템
- ⏳ 서훈 시스템
- ⏳ 엔딩 시나리오

## 10. 데이터 로딩 흐름

```
서버 시작
  ↓
LoadScenarioData.service.ts
  ↓
JSON 파일 로드
  ├─ game-constants.json → LoghConstants
  ├─ planets-and-systems-with-stats.json → Planet 모델
  ├─ admirals.json → Commander 모델
  ├─ empire/alliance-initial-deployment.json → Fleet 모델
  └─ ship-specifications.json → 함선 데이터
  ↓
데이터베이스 초기화
  ↓
게임 루프 시작 (GameLoop.service.ts)
```

## 11. 파일 크기 순위 (중요도 참고)

1. `planets-and-systems-with-stats.json` - **138KB** (최우선)
2. `alliance-ship-specifications.json` - **70KB**
3. `empire-ship-specifications.json` - **58KB**
4. `alliance-organization.json` - **48KB**
5. `empire-organization.json` - **47KB**
6. `map-navigation-grid.json` - **46KB**
7. `decorations.json` - **37KB**
8. `commands.json` - **30KB**

## 12. 다음 단계

1. **데이터 로더 구현**: LoadScenarioData.service.ts 완성
2. **핵심 커맨드 구현**: 이동, 생산, 전투 커맨드 완성
3. **실시간 시스템 연결**: WebSocket 핸들러 완성
4. **테스트**: 단위 테스트 및 통합 테스트
