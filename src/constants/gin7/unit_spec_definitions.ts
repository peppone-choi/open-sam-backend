/**
 * GIN7 유닛 스펙 정의 데이터베이스
 * 매뉴얼 기반 함급별 상세 스펙 구현
 */

// ============================================================
// 유닛 타입 정의
// ============================================================

export type ShipCategory = 
  | 'BATTLESHIP'      // 전함
  | 'CRUISER'         // 순양함
  | 'DESTROYER'       // 구축함
  | 'CARRIER'         // 항공모함
  | 'TRANSPORT'       // 수송함
  | 'SUPPLY'          // 보급함
  | 'SUPPORT'         // 지원함
  | 'FORTRESS'        // 요새
  | 'FIGHTER';        // 전투정

export type FactionType = 'EMPIRE' | 'ALLIANCE' | 'FEZZAN' | 'NEUTRAL';

// ============================================================
// 공통 스탯 인터페이스
// ============================================================

export interface CommonStats {
  maxHp: number;                 // 최대 내구도
  maxShield: number;             // 최대 쉴드
  speed: number;                 // 이동 속도
  turnRate: number;              // 회전 속도
  sensorRange: number;           // 센서 범위
  crewCapacity: number;          // 승조원 정원
}

export interface ArmorStats {
  frontArmor: number;            // 전면 장갑
  sideArmor: number;             // 측면 장갑
  rearArmor: number;             // 후면 장갑
  armorType: 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'FORTRESS';
}

export interface WeaponStats {
  mainGunCount: number;          // 주포 수
  mainGunDamage: number;         // 주포 데미지
  mainGunRange: number;          // 주포 사거리
  mainGunFireRate: number;       // 주포 발사 속도 (초당)
  
  secondaryGunCount: number;     // 부포 수
  secondaryGunDamage: number;    // 부포 데미지
  
  missileCount: number;          // 미사일 적재량
  missileDamage: number;         // 미사일 데미지
  missileRange: number;          // 미사일 사거리
  
  torpedoCount: number;          // 어뢰 적재량
  torpedoDamage: number;         // 어뢰 데미지
}

export interface CargoStats {
  cargoCapacity: number;         // 화물 적재량
  fuelCapacity: number;          // 연료 용량
  ammoCapacity: number;          // 탄약 용량
  fighterCapacity: number;       // 함재기 탑재량
  troopCapacity: number;         // 육전대 탑재량
}

export interface RepairStats {
  repairCostCredits: number;     // 수리 비용 (크레딧)
  repairCostMaterials: number;   // 수리 비용 (자재)
  repairTimeBase: number;        // 기본 수리 시간 (틱)
  buildTime: number;             // 건조 시간 (틱)
  buildCost: number;             // 건조 비용
}

// ============================================================
// 유닛 스펙 인터페이스
// ============================================================

export interface UnitSpec {
  id: string;
  name: string;
  nameJp?: string;               // 일본어 이름
  faction: FactionType;
  category: ShipCategory;
  tier: 1 | 2 | 3 | 4 | 5;      // 등급 (1 = 저급, 5 = 최상급)
  
  common: CommonStats;
  armor: ArmorStats;
  weapons: WeaponStats;
  cargo: CargoStats;
  repair: RepairStats;
  
  // 특수 능력
  specialAbilities: string[];
  
  // 설명
  description: string;
}

// ============================================================
// 제국군 함선 정의
// ============================================================

export const EMPIRE_SHIPS: UnitSpec[] = [
  // 전함
  {
    id: 'EMPIRE_BATTLESHIP_STANDARD',
    name: '제국 표준 전함',
    nameJp: '帝国標準戦艦',
    faction: 'EMPIRE',
    category: 'BATTLESHIP',
    tier: 3,
    common: {
      maxHp: 2000,
      maxShield: 500,
      speed: 50,
      turnRate: 2,
      sensorRange: 5000,
      crewCapacity: 800,
    },
    armor: {
      frontArmor: 100,
      sideArmor: 70,
      rearArmor: 40,
      armorType: 'HEAVY',
    },
    weapons: {
      mainGunCount: 8,
      mainGunDamage: 150,
      mainGunRange: 4000,
      mainGunFireRate: 0.5,
      secondaryGunCount: 16,
      secondaryGunDamage: 50,
      missileCount: 24,
      missileDamage: 200,
      missileRange: 6000,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 500,
      fuelCapacity: 2000,
      ammoCapacity: 1000,
      fighterCapacity: 0,
      troopCapacity: 100,
    },
    repair: {
      repairCostCredits: 5000,
      repairCostMaterials: 200,
      repairTimeBase: 48,
      buildTime: 720,
      buildCost: 50000,
    },
    specialAbilities: [],
    description: '제국 해군의 주력 전함. 균형 잡힌 성능.',
  },
  {
    id: 'EMPIRE_BATTLESHIP_BRUNHILD',
    name: '브륀힐트급',
    nameJp: 'ブリュンヒルト級',
    faction: 'EMPIRE',
    category: 'BATTLESHIP',
    tier: 5,
    common: {
      maxHp: 3500,
      maxShield: 1000,
      speed: 70,
      turnRate: 3,
      sensorRange: 8000,
      crewCapacity: 1200,
    },
    armor: {
      frontArmor: 150,
      sideArmor: 100,
      rearArmor: 60,
      armorType: 'HEAVY',
    },
    weapons: {
      mainGunCount: 12,
      mainGunDamage: 250,
      mainGunRange: 5000,
      mainGunFireRate: 0.6,
      secondaryGunCount: 24,
      secondaryGunDamage: 80,
      missileCount: 48,
      missileDamage: 300,
      missileRange: 8000,
      torpedoCount: 12,
      torpedoDamage: 500,
    },
    cargo: {
      cargoCapacity: 800,
      fuelCapacity: 3000,
      ammoCapacity: 2000,
      fighterCapacity: 12,
      troopCapacity: 200,
    },
    repair: {
      repairCostCredits: 15000,
      repairCostMaterials: 600,
      repairTimeBase: 96,
      buildTime: 1440,
      buildCost: 200000,
    },
    specialAbilities: ['FLAGSHIP_BONUS', 'COMMAND_RANGE_EXTENDED'],
    description: '라인하르트의 기함급. 최정예 전함.',
  },

  // 순양함
  {
    id: 'EMPIRE_CRUISER_STANDARD',
    name: '제국 표준 순양함',
    nameJp: '帝国標準巡洋艦',
    faction: 'EMPIRE',
    category: 'CRUISER',
    tier: 2,
    common: {
      maxHp: 1200,
      maxShield: 300,
      speed: 80,
      turnRate: 4,
      sensorRange: 6000,
      crewCapacity: 400,
    },
    armor: {
      frontArmor: 60,
      sideArmor: 40,
      rearArmor: 25,
      armorType: 'MEDIUM',
    },
    weapons: {
      mainGunCount: 4,
      mainGunDamage: 100,
      mainGunRange: 3500,
      mainGunFireRate: 0.8,
      secondaryGunCount: 8,
      secondaryGunDamage: 40,
      missileCount: 16,
      missileDamage: 150,
      missileRange: 5000,
      torpedoCount: 8,
      torpedoDamage: 300,
    },
    cargo: {
      cargoCapacity: 300,
      fuelCapacity: 1500,
      ammoCapacity: 600,
      fighterCapacity: 0,
      troopCapacity: 50,
    },
    repair: {
      repairCostCredits: 2500,
      repairCostMaterials: 100,
      repairTimeBase: 24,
      buildTime: 360,
      buildCost: 25000,
    },
    specialAbilities: [],
    description: '제국 해군의 다목적 순양함.',
  },

  // 구축함
  {
    id: 'EMPIRE_DESTROYER_STANDARD',
    name: '제국 표준 구축함',
    nameJp: '帝国標準駆逐艦',
    faction: 'EMPIRE',
    category: 'DESTROYER',
    tier: 1,
    common: {
      maxHp: 600,
      maxShield: 150,
      speed: 120,
      turnRate: 8,
      sensorRange: 4000,
      crewCapacity: 150,
    },
    armor: {
      frontArmor: 30,
      sideArmor: 20,
      rearArmor: 15,
      armorType: 'LIGHT',
    },
    weapons: {
      mainGunCount: 2,
      mainGunDamage: 60,
      mainGunRange: 2500,
      mainGunFireRate: 1.2,
      secondaryGunCount: 4,
      secondaryGunDamage: 25,
      missileCount: 8,
      missileDamage: 100,
      missileRange: 4000,
      torpedoCount: 6,
      torpedoDamage: 250,
    },
    cargo: {
      cargoCapacity: 100,
      fuelCapacity: 800,
      ammoCapacity: 300,
      fighterCapacity: 0,
      troopCapacity: 20,
    },
    repair: {
      repairCostCredits: 1000,
      repairCostMaterials: 40,
      repairTimeBase: 12,
      buildTime: 180,
      buildCost: 10000,
    },
    specialAbilities: ['TORPEDO_SALVO'],
    description: '고속 기동 가능한 경함선.',
  },

  // 항공모함
  {
    id: 'EMPIRE_CARRIER_STANDARD',
    name: '제국 표준 항공모함',
    nameJp: '帝国標準空母',
    faction: 'EMPIRE',
    category: 'CARRIER',
    tier: 3,
    common: {
      maxHp: 1800,
      maxShield: 400,
      speed: 40,
      turnRate: 1.5,
      sensorRange: 8000,
      crewCapacity: 1500,
    },
    armor: {
      frontArmor: 70,
      sideArmor: 50,
      rearArmor: 35,
      armorType: 'MEDIUM',
    },
    weapons: {
      mainGunCount: 4,
      mainGunDamage: 80,
      mainGunRange: 3000,
      mainGunFireRate: 0.4,
      secondaryGunCount: 20,
      secondaryGunDamage: 30,
      missileCount: 12,
      missileDamage: 120,
      missileRange: 4000,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 400,
      fuelCapacity: 2500,
      ammoCapacity: 800,
      fighterCapacity: 120,
      troopCapacity: 0,
    },
    repair: {
      repairCostCredits: 6000,
      repairCostMaterials: 250,
      repairTimeBase: 60,
      buildTime: 900,
      buildCost: 80000,
    },
    specialAbilities: ['FIGHTER_LAUNCH', 'AIR_SUPERIORITY'],
    description: '함재기 운용 특화 함선.',
  },

  // 수송함
  {
    id: 'EMPIRE_TRANSPORT_STANDARD',
    name: '제국 수송함',
    nameJp: '帝国輸送艦',
    faction: 'EMPIRE',
    category: 'TRANSPORT',
    tier: 1,
    common: {
      maxHp: 800,
      maxShield: 100,
      speed: 60,
      turnRate: 2,
      sensorRange: 3000,
      crewCapacity: 200,
    },
    armor: {
      frontArmor: 30,
      sideArmor: 25,
      rearArmor: 20,
      armorType: 'LIGHT',
    },
    weapons: {
      mainGunCount: 0,
      mainGunDamage: 0,
      mainGunRange: 0,
      mainGunFireRate: 0,
      secondaryGunCount: 8,
      secondaryGunDamage: 20,
      missileCount: 0,
      missileDamage: 0,
      missileRange: 0,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 2000,
      fuelCapacity: 1000,
      ammoCapacity: 200,
      fighterCapacity: 0,
      troopCapacity: 500,
    },
    repair: {
      repairCostCredits: 1500,
      repairCostMaterials: 60,
      repairTimeBase: 18,
      buildTime: 240,
      buildCost: 15000,
    },
    specialAbilities: ['TROOP_DEPLOY', 'CARGO_TRANSFER'],
    description: '병력 및 물자 수송용 함선.',
  },
];

// ============================================================
// 동맹군 함선 정의
// ============================================================

export const ALLIANCE_SHIPS: UnitSpec[] = [
  // 전함
  {
    id: 'ALLIANCE_BATTLESHIP_STANDARD',
    name: '동맹 표준 전함',
    nameJp: '同盟標準戦艦',
    faction: 'ALLIANCE',
    category: 'BATTLESHIP',
    tier: 3,
    common: {
      maxHp: 1900,
      maxShield: 550,
      speed: 55,
      turnRate: 2.5,
      sensorRange: 5500,
      crewCapacity: 750,
    },
    armor: {
      frontArmor: 90,
      sideArmor: 65,
      rearArmor: 45,
      armorType: 'HEAVY',
    },
    weapons: {
      mainGunCount: 6,
      mainGunDamage: 160,
      mainGunRange: 4200,
      mainGunFireRate: 0.55,
      secondaryGunCount: 14,
      secondaryGunDamage: 55,
      missileCount: 30,
      missileDamage: 180,
      missileRange: 6500,
      torpedoCount: 4,
      torpedoDamage: 350,
    },
    cargo: {
      cargoCapacity: 450,
      fuelCapacity: 1800,
      ammoCapacity: 1100,
      fighterCapacity: 6,
      troopCapacity: 80,
    },
    repair: {
      repairCostCredits: 4800,
      repairCostMaterials: 190,
      repairTimeBase: 44,
      buildTime: 680,
      buildCost: 48000,
    },
    specialAbilities: ['MISSILE_BARRAGE'],
    description: '동맹군의 주력 전함. 미사일 중시.',
  },
  {
    id: 'ALLIANCE_BATTLESHIP_HYPERION',
    name: '휴베리온급',
    nameJp: 'ヒューベリオン級',
    faction: 'ALLIANCE',
    category: 'BATTLESHIP',
    tier: 5,
    common: {
      maxHp: 3200,
      maxShield: 1100,
      speed: 65,
      turnRate: 3.5,
      sensorRange: 7500,
      crewCapacity: 1100,
    },
    armor: {
      frontArmor: 140,
      sideArmor: 95,
      rearArmor: 55,
      armorType: 'HEAVY',
    },
    weapons: {
      mainGunCount: 10,
      mainGunDamage: 230,
      mainGunRange: 4800,
      mainGunFireRate: 0.65,
      secondaryGunCount: 22,
      secondaryGunDamage: 70,
      missileCount: 60,
      missileDamage: 280,
      missileRange: 7500,
      torpedoCount: 8,
      torpedoDamage: 450,
    },
    cargo: {
      cargoCapacity: 700,
      fuelCapacity: 2800,
      ammoCapacity: 1800,
      fighterCapacity: 24,
      troopCapacity: 150,
    },
    repair: {
      repairCostCredits: 14000,
      repairCostMaterials: 550,
      repairTimeBase: 90,
      buildTime: 1380,
      buildCost: 190000,
    },
    specialAbilities: ['FLAGSHIP_BONUS', 'TACTICAL_COORDINATION'],
    description: '양 웬리의 기함급. 전술 능력 특화.',
  },

  // 순양함
  {
    id: 'ALLIANCE_CRUISER_STANDARD',
    name: '동맹 표준 순양함',
    nameJp: '同盟標準巡洋艦',
    faction: 'ALLIANCE',
    category: 'CRUISER',
    tier: 2,
    common: {
      maxHp: 1150,
      maxShield: 320,
      speed: 85,
      turnRate: 4.5,
      sensorRange: 6200,
      crewCapacity: 380,
    },
    armor: {
      frontArmor: 55,
      sideArmor: 38,
      rearArmor: 28,
      armorType: 'MEDIUM',
    },
    weapons: {
      mainGunCount: 4,
      mainGunDamage: 95,
      mainGunRange: 3600,
      mainGunFireRate: 0.85,
      secondaryGunCount: 10,
      secondaryGunDamage: 38,
      missileCount: 20,
      missileDamage: 140,
      missileRange: 5200,
      torpedoCount: 6,
      torpedoDamage: 280,
    },
    cargo: {
      cargoCapacity: 280,
      fuelCapacity: 1400,
      ammoCapacity: 650,
      fighterCapacity: 4,
      troopCapacity: 45,
    },
    repair: {
      repairCostCredits: 2400,
      repairCostMaterials: 95,
      repairTimeBase: 22,
      buildTime: 340,
      buildCost: 24000,
    },
    specialAbilities: ['RAPID_FIRE'],
    description: '동맹군의 다목적 순양함. 연사 특화.',
  },

  // 구축함
  {
    id: 'ALLIANCE_DESTROYER_STANDARD',
    name: '동맹 표준 구축함',
    nameJp: '同盟標準駆逐艦',
    faction: 'ALLIANCE',
    category: 'DESTROYER',
    tier: 1,
    common: {
      maxHp: 580,
      maxShield: 160,
      speed: 130,
      turnRate: 9,
      sensorRange: 4200,
      crewCapacity: 140,
    },
    armor: {
      frontArmor: 28,
      sideArmor: 18,
      rearArmor: 14,
      armorType: 'LIGHT',
    },
    weapons: {
      mainGunCount: 2,
      mainGunDamage: 55,
      mainGunRange: 2600,
      mainGunFireRate: 1.3,
      secondaryGunCount: 6,
      secondaryGunDamage: 22,
      missileCount: 12,
      missileDamage: 90,
      missileRange: 4200,
      torpedoCount: 8,
      torpedoDamage: 230,
    },
    cargo: {
      cargoCapacity: 90,
      fuelCapacity: 750,
      ammoCapacity: 320,
      fighterCapacity: 0,
      troopCapacity: 18,
    },
    repair: {
      repairCostCredits: 950,
      repairCostMaterials: 38,
      repairTimeBase: 11,
      buildTime: 170,
      buildCost: 9500,
    },
    specialAbilities: ['EVASION_BONUS', 'SCOUT'],
    description: '동맹군의 고속 함선. 정찰 특화.',
  },
];

// ============================================================
// 요새 정의
// ============================================================

export const FORTRESS_UNITS: UnitSpec[] = [
  {
    id: 'ISERLOHN_FORTRESS',
    name: '이제르론 요새',
    nameJp: 'イゼルローン要塞',
    faction: 'NEUTRAL',
    category: 'FORTRESS',
    tier: 5,
    common: {
      maxHp: 100000,
      maxShield: 50000,
      speed: 0,
      turnRate: 0,
      sensorRange: 20000,
      crewCapacity: 50000,
    },
    armor: {
      frontArmor: 500,
      sideArmor: 500,
      rearArmor: 500,
      armorType: 'FORTRESS',
    },
    weapons: {
      mainGunCount: 1,
      mainGunDamage: 50000,
      mainGunRange: 15000,
      mainGunFireRate: 0.01,
      secondaryGunCount: 500,
      secondaryGunDamage: 100,
      missileCount: 1000,
      missileDamage: 300,
      missileRange: 10000,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 100000,
      fuelCapacity: 50000,
      ammoCapacity: 50000,
      fighterCapacity: 10000,
      troopCapacity: 20000,
    },
    repair: {
      repairCostCredits: 500000,
      repairCostMaterials: 20000,
      repairTimeBase: 720,
      buildTime: 0, // 건조 불가
      buildCost: 0,
    },
    specialAbilities: ['THOR_HAMMER', 'MASSIVE_FIGHTER_CAPACITY', 'REPAIR_DOCK'],
    description: '은하 최강의 요새. 토르의 망치 탑재.',
  },
  {
    id: 'GEIERSBURG_FORTRESS',
    name: '가이에스부르크 요새',
    nameJp: 'ガイエスブルク要塞',
    faction: 'EMPIRE',
    category: 'FORTRESS',
    tier: 5,
    common: {
      maxHp: 80000,
      maxShield: 40000,
      speed: 5, // 이동 가능 요새
      turnRate: 0.1,
      sensorRange: 18000,
      crewCapacity: 40000,
    },
    armor: {
      frontArmor: 450,
      sideArmor: 450,
      rearArmor: 450,
      armorType: 'FORTRESS',
    },
    weapons: {
      mainGunCount: 1,
      mainGunDamage: 40000,
      mainGunRange: 12000,
      mainGunFireRate: 0.015,
      secondaryGunCount: 400,
      secondaryGunDamage: 90,
      missileCount: 800,
      missileDamage: 280,
      missileRange: 9000,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 80000,
      fuelCapacity: 60000, // 이동용
      ammoCapacity: 40000,
      fighterCapacity: 8000,
      troopCapacity: 15000,
    },
    repair: {
      repairCostCredits: 400000,
      repairCostMaterials: 16000,
      repairTimeBase: 600,
      buildTime: 0,
      buildCost: 0,
    },
    specialAbilities: ['FORTRESS_CANNON', 'MOBILE_FORTRESS', 'REPAIR_DOCK'],
    description: '이동 가능한 거대 요새.',
  },
];

// ============================================================
// 전투정 정의
// ============================================================

export const FIGHTER_UNITS: UnitSpec[] = [
  {
    id: 'EMPIRE_FIGHTER_WALKÜRE',
    name: '발큐레',
    nameJp: 'ヴァルキューレ',
    faction: 'EMPIRE',
    category: 'FIGHTER',
    tier: 3,
    common: {
      maxHp: 50,
      maxShield: 10,
      speed: 300,
      turnRate: 30,
      sensorRange: 500,
      crewCapacity: 1,
    },
    armor: {
      frontArmor: 5,
      sideArmor: 3,
      rearArmor: 2,
      armorType: 'LIGHT',
    },
    weapons: {
      mainGunCount: 2,
      mainGunDamage: 15,
      mainGunRange: 300,
      mainGunFireRate: 5,
      secondaryGunCount: 0,
      secondaryGunDamage: 0,
      missileCount: 4,
      missileDamage: 40,
      missileRange: 500,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 0,
      fuelCapacity: 50,
      ammoCapacity: 100,
      fighterCapacity: 0,
      troopCapacity: 0,
    },
    repair: {
      repairCostCredits: 100,
      repairCostMaterials: 5,
      repairTimeBase: 1,
      buildTime: 10,
      buildCost: 500,
    },
    specialAbilities: ['DOGFIGHT', 'SHIELD_PENETRATION'],
    description: '제국군 주력 전투정.',
  },
  {
    id: 'ALLIANCE_FIGHTER_SPARTANIAN',
    name: '스파르타니안',
    nameJp: 'スパルタニアン',
    faction: 'ALLIANCE',
    category: 'FIGHTER',
    tier: 3,
    common: {
      maxHp: 45,
      maxShield: 15,
      speed: 320,
      turnRate: 35,
      sensorRange: 550,
      crewCapacity: 1,
    },
    armor: {
      frontArmor: 4,
      sideArmor: 3,
      rearArmor: 2,
      armorType: 'LIGHT',
    },
    weapons: {
      mainGunCount: 2,
      mainGunDamage: 14,
      mainGunRange: 280,
      mainGunFireRate: 5.5,
      secondaryGunCount: 0,
      secondaryGunDamage: 0,
      missileCount: 6,
      missileDamage: 35,
      missileRange: 550,
      torpedoCount: 0,
      torpedoDamage: 0,
    },
    cargo: {
      cargoCapacity: 0,
      fuelCapacity: 55,
      ammoCapacity: 110,
      fighterCapacity: 0,
      troopCapacity: 0,
    },
    repair: {
      repairCostCredits: 95,
      repairCostMaterials: 5,
      repairTimeBase: 1,
      buildTime: 9,
      buildCost: 480,
    },
    specialAbilities: ['DOGFIGHT', 'EVASION_BONUS'],
    description: '동맹군 주력 전투정. 기동성 특화.',
  },
];

// ============================================================
// 전체 유닛 목록
// ============================================================

export const ALL_UNIT_SPECS: UnitSpec[] = [
  ...EMPIRE_SHIPS,
  ...ALLIANCE_SHIPS,
  ...FORTRESS_UNITS,
  ...FIGHTER_UNITS,
];

// ============================================================
// 유틸리티 함수
// ============================================================

export function getUnitSpec(id: string): UnitSpec | undefined {
  return ALL_UNIT_SPECS.find(spec => spec.id === id);
}

export function getUnitsByFaction(faction: FactionType): UnitSpec[] {
  return ALL_UNIT_SPECS.filter(spec => spec.faction === faction);
}

export function getUnitsByCategory(category: ShipCategory): UnitSpec[] {
  return ALL_UNIT_SPECS.filter(spec => spec.category === category);
}

export function getUnitsByTier(tier: 1 | 2 | 3 | 4 | 5): UnitSpec[] {
  return ALL_UNIT_SPECS.filter(spec => spec.tier === tier);
}





