# 에이전트 3: 삼국지 그리드 전투 UI (프론트엔드)

## 프롬프트

```
당신은 삼국지 5 스타일 전투 UI 개발자입니다.

## 프로젝트 컨텍스트
- 오픈 삼국: 삼국지 웹 전략 게임
- Next.js 16 + React 19 프론트엔드
- 삼국지 5 스타일의 아기자기한 픽셀아트 전투 씬 구현

## 작업 내용
1. 40x40 그리드 전투 맵 렌더링
2. 유닛 스프라이트 표시 (병종별 아이콘)
3. 턴제 전투 UI
   - 이동 범위 표시 (파란색 하이라이트)
   - 공격 대상 선택 (빨간색 하이라이트)
4. 유닛 정보 표시
   - HP 바, 사기 바, 병사 수
5. 전투 애니메이션
   - 공격, 피격, 크리티컬, 회피
6. 전투 로그 패널

## 기술 스택
- Next.js 16, React 19, TypeScript
- CSS Modules
- Canvas 또는 DOM 기반 렌더링

## 디자인 요구사항
- 삼국지 5 스타일: 작은 유닛 아이콘 (32x32 또는 48x48)
- 복고풍 픽셀아트 느낌
- 깔끔한 그리드 라인
- 부드러운 애니메이션

## 반응형 요구사항
- 데스크톱: 전체 40x40 그리드 표시
- 모바일: 줌/팬 기능으로 일부 영역 표시

## 출력물
- TurnBasedBattleMap.tsx (메인 전투 맵)
- BattleUnitCard.tsx (유닛 정보 카드)
- BattleControls.tsx (전투 컨트롤 패널)
- 관련 CSS 모듈
```

---

## 필수 참고 파일

### 1. 기존 전투 컴포넌트
```
open-sam-front/src/components/battle/
├── BattleMap.tsx              # ⭐ 기존 전투 맵 (참고)
├── BattleMap.module.css       # 전투 맵 스타일
├── UnitSprite.tsx             # ⭐ 유닛 스프라이트
├── BattleResultLog.tsx        # 전투 결과 로그
├── BattleResultLog.module.css # 결과 로그 스타일
├── HPBar.tsx                  # HP 바
├── HPBar.module.css           # HP 바 스타일
├── AttackAnimation.tsx        # 공격 애니메이션
├── DefendAnimation.tsx        # 방어 애니메이션
├── CriticalEffect.tsx         # 크리티컬 이펙트
├── EvadeEffect.tsx            # 회피 이펙트
├── BattleCanvas.tsx           # Canvas 기반 전투 (참고)
└── BattleCutsceneModal.tsx    # 전투 컷씬 모달
```

### 2. 에셋 파일
```
open-sam-front/public/assets/
├── units/                     # ⭐ 유닛 PNG 이미지
│   ├── 1000.png              # 성벽
│   ├── 1100.png              # 도민병
│   ├── 1101.png              # 청주병
│   ├── ...
│   └── 1503.png              # 형주수군
└── icons/                     # 아이콘 이미지
```

### 3. 타입 정의
```
open-sam-front/src/types/battle.ts
```

**핵심 타입:**
```typescript
interface BattleUnit {
  id: string;
  generalId: number;
  generalName: string;
  position: { x: number; y: number };
  crew: number;
  crewType: number;  // units.json ID
  hp: number;
  maxHp: number;
  morale: number;
  isEnemy: boolean;
}

interface BattleState {
  id: string;
  turn: number;
  phase: 'movement' | 'action' | 'end';
  activeUnitId: string;
  units: BattleUnit[];
  logs: BattleLogEntry[];
}
```

### 4. 3D/Canvas 컴포넌트 (참고)
```
open-sam-front/src/components/battle/
├── ThreeBattleMap.tsx         # Three.js 전투 맵
├── ThreeTacticalMap.tsx       # Three.js 전술 맵
├── IsoTacticalBattleMap.tsx   # 아이소메트릭 전투 맵
└── PureTacticalMap.tsx        # 순수 전술 맵
```

---

## 디자인 가이드

### 1. 그리드 시스템
```
┌──┬──┬──┬──┬──┐
│  │  │  │⚔️│  │  ← 공격 가능 범위 (빨강)
├──┼──┼──┼──┼──┤
│  │🔵│🔵│🔵│  │  ← 이동 가능 범위 (파랑)
├──┼──┼──┼──┼──┤
│  │🔵│🎖️│🔵│  │  ← 선택된 유닛
├──┼──┼──┼──┼──┤
│  │🔵│🔵│🔵│  │
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
└──┴──┴──┴──┴──┘
```

### 2. 유닛 스프라이트 매핑
```typescript
// UnitSprite.tsx 참고
const UNIT_TYPE_MAP: Record<number, string> = {
  1000: 'castle',      // 성벽
  1100: 'infantry',    // 도민병
  1200: 'archer',      // 궁병
  1300: 'cavalry',     // 기병
  1400: 'strategist',  // 책사
  1500: 'navy',        // 수군
};
```

### 3. 색상 팔레트
```css
:root {
  /* 배경 */
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  
  /* 그리드 */
  --grid-line: #2d3a4f;
  --grid-hover: rgba(255, 255, 255, 0.1);
  
  /* 하이라이트 */
  --highlight-move: rgba(66, 135, 245, 0.4);
  --highlight-attack: rgba(245, 66, 66, 0.4);
  --highlight-selected: rgba(245, 200, 66, 0.6);
  
  /* 진영 */
  --team-ally: #4287f5;
  --team-enemy: #f54242;
  
  /* HP 바 */
  --hp-full: #4caf50;
  --hp-medium: #ffc107;
  --hp-low: #f44336;
}
```

### 4. 유닛 카드 레이아웃
```
┌─────────────────────────┐
│ 🎖️ 관우               │  ← 장수 이름
│ ━━━━━━━━━━━━━━━━━━━━━━ │  ← HP 바
│ ▓▓▓▓▓▓▓▓░░ 80%        │
│                         │
│ 병종: 기병 (1300)       │
│ 병사: 5,000명           │
│ 사기: 85                │
│ 공격력: 120             │
│ 방어력: 95              │
└─────────────────────────┘
```

---

## 구현 가이드

### 1. 그리드 맵 컴포넌트
```typescript
// TurnBasedBattleMap.tsx
interface TurnBasedBattleMapProps {
  battleState: BattleState;
  onCellClick: (x: number, y: number) => void;
  onUnitClick: (unitId: string) => void;
}

export function TurnBasedBattleMap({ 
  battleState, 
  onCellClick, 
  onUnitClick 
}: TurnBasedBattleMapProps) {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [movableRange, setMovableRange] = useState<Position[]>([]);
  const [attackRange, setAttackRange] = useState<Position[]>([]);
  
  // 40x40 그리드 렌더링
  return (
    <div className={styles.battleMap}>
      {Array.from({ length: 40 }, (_, y) => (
        <div key={y} className={styles.row}>
          {Array.from({ length: 40 }, (_, x) => (
            <BattleCell
              key={`${x}-${y}`}
              x={x}
              y={y}
              unit={getUnitAt(battleState.units, x, y)}
              isMovable={isInRange(movableRange, x, y)}
              isAttackable={isInRange(attackRange, x, y)}
              isSelected={selectedUnit === getUnitAt(battleState.units, x, y)?.id}
              onClick={() => handleCellClick(x, y)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### 2. 셀 컴포넌트
```typescript
// BattleCell.tsx
interface BattleCellProps {
  x: number;
  y: number;
  unit?: BattleUnit;
  isMovable: boolean;
  isAttackable: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function BattleCell({
  x, y, unit, isMovable, isAttackable, isSelected, onClick
}: BattleCellProps) {
  const cellClass = cn(
    styles.cell,
    isMovable && styles.movable,
    isAttackable && styles.attackable,
    isSelected && styles.selected,
  );
  
  return (
    <div className={cellClass} onClick={onClick}>
      {unit && (
        <UnitSprite
          crewType={unit.crewType}
          isEnemy={unit.isEnemy}
          hp={unit.hp / unit.maxHp}
        />
      )}
    </div>
  );
}
```

### 3. 전투 컨트롤 패널
```typescript
// BattleControls.tsx
interface BattleControlsProps {
  battleState: BattleState;
  selectedUnit: BattleUnit | null;
  onMove: () => void;
  onAttack: () => void;
  onEndTurn: () => void;
  onAutoPlay: () => void;
}

export function BattleControls({
  battleState, selectedUnit, onMove, onAttack, onEndTurn, onAutoPlay
}: BattleControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.turnInfo}>
        턴 {battleState.turn} - {battleState.phase}
      </div>
      
      <div className={styles.buttons}>
        <button onClick={onMove} disabled={!selectedUnit}>
          이동
        </button>
        <button onClick={onAttack} disabled={!selectedUnit}>
          공격
        </button>
        <button onClick={onEndTurn}>
          턴 종료
        </button>
        <button onClick={onAutoPlay}>
          자동 전투
        </button>
      </div>
    </div>
  );
}
```

### 4. 애니메이션
```css
/* AttackAnimation.module.css */
@keyframes attack {
  0% { transform: translateX(0); }
  50% { transform: translateX(10px); }
  100% { transform: translateX(0); }
}

@keyframes damage {
  0% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.5; filter: brightness(2); }
  100% { opacity: 1; filter: brightness(1); }
}

@keyframes critical {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); filter: hue-rotate(30deg); }
  100% { transform: scale(1); }
}
```

---

## 테스트 시나리오

### 시나리오 1: 기본 렌더링
- 40x40 그리드 표시
- 아군 5유닛, 적군 5유닛 배치
- 각 유닛 스프라이트 정상 표시

### 시나리오 2: 유닛 선택
- 유닛 클릭 시 선택 하이라이트
- 이동 가능 범위 파란색 표시
- 공격 가능 범위 빨간색 표시

### 시나리오 3: 이동
- 이동 가능 셀 클릭 시 유닛 이동
- 이동 애니메이션 재생

### 시나리오 4: 공격
- 적 유닛 클릭 시 공격
- 공격 애니메이션 재생
- 데미지 숫자 표시
- HP 바 업데이트

### 시나리오 5: 모바일
- 터치로 줌/팬 가능
- 유닛 정보 팝업

---

## 체크리스트

- [ ] 기존 BattleMap.tsx 분석
- [ ] UnitSprite.tsx 분석
- [ ] 에셋 파일 확인 (public/assets/units/)
- [ ] 40x40 그리드 렌더링
- [ ] 유닛 스프라이트 표시
- [ ] 이동 범위 하이라이트
- [ ] 공격 범위 하이라이트
- [ ] 유닛 정보 카드
- [ ] HP/사기 바
- [ ] 공격 애니메이션
- [ ] 크리티컬/회피 이펙트
- [ ] 전투 로그 패널
- [ ] 반응형 디자인 (모바일)
- [ ] 자동 전투 버튼




