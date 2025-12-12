/**
 * 함선 타입 및 스펙 정의 (Ship Type & Spec Definitions)
 * 매뉴얼 2136~2166행, 7523~8600행 기반
 */

/**
 * 함선 분류 코드
 */
export enum ShipClass {
  // 전함류
  BATTLESHIP = 'BATTLESHIP',           // 전함
  FAST_BATTLESHIP = 'FAST_BATTLESHIP', // 고속전함 (제국 전용)
  
  // 순양함류
  CRUISER = 'CRUISER',                 // 순항함
  STRIKE_CRUISER = 'STRIKE_CRUISER',   // 타격순항함 (동맹 전용)
  
  // 구축함류
  DESTROYER = 'DESTROYER',             // 구축함
  
  // 모함류
  FIGHTER_CARRIER = 'FIGHTER_CARRIER', // 전투정모함
  TORPEDO_CARRIER = 'TORPEDO_CARRIER', // 뇌격정모함 (제국 전용)
  
  // 지원함류
  LANDING_SHIP = 'LANDING_SHIP',       // 양륙함
  TRANSPORT = 'TRANSPORT',             // 수송함
  TROOP_TRANSPORT = 'TROOP_TRANSPORT', // 병원수송함
  REPAIR_SHIP = 'REPAIR_SHIP',         // 공작함
}

/**
 * 함선 변형(바리에이션) 타입
 */
export type ShipVariant = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII';

/**
 * 함선 스펙 인터페이스
 */
export interface ShipSpec {
  // 기본 정보
  class: ShipClass;
  variant: ShipVariant;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  
  // 생산 정보
  buildTime: number;          // 건조 공기 (일)
  crewRequired: number;       // 필요 승조원 수 (유닛당)
  
  // 기동 정보
  power: number;              // 출력
  maxSpeed: number;           // 최대 속력 (km/G초)
  sensorRange: number;        // 색적 범위 (만km)
  
  // 장갑
  frontArmor: number;         // 전방 장갑
  sideArmor: number;          // 측면 장갑
  rearArmor: number;          // 후방 장갑
  
  // 방어막 (기함만)
  shieldProtection: number;   // 방어막 방호값
  shieldCapacity: number;     // 방어막 용량
  
  // 무장
  beamPower: number;          // 빔 화력
  beamConsumption: number;    // 빔 물자 소모
  gunPower: number;           // 포 화력
  gunConsumption: number;     // 포 물자 소모
  missilePower: number;       // 미사일 화력
  missileConsumption: number; // 미사일 물자 소모
  aaPower: number;            // 대공 화력
  
  // 적재
  cargoCapacity: number;      // 물자 적재량
  fighterCapacity: number;    // 전투정 탑재 수
  troopCapacity: number;      // 육전대 탑재 수
  
  // 수리
  repairMaterialPerShip: number; // 1척당 수리 물자 소모량
}

/**
 * 함선 스펙 테이블 (제국군)
 * 매뉴얼 7523~8600행 기반 대표 스펙
 */
export const EMPIRE_SHIP_SPECS: Partial<Record<`${ShipClass}_${ShipVariant}`, ShipSpec>> = {
  // 전함 (SS75형)
  'BATTLESHIP_I': {
    class: ShipClass.BATTLESHIP,
    variant: 'I',
    nameKo: '전함 I형',
    nameJp: '戦艦I',
    nameEn: 'Battleship Type I',
    faction: 'EMPIRE',
    buildTime: 90,
    crewRequired: 100,
    power: 390,
    maxSpeed: 5600,
    sensorRange: 34,
    frontArmor: 110,
    sideArmor: 70,
    rearArmor: 20,
    shieldProtection: 5,
    shieldCapacity: 20000,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 128,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 12,
    cargoCapacity: 21000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 120,
  },
  
  // 고속전함 (제국 전용)
  'FAST_BATTLESHIP_I': {
    class: ShipClass.FAST_BATTLESHIP,
    variant: 'I',
    nameKo: '고속전함 I형',
    nameJp: '高速戦艦I',
    nameEn: 'Fast Battleship Type I',
    faction: 'EMPIRE',
    buildTime: 100,
    crewRequired: 90,
    power: 420,
    maxSpeed: 7200,
    sensorRange: 32,
    frontArmor: 90,
    sideArmor: 55,
    rearArmor: 18,
    shieldProtection: 4,
    shieldCapacity: 18000,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 110,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 10,
    cargoCapacity: 18000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
  },
  
  // 순항함 (SK80형)
  'CRUISER_I': {
    class: ShipClass.CRUISER,
    variant: 'I',
    nameKo: '순항함 I형',
    nameJp: '巡航艦I',
    nameEn: 'Cruiser Type I',
    faction: 'EMPIRE',
    buildTime: 60,
    crewRequired: 50,
    power: 280,
    maxSpeed: 8000,
    sensorRange: 28,
    frontArmor: 65,
    sideArmor: 40,
    rearArmor: 15,
    shieldProtection: 3,
    shieldCapacity: 12000,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 90,
    gunConsumption: 1,
    missilePower: 60,
    missileConsumption: 2,
    aaPower: 8,
    cargoCapacity: 10000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 80,
  },
  
  // 구축함 (Z82형)
  'DESTROYER_I': {
    class: ShipClass.DESTROYER,
    variant: 'I',
    nameKo: '구축함 I형',
    nameJp: '駆逐艦I',
    nameEn: 'Destroyer Type I',
    faction: 'EMPIRE',
    buildTime: 30,
    crewRequired: 30,
    power: 200,
    maxSpeed: 30000,
    sensorRange: 8,
    frontArmor: 30,
    sideArmor: 19,
    rearArmor: 8,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 104,
    missileConsumption: 1,
    aaPower: 4,
    cargoCapacity: 2400,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 40,
  },
  
  // 전투정모함 (FR88형)
  'FIGHTER_CARRIER_I': {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'I',
    nameKo: '전투정모함 I형',
    nameJp: '戦闘艇母艦I',
    nameEn: 'Fighter Carrier Type I',
    faction: 'EMPIRE',
    buildTime: 180,
    crewRequired: 128,
    power: 350,
    maxSpeed: 5600,
    sensorRange: 12,
    frontArmor: 45,
    sideArmor: 23,
    rearArmor: 20,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 110,
    cargoCapacity: 2000,
    fighterCapacity: 10,
    troopCapacity: 0,
    repairMaterialPerShip: 160,
  },
  
  // 뇌격정모함 (TR88형) - 제국 전용
  'TORPEDO_CARRIER_I': {
    class: ShipClass.TORPEDO_CARRIER,
    variant: 'I',
    nameKo: '뇌격정모함 I형',
    nameJp: '雷撃艇母艦I',
    nameEn: 'Torpedo Carrier Type I',
    faction: 'EMPIRE',
    buildTime: 180,
    crewRequired: 128,
    power: 350,
    maxSpeed: 5600,
    sensorRange: 8,
    frontArmor: 45,
    sideArmor: 23,
    rearArmor: 20,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 110,
    cargoCapacity: 1600,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 160,
  },
  
  // 양륙함
  'LANDING_SHIP_I': {
    class: ShipClass.LANDING_SHIP,
    variant: 'I',
    nameKo: '양륙함 I형',
    nameJp: '揚陸艦I',
    nameEn: 'Landing Ship Type I',
    faction: 'EMPIRE',
    buildTime: 60,
    crewRequired: 40,
    power: 180,
    maxSpeed: 8000,
    sensorRange: 6,
    frontArmor: 35,
    sideArmor: 20,
    rearArmor: 12,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 20,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 30,
    cargoCapacity: 3000,
    fighterCapacity: 0,
    troopCapacity: 1000,
    repairMaterialPerShip: 60,
  },
  
  // 수송함
  'TRANSPORT_I': {
    class: ShipClass.TRANSPORT,
    variant: 'I',
    nameKo: '수송함 I형',
    nameJp: '輸送艦I',
    nameEn: 'Transport Type I',
    faction: 'EMPIRE',
    buildTime: 90,
    crewRequired: 1,
    power: 100,
    maxSpeed: 12000,
    sensorRange: 4,
    frontArmor: 48,
    sideArmor: 29,
    rearArmor: 17,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 32,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 50000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 32,
  },
  
  // 공작함
  'REPAIR_SHIP_I': {
    class: ShipClass.REPAIR_SHIP,
    variant: 'I',
    nameKo: '공작함 I형',
    nameJp: '工作艦I',
    nameEn: 'Repair Ship Type I',
    faction: 'EMPIRE',
    buildTime: 120,
    crewRequired: 1,
    power: 120,
    maxSpeed: 18000,
    sensorRange: 1,
    frontArmor: 26,
    sideArmor: 16,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 20,
    cargoCapacity: 1200,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
  },
};

/**
 * 함선 스펙 테이블 (동맹군)
 */
export const ALLIANCE_SHIP_SPECS: Partial<Record<`${ShipClass}_${ShipVariant}`, ShipSpec>> = {
  // 전함
  'BATTLESHIP_I': {
    class: ShipClass.BATTLESHIP,
    variant: 'I',
    nameKo: '전함 I형',
    nameJp: '戦艦I',
    nameEn: 'Battleship Type I',
    faction: 'ALLIANCE',
    buildTime: 90,
    crewRequired: 100,
    power: 380,
    maxSpeed: 5400,
    sensorRange: 32,
    frontArmor: 105,
    sideArmor: 68,
    rearArmor: 22,
    shieldProtection: 5,
    shieldCapacity: 19000,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 125,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 11,
    cargoCapacity: 20000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 115,
  },
  
  // 순항함
  'CRUISER_I': {
    class: ShipClass.CRUISER,
    variant: 'I',
    nameKo: '순항함 I형',
    nameJp: '巡航艦I',
    nameEn: 'Cruiser Type I',
    faction: 'ALLIANCE',
    buildTime: 60,
    crewRequired: 50,
    power: 275,
    maxSpeed: 7800,
    sensorRange: 26,
    frontArmor: 62,
    sideArmor: 38,
    rearArmor: 14,
    shieldProtection: 3,
    shieldCapacity: 11000,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 85,
    gunConsumption: 1,
    missilePower: 58,
    missileConsumption: 2,
    aaPower: 7,
    cargoCapacity: 9500,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 75,
  },
  
  // 타격순항함 (동맹 전용)
  'STRIKE_CRUISER_I': {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'I',
    nameKo: '타격순항함 I형',
    nameJp: '打撃巡航艦I',
    nameEn: 'Strike Cruiser Type I',
    faction: 'ALLIANCE',
    buildTime: 75,
    crewRequired: 60,
    power: 300,
    maxSpeed: 7200,
    sensorRange: 24,
    frontArmor: 75,
    sideArmor: 45,
    rearArmor: 18,
    shieldProtection: 3,
    shieldCapacity: 13000,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 100,
    gunConsumption: 1,
    missilePower: 75,
    missileConsumption: 2,
    aaPower: 9,
    cargoCapacity: 11000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 90,
  },
  
  // 구축함
  'DESTROYER_I': {
    class: ShipClass.DESTROYER,
    variant: 'I',
    nameKo: '구축함 I형',
    nameJp: '駆逐艦I',
    nameEn: 'Destroyer Type I',
    faction: 'ALLIANCE',
    buildTime: 30,
    crewRequired: 30,
    power: 195,
    maxSpeed: 29000,
    sensorRange: 7,
    frontArmor: 28,
    sideArmor: 18,
    rearArmor: 7,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 48,
    gunConsumption: 2,
    missilePower: 100,
    missileConsumption: 1,
    aaPower: 4,
    cargoCapacity: 2200,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 38,
  },
  
  // 전투정모함
  'FIGHTER_CARRIER_I': {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'I',
    nameKo: '전투정모함 I형',
    nameJp: '戦闘艇母艦I',
    nameEn: 'Fighter Carrier Type I',
    faction: 'ALLIANCE',
    buildTime: 180,
    crewRequired: 125,
    power: 340,
    maxSpeed: 5400,
    sensorRange: 11,
    frontArmor: 42,
    sideArmor: 22,
    rearArmor: 18,
    shieldProtection: 0,
    shieldCapacity: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 105,
    cargoCapacity: 1900,
    fighterCapacity: 10,
    troopCapacity: 0,
    repairMaterialPerShip: 155,
  },
};

/**
 * 유닛 타입 (부대 분류)
 */
export enum UnitType {
  FLEET = 'FLEET',             // 함대 (최대 18000척)
  TRANSPORT_FLEET = 'TRANSPORT_FLEET', // 수송함대 (최대 6900척)
  PATROL = 'PATROL',           // 순찰대 (최대 900척)
  GROUND_FORCE = 'GROUND_FORCE', // 지상부대 (최대 900척 + 90000명)
  SOLO = 'SOLO',               // 독행함 (1척)
}

/**
 * 부대 규모 제한
 */
export const UNIT_SIZE_LIMITS = {
  [UnitType.FLEET]: 18000,           // 함대 최대 함정 수
  [UnitType.TRANSPORT_FLEET]: 6900,  // 수송함대 최대 함정 수
  [UnitType.PATROL]: 900,            // 순찰대 최대 함정 수
  [UnitType.GROUND_FORCE]: 900,      // 지상부대 최대 함정 수
  GROUND_FORCE_TROOPS: 90000,        // 지상부대 최대 병력 수
  [UnitType.SOLO]: 1,                // 독행함 (1척)
};

/**
 * 유닛당 함정 수
 */
export const SHIPS_PER_UNIT = 300;

/**
 * 육전대 타입
 */
export enum TroopType {
  ARMORED = 'ARMORED',           // 장갑병 (일반 행성)
  GRENADIER = 'GRENADIER',       // 장갑척탄병 (모든 지형)
  LIGHT_INFANTRY = 'LIGHT_INFANTRY', // 경장육전병 (모든 지형)
}

/**
 * 육전대 스펙
 */
export const TROOP_SPECS: Record<TroopType, {
  nameKo: string;
  nameJp: string;
  nameEn: string;
  attackPower: number;
  defensePower: number;
  mobility: number;
  validTerrains: ('NORMAL' | 'GAS' | 'FORTRESS')[];
}> = {
  [TroopType.ARMORED]: {
    nameKo: '장갑병',
    nameJp: '装甲兵',
    nameEn: 'Armored Troops',
    attackPower: 100,
    defensePower: 100,
    mobility: 80,
    validTerrains: ['NORMAL'],
  },
  [TroopType.GRENADIER]: {
    nameKo: '장갑척탄병',
    nameJp: '装甲擲弾兵',
    nameEn: 'Armored Grenadiers',
    attackPower: 80,
    defensePower: 120,
    mobility: 70,
    validTerrains: ['NORMAL', 'GAS', 'FORTRESS'],
  },
  [TroopType.LIGHT_INFANTRY]: {
    nameKo: '경장육전병',
    nameJp: '軽装陸戦兵',
    nameEn: 'Light Infantry',
    attackPower: 120,
    defensePower: 60,
    mobility: 120,
    validTerrains: ['NORMAL', 'GAS', 'FORTRESS'],
  },
};

/**
 * 함선 스펙 조회 함수
 */
export function getShipSpec(
  faction: 'EMPIRE' | 'ALLIANCE',
  shipClass: ShipClass,
  variant: ShipVariant
): ShipSpec | undefined {
  const key = `${shipClass}_${variant}` as `${ShipClass}_${ShipVariant}`;
  
  if (faction === 'EMPIRE') {
    return EMPIRE_SHIP_SPECS[key];
  } else {
    return ALLIANCE_SHIP_SPECS[key];
  }
}

/**
 * 함선 전투력 계산
 */
export function calculateShipCombatPower(spec: ShipSpec): number {
  const offensivePower = spec.beamPower * 3 + spec.gunPower + spec.missilePower + spec.aaPower;
  const defensivePower = (spec.frontArmor + spec.sideArmor + spec.rearArmor) / 3;
  const mobilityFactor = spec.maxSpeed / 10000;
  
  return Math.floor((offensivePower + defensivePower) * mobilityFactor);
}







