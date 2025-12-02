# 에이전트 1: 삼국지 턴제 전투 엔진 (백엔드)

## 프롬프트

```
당신은 삼국지 스타일 턴제 전투 엔진 개발자입니다.

## 프로젝트 컨텍스트
- 오픈 삼국: 삼국지 웹 전략 게임
- 기존 자동전투 시스템 존재, 수동 전투 시스템 추가 필요
- PHP 레거시에서 TypeScript로 마이그레이션 중

## 작업 내용
1. 기존 `BattleEngine.ts` 분석 및 개선
2. 40x40 그리드 기반 전투 맵 지원
3. 병종 상성 시스템 구현
   - 보병(1100) < 기병(1300) < 궁병(1200) < 보병
   - 특수 병종 상성도 고려 (책사, 무당 등)
4. 진형(Formation) 시스템 완성
   - 어린, 학익, 방원, 봉시, 장사
5. 턴제 전투 흐름
   - 속도 순으로 행동 순서 결정
   - 이동 → 공격 → 반격 → 턴 종료
6. 전투 결과 로그 생성 (PHP 스타일)

## 기술 스택
- TypeScript, Node.js, MongoDB
- 기존 `Position3D` 타입 활용 (x, y, z)
- 그리드 좌표는 정수 (0-39)

## 주요 요구사항
- 최대 10개 유닛 vs 10개 유닛 전투 지원
- 각 유닛: 장수(general) + 병사(crew)
- 데미지 계산:
  ```
  데미지 = (공격력 × 병사수 × 상성보정 × 지형보정 × 진형보정) 
         - (방어력 × 진형보정)
  ```
- 사기(morale) 시스템: 0이 되면 패주
- 크리티컬/회피 시스템

## 출력물
- 수정된 BattleEngine.ts
- 새로운 TurnBasedBattle.service.ts
- 단위 테스트 파일
```

---

## 필수 참고 파일

### 1. 전투 엔진 코어
```
open-sam-backend/src/core/battle/
├── BattleEngine.ts      # ⭐ 메인 전투 엔진 (수정 대상)
├── BattleResolver.ts    # 전투 해결 로직
├── BattleValidator.ts   # 액션 검증
├── BattleAI.ts          # AI 결정 로직
├── types.ts             # ⭐ Position3D, IBattleUnit 타입
└── index.ts             # 내보내기
```

**읽어야 할 핵심 코드:**
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
  crewType: number;  // units.json의 ID
  morale: number;
  // ...
}
```

### 2. 전투 서비스
```
open-sam-backend/src/services/battle/
├── BattleEngine.service.ts   # 전투 엔진 서비스
├── BattleResult.service.ts   # 전투 결과 저장/조회
└── AutoBattle.service.ts     # 자동 전투
```

### 3. 병종 데이터
```
open-sam-backend/config/scenarios/sangokushi/data/units.json
```

**병종 ID 매핑:**
| ID | 병종명 | 분류 |
|----|--------|------|
| 1000 | 성벽 | 특수 |
| 1100 | 도민병 | 보병 |
| 1101 | 청주병 | 보병 |
| 1102 | 단양병 | 보병 |
| 1103 | 정예보병 | 보병 |
| 1104 | 등갑병 | 보병 |
| 1105 | 백이병 | 보병 |
| 1106 | 무환삼군 | 보병 |
| 1107 | 무당비군 | 보병 |
| 1108 | 선등사 | 보병 |
| 1109 | 대극사 | 보병 |
| 1110 | 호분위 | 보병 |
| 1111 | 호치위 | 보병 |
| 1112 | 백마의종 | 보병 |
| 1113 | 대모험 | 보병 |
| 1114 | 비웅위 | 보병 |
| 1115 | 진위영 | 보병 |
| 1116 | 함진영 | 보병 |
| 1117 | 함진영 | 보병 |
| 1200 | 궁병 | 궁병 |
| 1201 | 노병 | 궁병 |
| 1202 | 연노병 | 궁병 |
| 1203 | 원융노병 | 궁병 |
| 1204 | 무강노병 | 궁병 |
| 1205 | 강노수 | 궁병 |
| 1206 | 사수 | 궁병 |
| 1207 | 독전주술사 | 궁병 |
| 1300 | 기병 | 기병 |
| 1301 | 경기병 | 기병 |
| 1302 | 돌기병 | 기병 |
| 1303 | 철기병 | 기병 |
| 1304 | 서량철기 | 기병 |
| 1305 | 호표기 | 기병 |
| 1306 | 병주돌기 | 기병 |
| 1400 | 책사 | 책사 |
| 1401 | 군사 | 책사 |
| 1402 | 도사 | 책사 |
| 1403 | 신산 | 책사 |
| 1500 | 수군 | 수군 |
| 1501 | 정예수군 | 수군 |
| 1502 | 선봉수군 | 수군 |
| 1503 | 형주수군 | 수군 |

### 4. 게임 상수
```
open-sam-backend/config/scenarios/sangokushi/data/constants.json
```

### 5. AI 로직 (병종 선택 참고)
```
open-sam-backend/src/core/SimpleAI.ts
```

**참고할 함수:**
- `selectBestCrewType()`: 장수 능력치에 따른 병종 선택
- `shouldDeploy()`: 출병 조건 판단

### 6. 제약 조건 시스템
```
open-sam-backend/src/constraints/ConstraintHelper.ts
```

---

## 참고 문서

| 문서 | 경로 |
|------|------|
| 전투 시스템 구현 | `docs/BATTLE_SYSTEM_IMPLEMENTATION.md` |
| 자동전투 체크리스트 | `docs/AUTO_BATTLE_CHECKLIST.md` |
| 유닛 시스템 리팩토링 | `docs/UNIT_SYSTEM_REFACTOR.md` |

---

## 구현 가이드

### 1. Position 시스템
```typescript
// 그리드 좌표 (정수)
interface GridPosition {
  x: number;  // 0-39
  y: number;  // 0-39
}

// 이동 가능 범위 계산
function getMovablePositions(unit: IBattleUnit, map: BattleMap): GridPosition[] {
  const speed = getUnitSpeed(unit);
  // BFS로 이동 가능 범위 계산
}
```

### 2. 병종 상성
```typescript
const UNIT_COMPATIBILITY: Record<string, Record<string, number>> = {
  'infantry': { 'cavalry': 0.8, 'archer': 1.2, 'infantry': 1.0 },
  'cavalry':  { 'infantry': 1.2, 'archer': 0.8, 'cavalry': 1.0 },
  'archer':   { 'cavalry': 1.2, 'infantry': 0.8, 'archer': 1.0 },
};
```

### 3. 진형 보정
```typescript
const FORMATION_BONUS: Record<string, { attack: number; defense: number }> = {
  'fishScale': { attack: 1.2, defense: 0.9 },   // 어린
  'craneWing': { attack: 1.1, defense: 1.0 },   // 학익
  'circular':  { attack: 0.9, defense: 1.2 },   // 방원
  'arrowhead': { attack: 1.3, defense: 0.8 },   // 봉시
  'longSnake': { attack: 1.0, defense: 1.0 },   // 장사
};
```

### 4. 턴 진행
```typescript
interface BattleTurn {
  turnNumber: number;
  phase: 'movement' | 'action' | 'end';
  activeUnitId: string;
  actions: BattleAction[];
}

function processTurn(battle: IBattle): BattleTurn {
  // 1. 속도 순으로 유닛 정렬
  // 2. 각 유닛 행동 처리
  // 3. 전투 종료 조건 체크
}
```

---

## 테스트 시나리오

### 시나리오 1: 기본 전투
- 보병 1000명 vs 기병 1000명
- 예상: 기병 승리 (상성 유리)

### 시나리오 2: 진형 효과
- 어린 진형 보병 vs 방원 진형 보병
- 예상: 어린 진형이 공격력 높지만, 방원 진형이 방어력 높음

### 시나리오 3: 사기 시스템
- 연속 패배 시 사기 감소
- 사기 0 도달 시 패주

---

## 체크리스트

- [ ] Position3D 타입 이해
- [ ] units.json 병종 데이터 분석
- [ ] 기존 BattleEngine.ts 분석
- [ ] 그리드 이동 로직 구현
- [ ] 병종 상성 시스템 구현
- [ ] 진형 시스템 구현
- [ ] 데미지 계산 공식 구현
- [ ] 사기 시스템 구현
- [ ] 턴 진행 로직 구현
- [ ] 전투 결과 로그 생성
- [ ] 단위 테스트 작성




