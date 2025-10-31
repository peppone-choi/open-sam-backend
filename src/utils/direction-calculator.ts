/**
 * 도시 간 연결 방향 자동 계산
 * 
 * 두 도시의 x, y 좌표를 기반으로 8방향 중 하나를 결정
 */

export type Direction = 
  | 'north'      // 북 (0, -1)
  | 'northeast'  // 북동 (1, -1)
  | 'east'       // 동 (1, 0)
  | 'southeast'  // 남동 (1, 1)
  | 'south'      // 남 (0, 1)
  | 'southwest'  // 남서 (-1, 1)
  | 'west'       // 서 (-1, 0)
  | 'northwest'; // 북서 (-1, -1)

export interface CityPosition {
  cityId: number;
  name: string;
  x: number;
  y: number;
}

/**
 * 두 도시 간의 방향 계산
 * 
 * @param from 출발 도시
 * @param to 도착 도시
 * @returns 8방향 중 하나
 */
export function calculateDirection(from: CityPosition, to: CityPosition): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  // 각도 계산 (라디안 → 도)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // 8방향으로 변환
  // 동쪽을 0도, 반시계방향으로 회전
  // 각 방향은 45도씩 차지
  const normalizedAngle = ((angle + 360) % 360);
  
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    return 'east';         // 0도 ± 22.5도
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    return 'southeast';    // 45도 ± 22.5도
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    return 'south';        // 90도 ± 22.5도
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    return 'southwest';    // 135도 ± 22.5도
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    return 'west';         // 180도 ± 22.5도
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    return 'northwest';    // 225도 ± 22.5도
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    return 'north';        // 270도 ± 22.5도
  } else {
    return 'northeast';    // 315도 ± 22.5도
  }
}

/**
 * 반대 방향 계산
 */
export function getOppositeDirection(direction: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    'north': 'south',
    'northeast': 'southwest',
    'east': 'west',
    'southeast': 'northwest',
    'south': 'north',
    'southwest': 'northeast',
    'west': 'east',
    'northwest': 'southeast'
  };
  return opposites[direction];
}

/**
 * 방향 → 맵 좌표 변환 (40x40 맵 기준)
 */
export function directionToExitPosition(direction: Direction): { x: number; y: number } {
  const positions: Record<Direction, { x: number; y: number }> = {
    'north':     { x: 20, y: 0 },   // 북쪽 중앙
    'northeast': { x: 35, y: 5 },   // 북동쪽
    'east':      { x: 39, y: 20 },  // 동쪽 중앙
    'southeast': { x: 35, y: 35 },  // 남동쪽
    'south':     { x: 20, y: 39 },  // 남쪽 중앙
    'southwest': { x: 5, y: 35 },   // 남서쪽
    'west':      { x: 0, y: 20 },   // 서쪽 중앙
    'northwest': { x: 5, y: 5 }     // 북서쪽
  };
  return positions[direction];
}

/**
 * 방향 → 배치 영역 계산
 * 
 * 공격자가 진입한 맵 가장자리 1칸 (끝 라인)
 */
export function getDeploymentZone(direction: Direction): { x: number; y: number }[] {
  const zones: Record<Direction, { x: number; y: number }[]> = {
    'north': generateEdgeLine('horizontal', 0),      // 최상단 가로줄 (y=0)
    'northeast': generateCorner(39, 0, 5),           // 우상단 모서리 (5칸)
    'east': generateEdgeLine('vertical', 39),        // 최우측 세로줄 (x=39)
    'southeast': generateCorner(39, 39, 5),          // 우하단 모서리 (5칸)
    'south': generateEdgeLine('horizontal', 39),     // 최하단 가로줄 (y=39)
    'southwest': generateCorner(0, 39, 5),           // 좌하단 모서리 (5칸)
    'west': generateEdgeLine('vertical', 0),         // 최좌측 세로줄 (x=0)
    'northwest': generateCorner(0, 0, 5)             // 좌상단 모서리 (5칸)
  };
  return zones[direction];
}

/**
 * 가장자리 라인 생성 (정면 진입)
 */
function generateEdgeLine(
  type: 'horizontal' | 'vertical', 
  position: number
): { x: number; y: number }[] {
  const line: { x: number; y: number }[] = [];
  
  if (type === 'horizontal') {
    // 가로줄: y는 고정, x는 0~39
    for (let x = 0; x < 40; x++) {
      line.push({ x, y: position });
    }
  } else {
    // 세로줄: x는 고정, y는 0~39
    for (let y = 0; y < 40; y++) {
      line.push({ x: position, y });
    }
  }
  
  return line;
}

/**
 * 모서리 영역 생성 (대각선 진입)
 * 
 * @param x 모서리 x 좌표 (0 또는 39)
 * @param y 모서리 y 좌표 (0 또는 39)
 * @param size 모서리에서 뻗어나가는 칸 수 (기본 5칸)
 */
function generateCorner(
  x: number, 
  y: number, 
  size: number = 5
): { x: number; y: number }[] {
  const corner: { x: number; y: number }[] = [];
  
  // x, y 방향 결정
  const xDir = x === 0 ? 1 : -1;  // 왼쪽이면 오른쪽으로, 오른쪽이면 왼쪽으로
  const yDir = y === 0 ? 1 : -1;  // 위쪽이면 아래로, 아래쪽이면 위로
  
  // L자 형태로 모서리 타일 생성
  // 가로 라인
  for (let i = 0; i < size; i++) {
    const newX = x + (i * xDir);
    if (newX >= 0 && newX < 40) {
      corner.push({ x: newX, y });
    }
  }
  
  // 세로 라인 (모서리 중복 제거)
  for (let i = 1; i < size; i++) {
    const newY = y + (i * yDir);
    if (newY >= 0 && newY < 40) {
      corner.push({ x, y: newY });
    }
  }
  
  return corner;
}

/**
 * 예시 사용법
 */
export function example() {
  // 낙양 (330, 215) → 하내 (295, 140)
  const luoyang: CityPosition = { cityId: 1, name: '낙양', x: 330, y: 215 };
  const hanoi: CityPosition = { cityId: 32, name: '하내', x: 295, y: 140 };
  
  const direction = calculateDirection(luoyang, hanoi);
  console.log(`낙양 → 하내: ${direction}`); // "northwest"
  
  const opposite = getOppositeDirection(direction);
  console.log(`하내 → 낙양: ${opposite}`); // "southeast"
  
  const exitPos = directionToExitPosition(direction);
  console.log(`출구 위치: (${exitPos.x}, ${exitPos.y})`);
  
  const deployZone = getDeploymentZone(direction);
  console.log(`배치 영역: ${deployZone.length}칸`);
}
