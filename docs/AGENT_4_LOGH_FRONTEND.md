# 에이전트 4: 은하영웅전설 실시간 전술 UI (프론트엔드)

## 프롬프트

```
당신은 은하영웅전설 스타일 실시간 전술 UI 개발자입니다.

## 프로젝트 컨텍스트
- 오픈 삼국 프로젝트의 확장으로 은하영웅전설 모드 개발
- Next.js 16 + React 19 프론트엔드
- 우주 전투 시뮬레이션 UI 구현

## 작업 내용
1. 10000x10000 연속좌표 전술 맵 렌더링 (Canvas)
2. 함대 아이콘 및 진형 표시
3. 실시간 이동 애니메이션 (WebSocket)
4. 공격 범위 및 사정거리 표시
5. 함대 정보 HUD
   - HP, 사기, 보급, 함선 수
6. 명령 패널
   - 이동, 공격, 진형 변경, 후퇴

## 기술 스택
- Next.js 16, React 19, TypeScript
- Canvas API 또는 Three.js
- WebSocket (Socket.io-client)

## 디자인 요구사항
- SF 느낌의 UI (네온, 홀로그램 스타일)
- 우주 배경 (별, 성운)
- 함대는 화살표 또는 함선 아이콘으로 표시
- 부드러운 60fps 렌더링

## 기능 요구사항
- 줌 인/아웃 기능
- 미니맵 표시
- 함대 선택 및 드래그 이동
- 진형별 시각적 표현

## 출력물
- TacticalBattleCanvas.tsx (메인 전술 맵)
- FleetHUD.tsx (함대 정보 HUD)
- CommandPanel.tsx (명령 패널)
- MiniMap.tsx (미니맵)
- 관련 CSS 모듈
```

---

## 필수 참고 파일

### 1. 기존 LOGH 컴포넌트
```
open-sam-front/src/components/logh/
├── TacticalMap.tsx            # ⭐ 전술 맵 (수정 대상)
├── TacticalMap.dynamic.tsx    # 동적 로딩
├── TacticalHUD.tsx            # ⭐ 전술 HUD
├── TacticalSteeringPanel.tsx  # 조종 패널
├── StrategicMap.tsx           # 전략 맵
├── SteeringPanel.tsx          # 조종 패널
├── EconomyHUD.tsx             # 경제 HUD
├── GroundCombatHUD.tsx        # 지상전 HUD
├── StarGrid.tsx               # 별 그리드
├── WarpDialog.tsx             # 워프 다이얼로그
├── TargetSelectionModal.tsx   # 타겟 선택 모달
├── CommandConfirmDialog.tsx   # 명령 확인 다이얼로그
└── JobCard.tsx                # 작업 카드
```

### 2. Canvas/3D 컴포넌트
```
open-sam-front/src/components/battle/
├── BattleCanvas.tsx           # ⭐ Canvas 기반 전투
├── ThreeBattleMap.tsx         # Three.js 전투 맵
├── ThreeBattleMap.lazy.tsx    # 지연 로딩
├── ThreeTacticalMap.tsx       # Three.js 전술 맵
└── ThreeTacticalMap.lazy.tsx  # 지연 로딩
```

### 3. 기존 전투 컴포넌트 (참고)
```
open-sam-front/src/components/battle/
├── BattleMap.tsx              # 그리드 전투 맵
├── UnitSprite.tsx             # 유닛 스프라이트
├── HPBar.tsx                  # HP 바
├── AttackAnimation.tsx        # 공격 애니메이션
└── BattleResultLog.tsx        # 전투 결과 로그
```

### 4. 문서
```
open-sam-backend/docs/
├── LOGH7_MANUAL_SUMMARY.md    # ⭐ 은하영웅전설 VII 매뉴얼 요약
└── GIN7_MODE.md               # GIN7 모드 문서
```

---

## 디자인 가이드

### 1. 색상 팔레트 (SF 스타일)
```css
:root {
  /* 배경 */
  --space-bg: #0a0a1a;
  --nebula-color: rgba(100, 50, 150, 0.3);
  
  /* 네온 */
  --neon-blue: #00d4ff;
  --neon-green: #00ff88;
  --neon-red: #ff3366;
  --neon-yellow: #ffcc00;
  
  /* 홀로그램 */
  --holo-primary: rgba(0, 212, 255, 0.8);
  --holo-secondary: rgba(0, 212, 255, 0.3);
  --holo-border: rgba(0, 212, 255, 0.5);
  
  /* 진영 */
  --empire-color: #ff3366;      /* 은하제국 - 빨강 */
  --alliance-color: #00d4ff;    /* 자유행성동맹 - 파랑 */
  --phezzan-color: #ffcc00;     /* 페잔 - 노랑 */
  
  /* HUD */
  --hud-bg: rgba(10, 10, 26, 0.9);
  --hud-border: rgba(0, 212, 255, 0.3);
}
```

### 2. 함대 표시
```
     ▲
    /|\      ← 화살표로 방향(facing) 표시
   / | \
  /  |  \
 ────┴────   ← 진형에 따라 모양 변경

진형별 아이콘:
- 어린(Fish Scale): ▲ (뾰족한 삼각형)
- 학익(Crane Wing): ◁▷ (양날개)
- 방원(Circular): ● (원형)
- 봉시(Arrowhead): ➤ (화살표)
- 장사(Long Snake): ═══ (긴 선)
```

### 3. HUD 레이아웃
```
┌─────────────────────────────────────────────────┐
│ [함대명: 제1함대]              [HP: ████████░░] │
│ [제독: 라인하르트]             [사기: 95%]      │
│ [함선: 15,000척]               [보급: 80%]      │
│ [진형: 어린]                   [속도: 120]      │
├─────────────────────────────────────────────────┤
│ [이동] [공격] [진형변경] [후퇴] [자동]          │
└─────────────────────────────────────────────────┘
```

### 4. 미니맵
```
┌──────────────┐
│ ·    ▲    · │  ← 아군 (파랑)
│  ·  ···  ·  │
│   ▼    ▼    │  ← 적군 (빨강)
│ ·   ···   · │
│  ·       ·  │
└──────────────┘
  [줌 +] [줌 -]
```

---

## 구현 가이드

### 1. Canvas 기반 전술 맵
```typescript
// TacticalBattleCanvas.tsx
interface TacticalBattleCanvasProps {
  fleets: Fleet[];
  selectedFleetId: string | null;
  onFleetSelect: (fleetId: string) => void;
  onMoveCommand: (fleetId: string, destination: Position) => void;
}

export function TacticalBattleCanvas({
  fleets, selectedFleetId, onFleetSelect, onMoveCommand
}: TacticalBattleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ x: 5000, y: 5000, zoom: 1 });
  
  // 렌더링 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    
    function render() {
      // 배경 (우주)
      drawSpaceBackground(ctx, camera);
      
      // 그리드 라인 (선택적)
      drawGrid(ctx, camera);
      
      // 함대
      fleets.forEach(fleet => {
        drawFleet(ctx, fleet, camera, fleet.id === selectedFleetId);
      });
      
      // 사정거리 (선택된 함대)
      if (selectedFleetId) {
        const fleet = fleets.find(f => f.id === selectedFleetId);
        if (fleet) {
          drawAttackRange(ctx, fleet, camera);
        }
      }
      
      animationId = requestAnimationFrame(render);
    }
    
    render();
    return () => cancelAnimationFrame(animationId);
  }, [fleets, selectedFleetId, camera]);
  
  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      onClick={handleCanvasClick}
      onWheel={handleZoom}
      onMouseDown={handlePanStart}
    />
  );
}
```

### 2. 함대 렌더링
```typescript
function drawFleet(
  ctx: CanvasRenderingContext2D,
  fleet: Fleet,
  camera: Camera,
  isSelected: boolean
) {
  const screenPos = worldToScreen(fleet.tacticalPosition, camera);
  
  ctx.save();
  ctx.translate(screenPos.x, screenPos.y);
  ctx.rotate(fleet.facing * Math.PI / 180);
  
  // 진형에 따른 모양
  const shape = getFormationShape(fleet.formation);
  
  // 진영 색상
  const color = getFactionColor(fleet.faction);
  
  // 그리기
  ctx.fillStyle = color;
  ctx.strokeStyle = isSelected ? '#ffcc00' : color;
  ctx.lineWidth = isSelected ? 3 : 1;
  
  ctx.beginPath();
  shape.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // 함대명
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fleet.name, screenPos.x, screenPos.y + 25);
}
```

### 3. 우주 배경
```typescript
function drawSpaceBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera
) {
  const { width, height } = ctx.canvas;
  
  // 검은 배경
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, width, height);
  
  // 별
  const starCount = 200;
  for (let i = 0; i < starCount; i++) {
    const seed = i * 12345;
    const x = (seed % width + camera.x * 0.1) % width;
    const y = ((seed * 7) % height + camera.y * 0.1) % height;
    const size = (seed % 3) + 1;
    const brightness = 0.3 + (seed % 70) / 100;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 성운 (그라디언트)
  const gradient = ctx.createRadialGradient(
    width * 0.7, height * 0.3, 0,
    width * 0.7, height * 0.3, 300
  );
  gradient.addColorStop(0, 'rgba(100, 50, 150, 0.3)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
```

### 4. WebSocket 연동
```typescript
// useRealtimeBattle.ts
export function useRealtimeBattle(battleId: string) {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const socketRef = useRef<Socket | null>(null);
  
  useEffect(() => {
    const socket = io('/battle', {
      query: { battleId },
    });
    
    socket.on('battle:state', (data: BattleStateEvent) => {
      setFleets(data.fleets);
    });
    
    socket.on('fleet:destroyed', (data: FleetDestroyedEvent) => {
      setFleets(prev => prev.filter(f => f.id !== data.fleetId));
    });
    
    socketRef.current = socket;
    
    return () => {
      socket.disconnect();
    };
  }, [battleId]);
  
  const sendCommand = useCallback((command: BattleCommand) => {
    socketRef.current?.emit('command', command);
  }, []);
  
  return { fleets, sendCommand };
}
```

### 5. 명령 패널
```typescript
// CommandPanel.tsx
interface CommandPanelProps {
  selectedFleet: Fleet | null;
  onMove: () => void;
  onAttack: (targetId: string) => void;
  onFormationChange: (formation: Formation) => void;
  onRetreat: () => void;
  onAutoPlay: () => void;
}

export function CommandPanel({
  selectedFleet, onMove, onAttack, onFormationChange, onRetreat, onAutoPlay
}: CommandPanelProps) {
  if (!selectedFleet) {
    return (
      <div className={styles.panel}>
        <p>함대를 선택하세요</p>
      </div>
    );
  }
  
  return (
    <div className={styles.panel}>
      <div className={styles.fleetInfo}>
        <h3>{selectedFleet.name}</h3>
        <p>제독: {selectedFleet.commander.name}</p>
        <p>함선: {selectedFleet.ships.length.toLocaleString()}척</p>
      </div>
      
      <div className={styles.commands}>
        <button onClick={onMove}>
          <MoveIcon /> 이동
        </button>
        <button onClick={() => onAttack('')}>
          <AttackIcon /> 공격
        </button>
        <select 
          value={selectedFleet.formation}
          onChange={e => onFormationChange(e.target.value as Formation)}
        >
          <option value="fishScale">어린</option>
          <option value="craneWing">학익</option>
          <option value="circular">방원</option>
          <option value="arrowhead">봉시</option>
          <option value="longSnake">장사</option>
        </select>
        <button onClick={onRetreat}>
          <RetreatIcon /> 후퇴
        </button>
        <button onClick={onAutoPlay}>
          <AutoIcon /> 자동
        </button>
      </div>
    </div>
  );
}
```

---

## 테스트 시나리오

### 시나리오 1: 기본 렌더링
- 우주 배경 표시
- 아군 3함대, 적군 3함대 표시
- 각 함대 진형에 따른 아이콘

### 시나리오 2: 줌/팬
- 마우스 휠로 줌 인/아웃
- 드래그로 맵 이동
- 미니맵과 동기화

### 시나리오 3: 함대 선택
- 함대 클릭 시 선택 하이라이트
- HUD에 함대 정보 표시
- 사정거리 원 표시

### 시나리오 4: 실시간 이동
- WebSocket으로 함대 위치 업데이트
- 부드러운 보간 이동
- 60fps 유지

### 시나리오 5: 공격
- 적 함대 타겟팅
- 공격 이펙트 (레이저/미사일)
- 피격 이펙트

---

## 체크리스트

- [ ] 기존 TacticalMap.tsx 분석
- [ ] BattleCanvas.tsx 분석
- [ ] LOGH7_MANUAL_SUMMARY.md 숙지
- [ ] Canvas 기반 맵 렌더링
- [ ] 우주 배경 (별, 성운)
- [ ] 함대 아이콘 (진형별)
- [ ] 줌/팬 기능
- [ ] 미니맵
- [ ] 함대 선택 및 하이라이트
- [ ] 사정거리 표시
- [ ] WebSocket 연동
- [ ] 실시간 이동 애니메이션
- [ ] 명령 패널
- [ ] 함대 정보 HUD
- [ ] 공격 이펙트
- [ ] 60fps 성능 최적화




