/**
 * 요새(Fortress) 관련 타입 정의
 * 
 * 은하영웅전설의 이제르론 요새, 가이에스부르크 요새 등 전략적 요새를 표현합니다.
 */

/**
 * 요새 타입
 */
export type FortressType = 
  | 'ISERLOHN'      // 이제르론 요새 - 고정형, 토르 해머
  | 'GEIERSBURG'    // 가이에스부르크 요새 - 이동형
  | 'RENTENBERG'    // 렌텐베르크 요새 - 고정형
  | 'STANDARD';     // 표준 요새

/**
 * 요새 상태
 */
export type FortressStatus =
  | 'OPERATIONAL'   // 정상 운용
  | 'DAMAGED'       // 손상
  | 'UNDER_SIEGE'   // 포위 중
  | 'REPAIRING'     // 수리 중
  | 'MOVING'        // 이동 중 (가이에스부르크만)
  | 'DESTROYED';    // 파괴됨

/**
 * 주포 타입
 */
export type MainCannonType =
  | 'THOR_HAMMER'   // 토르 해머 (이제르론)
  | 'GEIERFAUST'    // 가이어파우스트 (가이에스부르크)
  | 'STANDARD_CANNON'; // 표준 주포

/**
 * 요새 부위/시스템
 */
export type FortressComponent =
  | 'MAIN_CANNON'       // 주포
  | 'SHIELD_GENERATOR'  // 방어막 발생기
  | 'ENGINE'            // 추진 시스템 (이동형 요새만)
  | 'DOCK'              // 도킹 베이
  | 'COMMAND_CENTER'    // 사령부
  | 'LIFE_SUPPORT'      // 생명 유지
  | 'REACTOR';          // 반응로

/**
 * 요새 스펙 (정적 데이터)
 */
export interface IFortressSpec {
  type: FortressType;
  name: string;
  nameKo: string;
  
  // 주포
  mainCannonType: MainCannonType;
  mainCannonPower: number;      // 기본 주포 화력
  mainCannonRange: number;      // 사거리 (성계 내 그리드 단위)
  mainCannonCooldown: number;   // 재충전 시간 (턴)
  
  // 방어력
  maxShield: number;            // 최대 방어막
  shieldRegenRate: number;      // 방어막 재생률 (턴당)
  maxHp: number;                // 최대 내구도
  armor: number;                // 장갑
  
  // 수용력
  garrisonCapacity: number;     // 수비 함대 수용량 (함대 수)
  fighterCapacity: number;      // 함재기 수용량
  troopCapacity: number;        // 병력 수용량
  
  // 이동 (이동형 요새만)
  canMove: boolean;
  speed?: number;               // 이동 속도
  warpCapable?: boolean;        // 워프 가능 여부
  
  // 유지 비용 (턴당)
  maintenanceCost: {
    credits: number;
    energy: number;
    supplies: number;
  };
}

/**
 * 요새 데미지 결과
 */
export interface FortressDamageResult {
  fortressId: string;
  totalDamage: number;
  shieldDamage: number;
  hpDamage: number;
  componentDamage: Array<{
    component: FortressComponent;
    damage: number;
    destroyed: boolean;
  }>;
  isDestroyed: boolean;
}

/**
 * 주포 발사 결과
 */
export interface MainCannonFireResult {
  fortressId: string;
  targetFleetId: string;
  damage: number;
  shipsDestroyed: number;
  hit: boolean;
  criticalHit: boolean;
  cooldownTurns: number;
}

/**
 * 포위전 상태
 */
export interface SiegeState {
  siegeId: string;
  fortressId: string;
  attackingFleetIds: string[];
  defendingFleetIds: string[];
  
  // 포위 진행도 (0-100)
  progress: number;
  
  // 턴 카운터
  startTurn: number;
  currentTurn: number;
  
  // 상태
  status: 'ACTIVE' | 'BREACHED' | 'BROKEN' | 'SURRENDERED';
  
  // 양측 피해
  attackerLosses: {
    shipsLost: number;
    casualtiesTotal: number;
  };
  defenderLosses: {
    shipsLost: number;
    casualtiesTotal: number;
    shieldDamage: number;
    hpDamage: number;
  };
}

/**
 * 포위전 결과
 */
export interface SiegeResult {
  siegeId: string;
  fortressId: string;
  outcome: 'CAPTURED' | 'DEFENDED' | 'ONGOING' | 'RETREAT';
  
  // 최종 상태
  fortressHpPercent: number;
  fortressShieldPercent: number;
  
  // 피해 통계
  attackerLosses: {
    shipsLost: number;
    casualtiesTotal: number;
    creditsLost: number;
  };
  defenderLosses: {
    shipsLost: number;
    casualtiesTotal: number;
    creditsLost: number;
  };
  
  // 점령 정보 (점령 성공 시)
  newOwnerId?: string;
}

/**
 * 요새 수리 요청
 */
export interface FortressRepairRequest {
  sessionId: string;
  fortressId: string;
  components?: FortressComponent[];  // 비어 있으면 전체 수리
  priority?: 'NORMAL' | 'EMERGENCY';
}

/**
 * 요새 수리 결과
 */
export interface FortressRepairResult {
  fortressId: string;
  repaired: Array<{
    component: FortressComponent;
    previousHp: number;
    currentHp: number;
    maxHp: number;
  }>;
  totalCost: {
    credits: number;
    minerals: number;
    shipParts: number;
  };
  turnsRemaining: number;
}

/**
 * 요새 스펙 테이블 (정적 데이터)
 */
export const FORTRESS_SPECS: Record<FortressType, IFortressSpec> = {
  ISERLOHN: {
    type: 'ISERLOHN',
    name: 'Iserlohn Fortress',
    nameKo: '이제르론 요새',
    
    mainCannonType: 'THOR_HAMMER',
    mainCannonPower: 50000,     // 함대 1개를 순식간에 괴멸시킬 수 있는 화력
    mainCannonRange: 10,        // 넓은 사거리
    mainCannonCooldown: 3,      // 3턴 재충전
    
    maxShield: 100000,
    shieldRegenRate: 5000,
    maxHp: 200000,
    armor: 500,
    
    garrisonCapacity: 5,        // 최대 5개 함대
    fighterCapacity: 2000,
    troopCapacity: 100000,
    
    canMove: false,
    
    maintenanceCost: {
      credits: 100000,
      energy: 50000,
      supplies: 30000,
    },
  },
  
  GEIERSBURG: {
    type: 'GEIERSBURG',
    name: 'Geiersburg Fortress',
    nameKo: '가이에스부르크 요새',
    
    mainCannonType: 'GEIERFAUST',
    mainCannonPower: 40000,
    mainCannonRange: 8,
    mainCannonCooldown: 3,
    
    maxShield: 80000,
    shieldRegenRate: 4000,
    maxHp: 150000,
    armor: 400,
    
    garrisonCapacity: 4,
    fighterCapacity: 1500,
    troopCapacity: 80000,
    
    canMove: true,              // 이동 가능!
    speed: 1,                   // 느린 이동 속도
    warpCapable: true,          // 워프 가능
    
    maintenanceCost: {
      credits: 120000,
      energy: 80000,
      supplies: 40000,
    },
  },
  
  RENTENBERG: {
    type: 'RENTENBERG',
    name: 'Rentenberg Fortress',
    nameKo: '렌텐베르크 요새',
    
    mainCannonType: 'STANDARD_CANNON',
    mainCannonPower: 30000,
    mainCannonRange: 6,
    mainCannonCooldown: 2,
    
    maxShield: 60000,
    shieldRegenRate: 3000,
    maxHp: 100000,
    armor: 300,
    
    garrisonCapacity: 3,
    fighterCapacity: 1000,
    troopCapacity: 50000,
    
    canMove: false,
    
    maintenanceCost: {
      credits: 60000,
      energy: 30000,
      supplies: 20000,
    },
  },
  
  STANDARD: {
    type: 'STANDARD',
    name: 'Standard Fortress',
    nameKo: '표준 요새',
    
    mainCannonType: 'STANDARD_CANNON',
    mainCannonPower: 15000,
    mainCannonRange: 5,
    mainCannonCooldown: 2,
    
    maxShield: 30000,
    shieldRegenRate: 1500,
    maxHp: 50000,
    armor: 200,
    
    garrisonCapacity: 2,
    fighterCapacity: 500,
    troopCapacity: 20000,
    
    canMove: false,
    
    maintenanceCost: {
      credits: 30000,
      energy: 15000,
      supplies: 10000,
    },
  },
};

/**
 * 요새 부위별 HP 비율 (전체 HP 대비)
 */
export const FORTRESS_COMPONENT_HP_RATIO: Record<FortressComponent, number> = {
  MAIN_CANNON: 0.2,
  SHIELD_GENERATOR: 0.15,
  ENGINE: 0.1,
  DOCK: 0.15,
  COMMAND_CENTER: 0.1,
  LIFE_SUPPORT: 0.1,
  REACTOR: 0.2,
};

/**
 * 부위 파괴 시 효과
 */
export const FORTRESS_COMPONENT_EFFECTS: Record<FortressComponent, {
  description: string;
  effects: string[];
}> = {
  MAIN_CANNON: {
    description: '주포가 파괴되어 화력 상실',
    effects: ['NO_MAIN_CANNON', 'ATTACK_POWER_-100%'],
  },
  SHIELD_GENERATOR: {
    description: '방어막 발생기 파괴',
    effects: ['NO_SHIELD', 'SHIELD_REGEN_-100%'],
  },
  ENGINE: {
    description: '추진 시스템 파괴 (이동 불가)',
    effects: ['NO_MOVEMENT', 'NO_WARP'],
  },
  DOCK: {
    description: '도킹 베이 파괴',
    effects: ['NO_DOCKING', 'NO_RESUPPLY'],
  },
  COMMAND_CENTER: {
    description: '사령부 파괴',
    effects: ['COMMAND_PENALTY', 'MORALE_-50%'],
  },
  LIFE_SUPPORT: {
    description: '생명 유지 시스템 손상',
    effects: ['CREW_LOSS_PER_TURN', 'MORALE_-30%'],
  },
  REACTOR: {
    description: '반응로 손상',
    effects: ['POWER_-50%', 'SHIELD_REGEN_-50%', 'MAIN_CANNON_POWER_-30%'],
  },
};












