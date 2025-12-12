/**
 * GIN7 Fleet Formation Types
 * 
 * 진형(Formation) 시스템 타입 정의
 * - 은하영웅전설 VII 매뉴얼 기반
 */

/**
 * 진형 타입 (은영전 VII 기준)
 */
export type FormationType =
  | 'STANDARD'    // 기본 진형 - 균형
  | 'SPINDLE'     // 방추진 (錐行陣) - 돌파력 특화
  | 'LINE'        // 횡열진 (橫列陣) - 일제사격 특화
  | 'CIRCULAR'    // 차륜진/원형진 (車輪陣) - 방어 특화
  | 'ECHELON'     // 사선진 (斜線陣) - 측면 유리
  | 'WEDGE'       // 쐐기진 - 돌파용
  | 'ENCIRCLE'    // 포위진 - 포위 특화
  | 'RETREAT';    // 퇴각 대형

/**
 * 진형별 스탯 보정 (백분율)
 */
export interface FormationModifiers {
  attackPower: number;      // 공격력 배율 (1.0 = 100%)
  defensePower: number;     // 방어력 배율
  accuracy: number;         // 명중률 배율
  evasion: number;          // 회피율 배율
  turnRate: number;         // 선회력 배율
  broadside: number;        // 측면 사격 수 배율 (동시 사격 가능 함선 비율)
  exposedArea: number;      // 피탄면적 (높을수록 불리)
  blindSpot: number;        // 사각지대 (높을수록 불리)
  penetration: number;      // 돌파력 (적진 돌파 시 피해 감소)
  speed: number;            // 이동속도 배율
}

/**
 * 진형 정의
 */
export interface FormationDefinition {
  type: FormationType;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  modifiers: FormationModifiers;
  
  // 진형 변경 요구사항
  minShips: number;         // 최소 함선 수
  changeTime: number;       // 변경 소요 시간 (초, 100함선 기준)
  
  // 추천 상황
  recommendedFor: string[];
}

/**
 * 기동 타입
 */
export type ManeuverType =
  | 'PARALLEL_MOVE'   // 평행 이동 (Slide)
  | 'TURN_180'        // 반전 (U-Turn)
  | 'TURN_90_LEFT'    // 좌측 90도 회전
  | 'TURN_90_RIGHT'   // 우측 90도 회전
  | 'SPREAD'          // 전개 (대형 확장)
  | 'COMPRESS';       // 압축 (대형 축소)

/**
 * 기동 상태
 */
export interface ManeuverState {
  type: ManeuverType;
  startTick: number;
  duration: number;         // 틱 단위
  progress: number;         // 0-1
  
  // 기동 중 페널티
  speedPenalty: number;     // 속도 페널티 (0-1, 0 = 무패널티)
  evasionPenalty: number;   // 회피 페널티
  
  // 기동 파라미터
  params: {
    targetHeading?: number;       // 목표 방향 (반전/회전용)
    direction?: { x: number; y: number; z: number };  // 이동 방향 (평행이동용)
  };
}

/**
 * 윙맨 위치 (기함 기준 상대 좌표)
 */
export interface WingmanPosition {
  unitId: string;
  offsetX: number;          // 기함 기준 X 오프셋
  offsetY: number;
  offsetZ: number;
  role: 'LEFT_WING' | 'RIGHT_WING' | 'VANGUARD' | 'REARGUARD' | 'CENTER';
}

/**
 * 대형 상태
 */
export interface FormationState {
  type: FormationType;
  leaderUnitId: string;     // 기함/대형 리더
  wingmen: WingmanPosition[];
  
  // 대형 유지 상태
  cohesion: number;         // 결속도 (0-100, 높을수록 대형 정렬됨)
  spreadLevel: number;      // 전개 수준 (1 = 밀집, 2+ = 확장)
  
  // 진형 변경 중
  isChanging: boolean;
  targetFormation?: FormationType;
  changeProgress?: number;  // 0-1
}

/**
 * 진형 변경 커맨드
 */
export interface ChangeFormationCommand {
  fleetId: string;
  targetFormation: FormationType;
  priority?: 'NORMAL' | 'URGENT';  // 긴급 시 변경 시간 감소하지만 결속도 페널티
}

/**
 * 기동 커맨드
 */
export interface ManeuverCommand {
  unitIds: string[];
  type: ManeuverType;
  params?: {
    direction?: { x: number; y: number; z: number };
  };
}

/**
 * 진형 스탯 보정 상수
 */
export const FORMATION_MODIFIERS: Record<FormationType, FormationModifiers> = {
  STANDARD: {
    attackPower: 1.0,
    defensePower: 1.0,
    accuracy: 1.0,
    evasion: 1.0,
    turnRate: 1.0,
    broadside: 0.5,
    exposedArea: 1.0,
    blindSpot: 0.2,
    penetration: 1.0,
    speed: 1.0,
  },
  
  // 방추진: 돌파력+, 선회력-
  SPINDLE: {
    attackPower: 1.15,
    defensePower: 1.0,
    accuracy: 1.0,
    evasion: 0.9,
    turnRate: 0.7,        // 선회력 -30%
    broadside: 0.3,       // 측면 사격 불리
    exposedArea: 0.7,     // 피탄면적 감소 (전면만 노출)
    blindSpot: 0.4,       // 사각지대 증가
    penetration: 1.2,     // 돌파력 +20%
    speed: 1.1,           // 속도 +10%
  },
  
  // 횡열진: 일제사격+, 피탄면적+
  LINE: {
    attackPower: 1.0,
    defensePower: 0.9,
    accuracy: 1.1,        // 명중률 +10%
    evasion: 0.8,         // 회피 -20%
    turnRate: 0.8,
    broadside: 1.5,       // 측면 사격 +50%
    exposedArea: 1.5,     // 피탄면적 +50%
    blindSpot: 0.1,       // 사각지대 최소
    penetration: 0.8,
    speed: 0.9,
  },
  
  // 차륜진: 방어력+, 사각지대-
  CIRCULAR: {
    attackPower: 0.9,
    defensePower: 1.2,    // 방어력 +20%
    accuracy: 0.95,
    evasion: 1.1,
    turnRate: 0.6,        // 선회력 낮음
    broadside: 1.0,
    exposedArea: 1.0,
    blindSpot: 0.0,       // 사각지대 없음
    penetration: 0.7,
    speed: 0.7,           // 속도 낮음
  },
  
  // 사선진: 측면 방어 유리
  ECHELON: {
    attackPower: 1.05,
    defensePower: 1.1,
    accuracy: 1.0,
    evasion: 1.1,         // 측면 회피 +10%
    turnRate: 1.1,
    broadside: 0.8,
    exposedArea: 0.9,
    blindSpot: 0.15,
    penetration: 1.0,
    speed: 1.0,
  },
  
  // 쐐기진: 돌파 특화
  WEDGE: {
    attackPower: 1.2,
    defensePower: 0.95,
    accuracy: 1.05,
    evasion: 0.85,
    turnRate: 0.75,
    broadside: 0.2,       // 측면 사격 불리
    exposedArea: 0.8,
    blindSpot: 0.5,       // 사각지대 많음
    penetration: 1.3,     // 돌파력 +30%
    speed: 1.15,
  },
  
  // 포위진: 포위 특화
  ENCIRCLE: {
    attackPower: 1.1,
    defensePower: 0.85,
    accuracy: 1.15,       // 집중 사격
    evasion: 0.9,
    turnRate: 0.5,        // 선회력 낮음
    broadside: 1.3,
    exposedArea: 1.2,
    blindSpot: 0.0,
    penetration: 0.6,
    speed: 0.6,           // 속도 낮음
  },
  
  // 퇴각 대형: 후퇴 특화
  RETREAT: {
    attackPower: 0.5,     // 공격력 대폭 감소
    defensePower: 1.0,
    accuracy: 0.7,
    evasion: 1.3,         // 회피 +30%
    turnRate: 1.2,
    broadside: 0.2,
    exposedArea: 0.8,
    blindSpot: 0.3,
    penetration: 0.5,
    speed: 1.4,           // 속도 +40%
  },
};

/**
 * 진형 정의 상수
 */
export const FORMATION_DEFINITIONS: Record<FormationType, FormationDefinition> = {
  STANDARD: {
    type: 'STANDARD',
    name: 'Standard Formation',
    nameKo: '기본진',
    description: 'Balanced formation with no specific advantages',
    descriptionKo: '특별한 장단점 없이 균형 잡힌 기본 대형',
    modifiers: FORMATION_MODIFIERS.STANDARD,
    minShips: 1,
    changeTime: 5,
    recommendedFor: ['general', 'patrol'],
  },
  
  SPINDLE: {
    type: 'SPINDLE',
    name: 'Spindle Formation',
    nameKo: '방추진(錐行陣)',
    description: 'Concentrated tip for breakthrough attacks. High penetration but weak flanks.',
    descriptionKo: '전위에 전력을 집중한 돌파 대형. 돌파력 우수하나 측면 취약.',
    modifiers: FORMATION_MODIFIERS.SPINDLE,
    minShips: 10,
    changeTime: 15,
    recommendedFor: ['breakthrough', 'charge', 'pursuit'],
  },
  
  LINE: {
    type: 'LINE',
    name: 'Line Formation',
    nameKo: '횡열진(橫列陣)',
    description: 'Horizontal spread for maximum broadside firepower.',
    descriptionKo: '횡대로 전개하여 일제사격에 유리. 피탄면적 증가.',
    modifiers: FORMATION_MODIFIERS.LINE,
    minShips: 10,
    changeTime: 20,
    recommendedFor: ['ranged_combat', 'suppression', 'siege'],
  },
  
  CIRCULAR: {
    type: 'CIRCULAR',
    name: 'Circular Formation',
    nameKo: '차륜진(車輪陣)',
    description: 'Defensive circle with no blind spots. Slow but resilient.',
    descriptionKo: '원형 대형으로 사각지대 없음. 느리지만 방어 우수.',
    modifiers: FORMATION_MODIFIERS.CIRCULAR,
    minShips: 20,
    changeTime: 30,
    recommendedFor: ['defense', 'surrounded', 'protect_flagship'],
  },
  
  ECHELON: {
    type: 'ECHELON',
    name: 'Echelon Formation',
    nameKo: '사선진(斜線陣)',
    description: 'Diagonal formation for flanking maneuvers.',
    descriptionKo: '사선 대형으로 측면 기동에 유리.',
    modifiers: FORMATION_MODIFIERS.ECHELON,
    minShips: 15,
    changeTime: 18,
    recommendedFor: ['flanking', 'mixed_combat'],
  },
  
  WEDGE: {
    type: 'WEDGE',
    name: 'Wedge Formation',
    nameKo: '쐐기진',
    description: 'Arrow-shaped assault formation for maximum penetration.',
    descriptionKo: '화살촉 모양의 돌격 대형. 돌파력 최대화.',
    modifiers: FORMATION_MODIFIERS.WEDGE,
    minShips: 15,
    changeTime: 20,
    recommendedFor: ['assault', 'decisive_strike'],
  },
  
  ENCIRCLE: {
    type: 'ENCIRCLE',
    name: 'Encirclement Formation',
    nameKo: '포위진',
    description: 'Spread formation to surround and contain enemies.',
    descriptionKo: '적을 포위하는 대형. 집중 화력 가능.',
    modifiers: FORMATION_MODIFIERS.ENCIRCLE,
    minShips: 30,
    changeTime: 35,
    recommendedFor: ['encirclement', 'numerical_superiority'],
  },
  
  RETREAT: {
    type: 'RETREAT',
    name: 'Retreat Formation',
    nameKo: '퇴각진',
    description: 'Withdrawal formation optimized for escape.',
    descriptionKo: '후퇴에 최적화된 대형. 회피와 속도 증가.',
    modifiers: FORMATION_MODIFIERS.RETREAT,
    minShips: 1,
    changeTime: 8,
    recommendedFor: ['retreat', 'escape'],
  },
};

/**
 * 기동 소요 시간 상수 (틱 단위)
 */
export const MANEUVER_DURATIONS: Record<ManeuverType, number> = {
  PARALLEL_MOVE: 30,    // ~2초 (16.67틱/초)
  TURN_180: 60,         // ~4초
  TURN_90_LEFT: 30,
  TURN_90_RIGHT: 30,
  SPREAD: 45,
  COMPRESS: 45,
};

/**
 * 기동 페널티 상수
 */
export const MANEUVER_PENALTIES: Record<ManeuverType, { speed: number; evasion: number }> = {
  PARALLEL_MOVE: { speed: 0.5, evasion: 0.1 },    // 속도 50% 감소
  TURN_180: { speed: 1.0, evasion: 1.0 },         // 완전 정지, 회피 불가
  TURN_90_LEFT: { speed: 0.7, evasion: 0.5 },
  TURN_90_RIGHT: { speed: 0.7, evasion: 0.5 },
  SPREAD: { speed: 0.3, evasion: 0.2 },
  COMPRESS: { speed: 0.3, evasion: 0.2 },
};















