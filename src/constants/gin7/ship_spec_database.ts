/**
 * GIN7 함선 상세 스펙 데이터베이스
 * 매뉴얼 7522~10150행 기반 - 제국군/동맹군 함선 완전 정의
 * 
 * 제국군 함선:
 * - 전함 (SS75): I~VIII
 * - 고속전함 (PK86): I~VIII (제국 전용)
 * - 순항함 (SK80): I~VIII
 * - 구축함 (Z82): I~VIII + 고속정
 * - 전투정모함 (FR88): I~IV
 * - 뇌격정모함 (TR88): I~IV (제국 전용)
 * - 공작함 (A76): I~IV
 * - 수송함 (A74): I~IV
 * - 병원수송함 (A72): I~IV
 * - 양륙함 (A78): I~IV
 * 
 * 동맹군 함선:
 * - 전함 (787년형): I~VIII
 * - 순항함 (795년형): I~VIII
 * - 타격순항함 (794년형): I~IV (동맹 전용)
 * - 구축함 (796년형): I~VIII
 * - 전투정모함 (796년형): I~IV
 * - 공작함 (793년형): I~IV
 * - 수송함 (792년형): I~IV
 * - 병원수송함 (788년형): I~IV
 * - 양륙함 (795/786년형): I~IV
 */

import { ShipClass, ShipVariant, ShipSpec } from './ship_definitions';

// ============================================================
// 확장 인터페이스 정의
// ============================================================

/**
 * 함선 타입 코드 (형식번호)
 */
export type ShipTypeCode = 
  // ========== 제국 함선 ==========
  | 'SS75'    // 제국 전함
  | 'PK86'    // 제국 고속전함 (제국 전용)
  | 'SK80'    // 제국 순항함
  | 'Z82'     // 제국 구축함
  | 'K86'     // 제국 고속정
  | 'FR88'    // 제국 전투정모함
  | 'TR88'    // 제국 뇌격정모함 (제국 전용)
  | 'A76'     // 제국 공작함
  | 'A74'     // 제국 수송함
  | 'A72'     // 제국 병원수송함
  | 'A78'     // 제국 양륙함
  // ========== 동맹 함선 (매뉴얼 기준 연도형) ==========
  | 'Y787'    // 동맹 전함 (787년형)
  | 'Y795'    // 동맹 순항함 (795년형)
  | 'Y794'    // 동맹 타격순항함 (794년형, 동맹 전용)
  | 'Y796D'   // 동맹 구축함 (796년형)
  | 'Y796C'   // 동맹 전투정모함 (796년형)
  | 'Y793'    // 동맹 공작함 (793년형)
  | 'Y792'    // 동맹 수송함 (792년형)
  | 'Y788'    // 동맹 병원수송함 (788년형)
  | 'Y786'    // 동맹 양륙함 (786/795년형)
  // ========== 공통 ==========
  | 'CIVILIAN' // 민간선
  // ========== 레거시 코드 (기존 데이터 호환용) ==========
  | 'LN60'    // 양륙함 (레거시)
  | 'TP90'    // 수송함 (레거시)
  | 'HT90'    // 병원수송함 (레거시)
  | 'ACH'     // 동맹 전함 (레거시 - 아킬레우스급)
  | 'AIA'     // 동맹 순양함 (레거시 - 아이아스급)
  | 'SCA'     // 동맹 타격순항함 (레거시)
  | 'PAT'     // 동맹 구축함 (레거시 - 파트로클로스급)
  | 'SPA';    // 스파르타니안 전투기

/**
 * 함선 상세 스펙 (확장)
 */
export interface DetailedShipSpec extends ShipSpec {
  // 추가 식별자
  typeCode: ShipTypeCode;
  modelName: string;           // 세부 모델명
  
  // 추가 스펙
  hullStrength: number;        // 선체 강도
  shieldRegenRate: number;     // 쉴드 재생률 (/초)
  emergencySpeed: number;      // 긴급 속도 (km/G초)
  
  // 생산 정보 확장
  materialCost: number;        // 건조 자재 비용
  creditCost: number;          // 건조 크레딧 비용
  techLevel: number;           // 필요 기술 레벨
  
  // 전투 정보 확장
  criticalHitChance: number;   // 치명타 확률 (%)
  evasionBonus: number;        // 회피 보너스 (%)
  
  // 특수 능력
  specialAbilities: string[];
  
  // 설명
  lore: string;
}

/**
 * 전투정/뇌격정 스펙
 */
export interface FighterSpec {
  id: string;
  typeCode: ShipTypeCode;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  
  // 성능
  hp: number;
  speed: number;
  attackPower: number;
  defensePower: number;
  fuelCapacity: number;
  
  // 무장
  primaryWeapon: string;
  secondaryWeapon: string;
  
  // 특수 능력
  abilities: string[];
  
  description: string;
}

// ============================================================
// 제국군 함선 상세 스펙 데이터베이스
// ============================================================

/**
 * 제국 전함 계열 (SS75) - 매뉴얼 7523~7690행 기반
 * SS75형 표준전함: 강력한 중성자 빔포와 레이저 수폭 미사일 발사 시스템을 주병장으로 하는 우주함대의 주력함
 */
export const EMPIRE_BATTLESHIPS: DetailedShipSpec[] = [
  // 전함 I형 - SS75형 표준전함
  {
    class: ShipClass.BATTLESHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'SS75',
    modelName: 'SS75형 표준전함',
    nameKo: '전함 I형',
    nameJp: '戦艦I型',
    nameEn: 'Battleship Type I',
    faction: 'EMPIRE',
    buildTime: 90,           // 매뉴얼: 90
    crewRequired: 100,       // 매뉴얼: 100
    power: 390,              // 매뉴얼: 390
    maxSpeed: 5600,          // 매뉴얼: 5,600 km/G초
    emergencySpeed: 7000,
    sensorRange: 34,         // 매뉴얼: 34만km
    frontArmor: 110,         // 매뉴얼: 110
    sideArmor: 70,           // 매뉴얼: 70
    rearArmor: 20,           // 매뉴얼: 20
    shieldProtection: 0,     // 일반 함선 (기함만 쉴드)
    shieldCapacity: 0,
    hullStrength: 8500,
    shieldRegenRate: 0,
    beamPower: 4,            // 매뉴얼: 4
    beamConsumption: 0,
    gunPower: 128,           // 매뉴얼: 128
    gunConsumption: 0,       // 매뉴얼: 소비물자 없음
    missilePower: 0,         // 매뉴얼: -
    missileConsumption: 0,
    aaPower: 12,             // 매뉴얼: 12
    cargoCapacity: 21000,    // 매뉴얼: 21,000
    fighterCapacity: 0,      // 매뉴얼: -
    troopCapacity: 0,
    repairMaterialPerShip: 120, // 매뉴얼: 120
    materialCost: 15000,
    creditCost: 80000,
    techLevel: 3,
    criticalHitChance: 8,
    evasionBonus: 0,
    specialAbilities: ['HEAVY_ARMOR'],
    lore: 'SS75형 표준전함. 강력한 중성자 빔포와 레이저 수폭 미사일 발사 시스템을 주병장으로 하는 함대의 주력함.',
  },
  // 전함 II형 - 중전함
  {
    class: ShipClass.BATTLESHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'SS75',
    modelName: '중전함',
    nameKo: '전함 II형',
    nameJp: '戦艦II型',
    nameEn: 'Battleship Type II',
    faction: 'EMPIRE',
    buildTime: 100,
    crewRequired: 110,
    power: 420,
    maxSpeed: 5400,
    emergencySpeed: 6800,
    sensorRange: 36,
    frontArmor: 130,
    sideArmor: 85,
    rearArmor: 25,
    shieldProtection: 6,
    shieldCapacity: 24000,
    hullStrength: 10000,
    shieldRegenRate: 55,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 145,
    gunConsumption: 4,
    missilePower: 20,
    missileConsumption: 2,
    aaPower: 15,
    cargoCapacity: 23000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 140,
    materialCost: 18000,
    creditCost: 100000,
    techLevel: 4,
    criticalHitChance: 10,
    evasionBonus: -2,
    specialAbilities: ['HEAVY_ARMOR', 'FLAGSHIP_CAPABLE', 'REINFORCED_HULL'],
    lore: '표준전함의 장갑과 화력을 강화한 중장갑 전함.',
  },
  // 전함 III형 - 초전함
  {
    class: ShipClass.BATTLESHIP,
    variant: 'III' as ShipVariant,
    typeCode: 'SS75',
    modelName: '초전함',
    nameKo: '전함 III형',
    nameJp: '戦艦III型',
    nameEn: 'Battleship Type III',
    faction: 'EMPIRE',
    buildTime: 120,
    crewRequired: 120,
    power: 480,
    maxSpeed: 5200,
    emergencySpeed: 6500,
    sensorRange: 40,
    frontArmor: 150,
    sideArmor: 100,
    rearArmor: 30,
    shieldProtection: 8,
    shieldCapacity: 30000,
    hullStrength: 12000,
    shieldRegenRate: 65,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 170,
    gunConsumption: 5,
    missilePower: 40,
    missileConsumption: 3,
    aaPower: 20,
    cargoCapacity: 28000,
    fighterCapacity: 2,
    troopCapacity: 50,
    repairMaterialPerShip: 180,
    materialCost: 25000,
    creditCost: 150000,
    techLevel: 5,
    criticalHitChance: 12,
    evasionBonus: -5,
    specialAbilities: ['HEAVY_ARMOR', 'FLAGSHIP_CAPABLE', 'REINFORCED_HULL', 'COMMAND_CENTER'],
    lore: '제국 해군 최강의 전함. 기함급 성능과 막강한 화력을 자랑한다.',
  },
  // 전함 IV형
  {
    class: ShipClass.BATTLESHIP,
    variant: 'IV' as ShipVariant,
    typeCode: 'SS75',
    modelName: '개량전함',
    nameKo: '전함 IV형',
    nameJp: '戦艦IV型',
    nameEn: 'Battleship Type IV',
    faction: 'EMPIRE',
    buildTime: 95,
    crewRequired: 105,
    power: 400,
    maxSpeed: 5800,
    emergencySpeed: 7200,
    sensorRange: 35,
    frontArmor: 115,
    sideArmor: 75,
    rearArmor: 22,
    shieldProtection: 5,
    shieldCapacity: 21000,
    hullStrength: 9000,
    shieldRegenRate: 52,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 135,
    gunConsumption: 3,
    missilePower: 10,
    missileConsumption: 1,
    aaPower: 14,
    cargoCapacity: 22000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 125,
    materialCost: 16000,
    creditCost: 85000,
    techLevel: 3,
    criticalHitChance: 9,
    evasionBonus: 0,
    specialAbilities: ['HEAVY_ARMOR', 'FLAGSHIP_CAPABLE', 'IMPROVED_FIRE_CONTROL'],
    lore: '표준전함의 기동성과 사격통제장치를 개량한 모델.',
  },
  // 전함 V형
  {
    class: ShipClass.BATTLESHIP,
    variant: 'V' as ShipVariant,
    typeCode: 'SS75',
    modelName: '신형전함',
    nameKo: '전함 V형',
    nameJp: '戦艦V型',
    nameEn: 'Battleship Type V',
    faction: 'EMPIRE',
    buildTime: 105,
    crewRequired: 108,
    power: 430,
    maxSpeed: 5500,
    emergencySpeed: 6900,
    sensorRange: 38,
    frontArmor: 125,
    sideArmor: 80,
    rearArmor: 24,
    shieldProtection: 6,
    shieldCapacity: 22500,
    hullStrength: 9500,
    shieldRegenRate: 58,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 140,
    gunConsumption: 3,
    missilePower: 25,
    missileConsumption: 2,
    aaPower: 16,
    cargoCapacity: 24000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 135,
    materialCost: 17500,
    creditCost: 95000,
    techLevel: 4,
    criticalHitChance: 10,
    evasionBonus: -1,
    specialAbilities: ['HEAVY_ARMOR', 'FLAGSHIP_CAPABLE', 'ADVANCED_SENSORS'],
    lore: '최신 기술을 적용한 신형 전함. 균형 잡힌 성능을 자랑한다.',
  },
];

/**
 * 제국 고속전함 계열 (PK86)
 */
export const EMPIRE_FAST_BATTLESHIPS: DetailedShipSpec[] = [
  // 고속전함 I형
  {
    class: ShipClass.FAST_BATTLESHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'PK86',
    modelName: '고속전함',
    nameKo: '고속전함 I형',
    nameJp: '高速戦艦I型',
    nameEn: 'Fast Battleship Type I',
    faction: 'EMPIRE',
    buildTime: 100,
    crewRequired: 90,
    power: 520,
    maxSpeed: 7200,
    emergencySpeed: 9000,
    sensorRange: 32,
    frontArmor: 90,
    sideArmor: 55,
    rearArmor: 18,
    shieldProtection: 4,
    shieldCapacity: 18000,
    hullStrength: 7000,
    shieldRegenRate: 45,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 110,
    gunConsumption: 2,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 10,
    cargoCapacity: 18000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
    materialCost: 14000,
    creditCost: 90000,
    techLevel: 4,
    criticalHitChance: 7,
    evasionBonus: 8,
    specialAbilities: ['HIGH_MOBILITY', 'FLAGSHIP_CAPABLE', 'PURSUIT_MODE'],
    lore: '전함급 화력과 순양함급 기동성을 양립한 제국 전용 고속전함.',
  },
  // 고속전함 II형 - 돌격전함
  {
    class: ShipClass.FAST_BATTLESHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'PK86',
    modelName: '돌격전함',
    nameKo: '고속전함 II형',
    nameJp: '高速戦艦II型',
    nameEn: 'Fast Battleship Type II',
    faction: 'EMPIRE',
    buildTime: 110,
    crewRequired: 95,
    power: 560,
    maxSpeed: 7500,
    emergencySpeed: 9500,
    sensorRange: 30,
    frontArmor: 95,
    sideArmor: 58,
    rearArmor: 20,
    shieldProtection: 4,
    shieldCapacity: 19000,
    hullStrength: 7500,
    shieldRegenRate: 48,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 120,
    gunConsumption: 3,
    missilePower: 15,
    missileConsumption: 1,
    aaPower: 12,
    cargoCapacity: 17000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 110,
    materialCost: 16000,
    creditCost: 105000,
    techLevel: 5,
    criticalHitChance: 9,
    evasionBonus: 10,
    specialAbilities: ['HIGH_MOBILITY', 'FLAGSHIP_CAPABLE', 'PURSUIT_MODE', 'ASSAULT_FORMATION'],
    lore: '적진 돌파에 특화된 돌격형 고속전함. 속도와 화력을 강화.',
  },
  // 고속전함 III형
  {
    class: ShipClass.FAST_BATTLESHIP,
    variant: 'III' as ShipVariant,
    typeCode: 'PK86',
    modelName: '강습전함',
    nameKo: '고속전함 III형',
    nameJp: '高速戦艦III型',
    nameEn: 'Fast Battleship Type III',
    faction: 'EMPIRE',
    buildTime: 115,
    crewRequired: 98,
    power: 580,
    maxSpeed: 7800,
    emergencySpeed: 9800,
    sensorRange: 28,
    frontArmor: 100,
    sideArmor: 60,
    rearArmor: 22,
    shieldProtection: 5,
    shieldCapacity: 20000,
    hullStrength: 7800,
    shieldRegenRate: 50,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 125,
    gunConsumption: 3,
    missilePower: 30,
    missileConsumption: 2,
    aaPower: 14,
    cargoCapacity: 16000,
    fighterCapacity: 2,
    troopCapacity: 0,
    repairMaterialPerShip: 120,
    materialCost: 18000,
    creditCost: 115000,
    techLevel: 5,
    criticalHitChance: 10,
    evasionBonus: 12,
    specialAbilities: ['HIGH_MOBILITY', 'FLAGSHIP_CAPABLE', 'PURSUIT_MODE', 'RAPID_STRIKE'],
    lore: '최신형 고속전함. 기동전의 핵심 전력.',
  },
];

/**
 * 제국 순항함 계열 (SK80)
 */
export const EMPIRE_CRUISERS: DetailedShipSpec[] = [
  // 표준순양함
  {
    class: ShipClass.CRUISER,
    variant: 'I' as ShipVariant,
    typeCode: 'SK80',
    modelName: '표준순양함',
    nameKo: '순항함 I형',
    nameJp: '巡航艦I型',
    nameEn: 'Cruiser Type I',
    faction: 'EMPIRE',
    buildTime: 60,
    crewRequired: 50,
    power: 280,
    maxSpeed: 8000,
    emergencySpeed: 10000,
    sensorRange: 28,
    frontArmor: 65,
    sideArmor: 40,
    rearArmor: 15,
    shieldProtection: 3,
    shieldCapacity: 12000,
    hullStrength: 5000,
    shieldRegenRate: 35,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 90,
    gunConsumption: 2,
    missilePower: 60,
    missileConsumption: 2,
    aaPower: 8,
    cargoCapacity: 10000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 8000,
    creditCost: 45000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 5,
    specialAbilities: ['MULTI_ROLE', 'SCOUT_CAPABLE'],
    lore: '제국 해군의 다목적 순양함. 정찰부터 전투까지 다양한 임무 수행.',
  },
  // 중순양함
  {
    class: ShipClass.CRUISER,
    variant: 'II' as ShipVariant,
    typeCode: 'SK80',
    modelName: '중순양함',
    nameKo: '순항함 II형',
    nameJp: '巡航艦II型',
    nameEn: 'Cruiser Type II',
    faction: 'EMPIRE',
    buildTime: 70,
    crewRequired: 55,
    power: 300,
    maxSpeed: 7600,
    emergencySpeed: 9500,
    sensorRange: 30,
    frontArmor: 75,
    sideArmor: 48,
    rearArmor: 18,
    shieldProtection: 3,
    shieldCapacity: 14000,
    hullStrength: 5800,
    shieldRegenRate: 38,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 100,
    gunConsumption: 2,
    missilePower: 70,
    missileConsumption: 2,
    aaPower: 10,
    cargoCapacity: 11000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 90,
    materialCost: 9500,
    creditCost: 55000,
    techLevel: 3,
    criticalHitChance: 7,
    evasionBonus: 4,
    specialAbilities: ['MULTI_ROLE', 'HEAVY_CRUISER'],
    lore: '표준순양함의 장갑과 화력을 강화한 중순양함.',
  },
  // 경순양함
  {
    class: ShipClass.CRUISER,
    variant: 'III' as ShipVariant,
    typeCode: 'SK80',
    modelName: '경순양함',
    nameKo: '순항함 III형',
    nameJp: '巡航艦III型',
    nameEn: 'Cruiser Type III',
    faction: 'EMPIRE',
    buildTime: 50,
    crewRequired: 45,
    power: 320,
    maxSpeed: 9000,
    emergencySpeed: 11500,
    sensorRange: 32,
    frontArmor: 55,
    sideArmor: 35,
    rearArmor: 12,
    shieldProtection: 2,
    shieldCapacity: 10000,
    hullStrength: 4200,
    shieldRegenRate: 40,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 75,
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 1,
    aaPower: 12,
    cargoCapacity: 8000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 65,
    materialCost: 6500,
    creditCost: 38000,
    techLevel: 2,
    criticalHitChance: 5,
    evasionBonus: 10,
    specialAbilities: ['SCOUT_CAPABLE', 'HIGH_MOBILITY', 'AA_SPECIALIST'],
    lore: '고속 정찰과 대공 방어에 특화된 경순양함.',
  },
];

/**
 * 제국 구축함 계열 (Z82)
 */
export const EMPIRE_DESTROYERS: DetailedShipSpec[] = [
  // 표준구축함
  {
    class: ShipClass.DESTROYER,
    variant: 'I' as ShipVariant,
    typeCode: 'Z82',
    modelName: '표준구축함',
    nameKo: '구축함 I형',
    nameJp: '駆逐艦I型',
    nameEn: 'Destroyer Type I',
    faction: 'EMPIRE',
    buildTime: 30,
    crewRequired: 30,
    power: 200,
    maxSpeed: 30000,
    emergencySpeed: 38000,
    sensorRange: 8,
    frontArmor: 30,
    sideArmor: 19,
    rearArmor: 8,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 104,
    missileConsumption: 2,
    aaPower: 4,
    cargoCapacity: 2400,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 40,
    materialCost: 3000,
    creditCost: 18000,
    techLevel: 1,
    criticalHitChance: 4,
    evasionBonus: 15,
    specialAbilities: ['TORPEDO_ATTACK', 'HIGH_SPEED', 'ESCORT'],
    lore: '고속 기동과 어뢰 공격에 특화된 경함선.',
  },
  // 뇌격구축함
  {
    class: ShipClass.DESTROYER,
    variant: 'II' as ShipVariant,
    typeCode: 'Z82',
    modelName: '뇌격구축함',
    nameKo: '구축함 II형',
    nameJp: '駆逐艦II型',
    nameEn: 'Destroyer Type II',
    faction: 'EMPIRE',
    buildTime: 35,
    crewRequired: 32,
    power: 210,
    maxSpeed: 28000,
    emergencySpeed: 35000,
    sensorRange: 10,
    frontArmor: 32,
    sideArmor: 20,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2700,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 45,
    gunConsumption: 2,
    missilePower: 140,
    missileConsumption: 3,
    aaPower: 3,
    cargoCapacity: 2600,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 45,
    materialCost: 3500,
    creditCost: 22000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 12,
    specialAbilities: ['TORPEDO_ATTACK', 'HIGH_SPEED', 'TORPEDO_SALVO'],
    lore: '어뢰 적재량을 대폭 증가시킨 뇌격 특화형.',
  },
  // 대공구축함
  {
    class: ShipClass.DESTROYER,
    variant: 'III' as ShipVariant,
    typeCode: 'Z82',
    modelName: '대공구축함',
    nameKo: '구축함 III형',
    nameJp: '駆逐艦III型',
    nameEn: 'Destroyer Type III',
    faction: 'EMPIRE',
    buildTime: 35,
    crewRequired: 35,
    power: 220,
    maxSpeed: 26000,
    emergencySpeed: 33000,
    sensorRange: 14,
    frontArmor: 35,
    sideArmor: 22,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 40,
    gunConsumption: 1,
    missilePower: 80,
    missileConsumption: 2,
    aaPower: 25,
    cargoCapacity: 2500,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 48,
    materialCost: 3800,
    creditCost: 24000,
    techLevel: 2,
    criticalHitChance: 4,
    evasionBonus: 10,
    specialAbilities: ['HIGH_SPEED', 'ESCORT', 'AA_SPECIALIST', 'FLAK_BARRIER'],
    lore: '대공 화력을 강화하여 함재기 요격에 특화된 방공형.',
  },
];

/**
 * 제국 전투정모함 (FR88)
 */
export const EMPIRE_FIGHTER_CARRIERS: DetailedShipSpec[] = [
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'I' as ShipVariant,
    typeCode: 'FR88',
    modelName: '전투정모함',
    nameKo: '전투정모함 I형',
    nameJp: '戦闘艇母艦I型',
    nameEn: 'Fighter Carrier Type I',
    faction: 'EMPIRE',
    buildTime: 180,
    crewRequired: 128,
    power: 350,
    maxSpeed: 5600,
    emergencySpeed: 7000,
    sensorRange: 12,
    frontArmor: 45,
    sideArmor: 23,
    rearArmor: 20,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6500,
    shieldRegenRate: 0,
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
    materialCost: 20000,
    creditCost: 120000,
    techLevel: 4,
    criticalHitChance: 3,
    evasionBonus: 0,
    specialAbilities: ['FIGHTER_LAUNCH', 'HANGAR_DECK', 'COMMAND_OPERATIONS'],
    lore: '발큐레 전투정을 탑재하여 제공권 확보 임무를 수행하는 모함.',
  },
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'II' as ShipVariant,
    typeCode: 'FR88',
    modelName: '강습모함',
    nameKo: '전투정모함 II형',
    nameJp: '戦闘艇母艦II型',
    nameEn: 'Fighter Carrier Type II',
    faction: 'EMPIRE',
    buildTime: 200,
    crewRequired: 140,
    power: 380,
    maxSpeed: 5400,
    emergencySpeed: 6800,
    sensorRange: 14,
    frontArmor: 50,
    sideArmor: 28,
    rearArmor: 22,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 7200,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 20,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 130,
    cargoCapacity: 2400,
    fighterCapacity: 12,
    troopCapacity: 0,
    repairMaterialPerShip: 180,
    materialCost: 24000,
    creditCost: 140000,
    techLevel: 5,
    criticalHitChance: 3,
    evasionBonus: -2,
    specialAbilities: ['FIGHTER_LAUNCH', 'HANGAR_DECK', 'COMMAND_OPERATIONS', 'RAPID_DEPLOYMENT'],
    lore: '탑재량을 증가시킨 강습형 전투정모함.',
  },
];

/**
 * 제국 뇌격정모함 (TR88) - 제국 전용
 */
export const EMPIRE_TORPEDO_CARRIERS: DetailedShipSpec[] = [
  {
    class: ShipClass.TORPEDO_CARRIER,
    variant: 'I' as ShipVariant,
    typeCode: 'TR88',
    modelName: '뇌격정모함',
    nameKo: '뇌격정모함 I형',
    nameJp: '雷撃艇母艦I型',
    nameEn: 'Torpedo Carrier Type I',
    faction: 'EMPIRE',
    buildTime: 180,
    crewRequired: 128,
    power: 350,
    maxSpeed: 5600,
    emergencySpeed: 7000,
    sensorRange: 8,
    frontArmor: 45,
    sideArmor: 23,
    rearArmor: 20,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6500,
    shieldRegenRate: 0,
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
    materialCost: 22000,
    creditCost: 125000,
    techLevel: 4,
    criticalHitChance: 3,
    evasionBonus: 0,
    specialAbilities: ['TORPEDO_BOAT_LAUNCH', 'HANGAR_DECK', 'ANTI_SHIP_STRIKE'],
    lore: '뇌격정을 탑재하여 대함 공격에 특화된 제국 전용 모함.',
  },
  {
    class: ShipClass.TORPEDO_CARRIER,
    variant: 'II' as ShipVariant,
    typeCode: 'TR88',
    modelName: '강습뇌격모함',
    nameKo: '뇌격정모함 II형',
    nameJp: '雷撃艇母艦II型',
    nameEn: 'Torpedo Carrier Type II',
    faction: 'EMPIRE',
    buildTime: 200,
    crewRequired: 135,
    power: 370,
    maxSpeed: 5400,
    emergencySpeed: 6800,
    sensorRange: 10,
    frontArmor: 48,
    sideArmor: 26,
    rearArmor: 22,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 15,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 120,
    cargoCapacity: 2000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 175,
    materialCost: 25000,
    creditCost: 145000,
    techLevel: 5,
    criticalHitChance: 4,
    evasionBonus: -1,
    specialAbilities: ['TORPEDO_BOAT_LAUNCH', 'HANGAR_DECK', 'ANTI_SHIP_STRIKE', 'COORDINATED_ATTACK'],
    lore: '대함 공격 능력을 강화한 강습형 뇌격정모함.',
  },
];

/**
 * 제국 공작함 (A76)
 */
export const EMPIRE_REPAIR_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'A76',
    modelName: '공작함',
    nameKo: '공작함 I형',
    nameJp: '工作艦I型',
    nameEn: 'Repair Ship Type I',
    faction: 'EMPIRE',
    buildTime: 120,
    crewRequired: 80,
    power: 120,
    maxSpeed: 18000,
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 26,
    sideArmor: 16,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4000,
    shieldRegenRate: 0,
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
    materialCost: 12000,
    creditCost: 70000,
    techLevel: 3,
    criticalHitChance: 0,
    evasionBonus: 5,
    specialAbilities: ['FIELD_REPAIR', 'DAMAGE_CONTROL', 'SALVAGE'],
    lore: '함대 수리와 손상 복구를 담당하는 지원함.',
  },
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'A76',
    modelName: '대형공작함',
    nameKo: '공작함 II형',
    nameJp: '工作艦II型',
    nameEn: 'Repair Ship Type II',
    faction: 'EMPIRE',
    buildTime: 150,
    crewRequired: 100,
    power: 140,
    maxSpeed: 16000,
    emergencySpeed: 20000,
    sensorRange: 2,
    frontArmor: 30,
    sideArmor: 20,
    rearArmor: 12,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 10,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 25,
    cargoCapacity: 1800,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 130,
    materialCost: 16000,
    creditCost: 95000,
    techLevel: 4,
    criticalHitChance: 0,
    evasionBonus: 3,
    specialAbilities: ['FIELD_REPAIR', 'DAMAGE_CONTROL', 'SALVAGE', 'MOBILE_DOCK'],
    lore: '대형 함선도 수리 가능한 대형 공작함.',
  },
];

/**
 * 제국 양륙함 (LN60)
 */
export const EMPIRE_LANDING_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'LN60',
    modelName: '양륙함',
    nameKo: '양륙함 I형',
    nameJp: '揚陸艦I型',
    nameEn: 'Landing Ship Type I',
    faction: 'EMPIRE',
    buildTime: 60,
    crewRequired: 40,
    power: 180,
    maxSpeed: 8000,
    emergencySpeed: 10000,
    sensorRange: 6,
    frontArmor: 35,
    sideArmor: 20,
    rearArmor: 12,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4500,
    shieldRegenRate: 0,
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
    materialCost: 8000,
    creditCost: 50000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: 3,
    specialAbilities: ['TROOP_DEPLOY', 'ORBITAL_DROP', 'GROUND_SUPPORT'],
    lore: '육전대 강하 작전을 위한 상륙 전용 함선.',
  },
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'LN60',
    modelName: '강습양륙함',
    nameKo: '양륙함 II형',
    nameJp: '揚陸艦II型',
    nameEn: 'Landing Ship Type II',
    faction: 'EMPIRE',
    buildTime: 80,
    crewRequired: 50,
    power: 200,
    maxSpeed: 7500,
    emergencySpeed: 9500,
    sensorRange: 8,
    frontArmor: 40,
    sideArmor: 25,
    rearArmor: 15,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5200,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 30,
    gunConsumption: 1,
    missilePower: 20,
    missileConsumption: 1,
    aaPower: 40,
    cargoCapacity: 4000,
    fighterCapacity: 2,
    troopCapacity: 1500,
    repairMaterialPerShip: 75,
    materialCost: 10000,
    creditCost: 65000,
    techLevel: 3,
    criticalHitChance: 3,
    evasionBonus: 2,
    specialAbilities: ['TROOP_DEPLOY', 'ORBITAL_DROP', 'GROUND_SUPPORT', 'ASSAULT_PODS'],
    lore: '화력 지원 능력과 병력 수송량을 강화한 강습형.',
  },
];

/**
 * 제국 수송함 (TP90)
 */
export const EMPIRE_TRANSPORTS: DetailedShipSpec[] = [
  {
    class: ShipClass.TRANSPORT,
    variant: 'I' as ShipVariant,
    typeCode: 'TP90',
    modelName: '수송함',
    nameKo: '수송함 I형',
    nameJp: '輸送艦I型',
    nameEn: 'Transport Type I',
    faction: 'EMPIRE',
    buildTime: 90,
    crewRequired: 20,
    power: 100,
    maxSpeed: 12000,
    emergencySpeed: 15000,
    sensorRange: 4,
    frontArmor: 48,
    sideArmor: 29,
    rearArmor: 17,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 32,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 50000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 32,
    materialCost: 6000,
    creditCost: 35000,
    techLevel: 1,
    criticalHitChance: 2,
    evasionBonus: 5,
    specialAbilities: ['CARGO_TRANSFER', 'SUPPLY_RUN'],
    lore: '물자 대량 수송에 특화된 비전투 함선.',
  },
  {
    class: ShipClass.TRANSPORT,
    variant: 'II' as ShipVariant,
    typeCode: 'TP90',
    modelName: '대형수송함',
    nameKo: '수송함 II형',
    nameJp: '輸送艦II型',
    nameEn: 'Transport Type II',
    faction: 'EMPIRE',
    buildTime: 120,
    crewRequired: 25,
    power: 120,
    maxSpeed: 10000,
    emergencySpeed: 12500,
    sensorRange: 5,
    frontArmor: 55,
    sideArmor: 35,
    rearArmor: 20,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 40,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 50,
    cargoCapacity: 80000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 40,
    materialCost: 9000,
    creditCost: 50000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: 3,
    specialAbilities: ['CARGO_TRANSFER', 'SUPPLY_RUN', 'BULK_TRANSPORT'],
    lore: '적재량을 극대화한 대형 수송함.',
  },
];

/**
 * 제국 병원수송함 (HT90)
 */
export const EMPIRE_HOSPITAL_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.TROOP_TRANSPORT,
    variant: 'I' as ShipVariant,
    typeCode: 'HT90',
    modelName: '병원수송함',
    nameKo: '병원수송함 I형',
    nameJp: '病院輸送艦I型',
    nameEn: 'Hospital Ship Type I',
    faction: 'EMPIRE',
    buildTime: 100,
    crewRequired: 60,
    power: 110,
    maxSpeed: 14000,
    emergencySpeed: 18000,
    sensorRange: 6,
    frontArmor: 40,
    sideArmor: 25,
    rearArmor: 15,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 15,
    gunConsumption: 1,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 35,
    cargoCapacity: 5000,
    fighterCapacity: 0,
    troopCapacity: 500,
    repairMaterialPerShip: 50,
    materialCost: 10000,
    creditCost: 60000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: 8,
    specialAbilities: ['MEDICAL_BAY', 'CREW_RECOVERY', 'EVACUATION'],
    lore: '부상병 치료와 후송을 담당하는 의료 지원함.',
  },
];

// ============================================================
// 동맹군 함선 상세 스펙 데이터베이스 (매뉴얼 8898~10150행 기반)
// ============================================================

/**
 * 동맹 전함 (787년형) - 매뉴얼 8898~9071행
 * 강력한 광자포와 레이저 수폭 미사일 발사 시스템 및 전투정을 주병장으로 하는 함대 주력함
 * 제국군 SS75형 표준전함에 대항하기 위해 건조됨
 * 반격납식 전투정 격납고가 방어상 약점이지만, 주포 공격력/항행성능/전자전 능력에서 SS75형을 압도
 */
export const ALLIANCE_BATTLESHIPS: DetailedShipSpec[] = [
  // 전함I - 787년형 표준전함
  {
    class: ShipClass.BATTLESHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년형 표준전함',
    nameKo: '전함 I형',
    nameJp: '戦艦I型',
    nameEn: 'Battleship Type I (787)',
    faction: 'ALLIANCE',
    buildTime: 80,           // 매뉴얼 추정
    crewRequired: 100,       // 매뉴얼: 유닛수 1
    power: 400,              // 매뉴얼: 400
    maxSpeed: 22000,         // 매뉴얼: 22,000
    emergencySpeed: 27000,
    sensorRange: 4,          // 매뉴얼: 4만km
    frontArmor: 30,          // 매뉴얼: 30
    sideArmor: 18,           // 매뉴얼: 18
    rearArmor: 10,           // 매뉴얼: 10
    shieldProtection: 0,     // 일반 함선 (기함만 쉴드)
    shieldCapacity: 0,
    hullStrength: 8200,
    shieldRegenRate: 0,
    beamPower: 5,            // 매뉴얼 기함 기준 (일반함은 약간 낮음 추정)
    beamConsumption: 0,
    gunPower: 80,            // 매뉴얼: 80/1
    gunConsumption: 1,
    missilePower: 90,        // 매뉴얼: 90/5
    missileConsumption: 5,
    aaPower: 3,              // 매뉴얼: 3
    cargoCapacity: 760,      // 매뉴얼: 760
    fighterCapacity: 3,      // 매뉴얼: 전투정 3척
    troopCapacity: 0,
    repairMaterialPerShip: 190, // 매뉴얼: 190
    materialCost: 14500,
    creditCost: 78000,
    techLevel: 3,
    criticalHitChance: 8,
    evasionBonus: 2,         // 동맹 함선 특성: 기동성 우수
    specialAbilities: ['FIGHTER_CARRIER', 'MISSILE_BARRAGE'],
    lore: '787년형 표준전함. 반격납식 전투정 격납고가 방어상 약점이지만 주포 공격력과 기동성이 우수하다.',
  },
  // 전함II - 787년 G형 (근거리 포격전 강화)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 G형 전함',
    nameKo: '전함 II형',
    nameJp: '戦艦II型',
    nameEn: 'Battleship Type II (787-G)',
    faction: 'ALLIANCE',
    buildTime: 85,
    crewRequired: 100,
    power: 400,
    maxSpeed: 20000,         // 매뉴얼: 20,000
    emergencySpeed: 25000,
    sensorRange: 4,
    frontArmor: 32,          // 매뉴얼: 32 (장갑 증강)
    sideArmor: 22,           // 매뉴얼: 22
    rearArmor: 14,           // 매뉴얼: 14
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 8800,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 140,           // 매뉴얼: 140/2 (신형 레일캐논)
    gunConsumption: 2,
    missilePower: 90,        // 매뉴얼: -
    missileConsumption: 5,
    aaPower: 3,
    cargoCapacity: 800,      // 매뉴얼: 800
    fighterCapacity: 3,
    troopCapacity: 0,
    repairMaterialPerShip: 190,
    materialCost: 16000,
    creditCost: 85000,
    techLevel: 3,
    criticalHitChance: 10,   // 근접전 특화
    evasionBonus: 0,
    specialAbilities: ['FIGHTER_CARRIER', 'CLOSE_COMBAT', 'HEAVY_GUNS'],
    lore: '787년 G형 전함. 레일캐논을 신형으로 환장하여 근거리 포격전 공격력을 높임. 일부 장갑도 증강.',
  },
  // 전함III - 787년 M형 (장거리 미사일 강화)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'III' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 M형 전함',
    nameKo: '전함 III형',
    nameJp: '戦艦III型',
    nameEn: 'Battleship Type III (787-M)',
    faction: 'ALLIANCE',
    buildTime: 90,
    crewRequired: 100,
    power: 400,
    maxSpeed: 22000,
    emergencySpeed: 27000,
    sensorRange: 4,
    frontArmor: 28,          // 매뉴얼: 28
    sideArmor: 16,           // 매뉴얼: 16
    rearArmor: 8,            // 매뉴얼: 8
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 7800,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 80,
    gunConsumption: 1,
    missilePower: 100,       // 매뉴얼: 100/6 (신형 레이저수폭)
    missileConsumption: 6,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 0,      // 매뉴얼: 전투정 격납고 전폐
    troopCapacity: 0,
    repairMaterialPerShip: 190,
    materialCost: 17000,
    creditCost: 90000,
    techLevel: 4,
    criticalHitChance: 8,
    evasionBonus: 2,
    specialAbilities: ['LONG_RANGE_MISSILE', 'MISSILE_BARRAGE'],
    lore: '787년 M형 전함. 장거리 전투능력 강화를 위해 신형 레이저수폭 발사시스템 탑재. 전투정 격납고를 탄약 탑재공간으로 전환.',
  },
  // 전함IV - 787년 L형 (쾌속전함)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 L형 전함',
    nameKo: '전함 IV형 (쾌속전함)',
    nameJp: '戦艦IV型',
    nameEn: 'Battleship Type IV (787-L)',
    faction: 'ALLIANCE',
    buildTime: 75,
    crewRequired: 95,
    power: 420,
    maxSpeed: 23000,         // 매뉴얼: 23,000 (고속)
    emergencySpeed: 29000,
    sensorRange: 4,
    frontArmor: 18,          // 매뉴얼: 18 (장갑 경량화)
    sideArmor: 10,           // 매뉴얼: 10
    rearArmor: 10,           // 추정
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6500,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 80,
    gunConsumption: 1,
    missilePower: 90,
    missileConsumption: 5,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 3,
    troopCapacity: 0,
    repairMaterialPerShip: 170,
    materialCost: 13000,
    creditCost: 75000,
    techLevel: 3,
    criticalHitChance: 7,
    evasionBonus: 5,         // 고기동
    specialAbilities: ['FIGHTER_CARRIER', 'HIGH_SPEED', 'PURSUIT'],
    lore: '787년 L형 전함 (쾌속전함). 장갑을 일부 생략/경량화하여 기동성 향상. 후퇴하는 적 추격 목적으로 설계.',
  },
  // 전함V - 787년 H형 (장갑 강화)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'V' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 H형 전함',
    nameKo: '전함 V형',
    nameJp: '戦艦V型',
    nameEn: 'Battleship Type V (787-H)',
    faction: 'ALLIANCE',
    buildTime: 100,
    crewRequired: 105,
    power: 400,
    maxSpeed: 18000,         // 매뉴얼: 18,000 (중량 증가로 속도 저하)
    emergencySpeed: 22000,
    sensorRange: 4,
    frontArmor: 34,          // 매뉴얼: 34 (장갑 대폭 강화)
    sideArmor: 22,           // 추정
    rearArmor: 14,           // 추정
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 10500,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 80,
    gunConsumption: 1,
    missilePower: 90,
    missileConsumption: 5,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 0,      // 매뉴얼: 반격납식 폐지, 함내식으로 변경 -> 실질 전투정 운용 어려움
    troopCapacity: 0,
    repairMaterialPerShip: 220,
    materialCost: 19000,
    creditCost: 100000,
    techLevel: 4,
    criticalHitChance: 8,
    evasionBonus: -2,        // 중량 증가로 기동성 저하
    specialAbilities: ['HEAVY_ARMOR', 'REINFORCED_HULL'],
    lore: '787년 H형 전함. 장갑을 철저히 강화하고 반격납식 전투정 격납고를 함내식으로 변경. 중량 증가로 기동성 약간 저하.',
  },
  // 전함VI - 787년 R형 (정찰용)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'VI' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 R형 전함',
    nameKo: '전함 VI형 (정찰전함)',
    nameJp: '戦艦VI型',
    nameEn: 'Battleship Type VI (787-R)',
    faction: 'ALLIANCE',
    buildTime: 95,
    crewRequired: 100,
    power: 400,
    maxSpeed: 22000,
    emergencySpeed: 28000,
    sensorRange: 8,          // 매뉴얼: 텐게리급 분함대기함과 동등한 센서 시스템 (대폭 강화)
    frontArmor: 30,
    sideArmor: 18,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 8200,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 80,
    gunConsumption: 1,
    missilePower: 90,
    missileConsumption: 5,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 3,
    troopCapacity: 0,
    repairMaterialPerShip: 195,
    materialCost: 18000,
    creditCost: 95000,
    techLevel: 4,
    criticalHitChance: 8,
    evasionBonus: 3,         // 자세제어 스러스터 강화로 선회성능 향상
    specialAbilities: ['FIGHTER_CARRIER', 'ADVANCED_SENSORS', 'SCOUT_CAPABLE'],
    lore: '787년 R형 전함 (정찰전함). 정찰부대 배속용으로 텐게리급 분함대기함과 동등한 센서시스템 탑재. 자세제어 스러스터도 강화.',
  },
  // 전함VII - 787년 E형 (전시급조형)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'VII' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 E형 전함',
    nameKo: '전함 VII형 (전시급조형)',
    nameJp: '戦艦VII型',
    nameEn: 'Battleship Type VII (787-E)',
    faction: 'ALLIANCE',
    buildTime: 60,           // 전시급조형으로 공기 단축
    crewRequired: 100,
    power: 350,              // 저출력 기관
    maxSpeed: 18000,         // 매뉴얼: 항행속도 저하
    emergencySpeed: 22000,
    sensorRange: 2,          // 매뉴얼: 표준순항함 센서 사용 (저렴)
    frontArmor: 30,
    sideArmor: 18,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 8000,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 80,
    gunConsumption: 1,
    missilePower: 64,        // 매뉴얼: 64 (약화)
    missileConsumption: 5,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 1,      // 매뉴얼: 전투정 1척
    troopCapacity: 0,
    repairMaterialPerShip: 180,
    materialCost: 10000,
    creditCost: 55000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 0,
    specialAbilities: ['MASS_PRODUCTION', 'CHEAP'],
    lore: '787년 E형 전함 (전시급조형). 저출력 기관으로 항행속도 저하. 센서는 저렴한 표준순항함용 사용.',
  },
  // 전함VIII - 787년 U형 (무인함)
  {
    class: ShipClass.BATTLESHIP,
    variant: 'VIII' as ShipVariant,
    typeCode: 'Y787',
    modelName: '787년 U형 전함',
    nameKo: '전함 VIII형 (무인함)',
    nameJp: '戦艦VIII型',
    nameEn: 'Battleship Type VIII (787-U)',
    faction: 'ALLIANCE',
    buildTime: 70,
    crewRequired: 25,        // 매뉴얼: 25% 승조원만 필요
    power: 400,
    maxSpeed: 22000,
    emergencySpeed: 27000,
    sensorRange: 4,
    frontArmor: 30,
    sideArmor: 18,
    rearArmor: 10,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 8200,
    shieldRegenRate: 0,
    beamPower: 5,
    beamConsumption: 0,
    gunPower: 100,           // 매뉴얼: 100
    gunConsumption: 1,
    missilePower: 80,        // 매뉴얼: 80/1
    missileConsumption: 1,
    aaPower: 3,
    cargoCapacity: 760,
    fighterCapacity: 0,      // 매뉴얼: 전투정 미탑재
    troopCapacity: 0,
    repairMaterialPerShip: 190,
    materialCost: 16000,
    creditCost: 88000,
    techLevel: 5,
    criticalHitChance: 7,
    evasionBonus: 3,         // 매뉴얼: 선회성능 약간 향상
    specialAbilities: ['AUTOMATED', 'LOW_CREW', 'EXPENDABLE'],
    lore: '787년 U형 전함 (무인함). 자동화된 함선으로 25%의 승조원만 필요. 인적자원 고갈 대응 및 돌입폐색작전 등 특수용도에 사용.',
  },
];

/**
 * 동맹 순항함 (795년형) - 매뉴얼 9072~9248행
 * 중성자 미사일과 광자 펄스포 및 전투정을 주병장으로 하는 중형함
 * 전함보다 단거리 교전을 상정하여 설계됨
 * 제국군 SK80형 표준순항함에 비해 소형이지만, 미사일 공격력을 제외하면 거의 동등한 전력
 */
export const ALLIANCE_CRUISERS: DetailedShipSpec[] = [
  // 순항함I - 795년형 표준순항함
  {
    class: ShipClass.CRUISER,
    variant: 'I' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년형 표준순항함',
    nameKo: '순항함 I형',
    nameJp: '巡航艦I型',
    nameEn: 'Cruiser Type I (795)',
    faction: 'ALLIANCE',
    buildTime: 60,
    crewRequired: 50,        // 매뉴얼: 유닛수 2
    power: 250,              // 매뉴얼: 250
    maxSpeed: 24000,         // 매뉴얼: 24,000
    emergencySpeed: 30000,
    sensorRange: 2,          // 매뉴얼: 2만km
    frontArmor: 18,          // 매뉴얼: 18
    sideArmor: 10,           // 매뉴얼: 10
    rearArmor: 6,            // 매뉴얼: 6
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 2,            // 매뉴얼 기함: 22 (일반함 추정)
    beamConsumption: 0,
    gunPower: 50,            // 매뉴얼: 50/3
    gunConsumption: 3,
    missilePower: 50,        // 매뉴얼: 50/3
    missileConsumption: 3,
    aaPower: 24,             // 매뉴얼: 24
    cargoCapacity: 360,      // 매뉴얼: 360
    fighterCapacity: 1,      // 매뉴얼: 전투정 1척
    troopCapacity: 0,
    repairMaterialPerShip: 80, // 매뉴얼: 80
    materialCost: 7500,
    creditCost: 43000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 4,
    specialAbilities: ['FIGHTER_CARRIER', 'ANTI_AIR'],
    lore: '795년형 표준순항함. 전함보다 단거리 교전용으로 설계. 반격납식 전투정 격납고는 방어상 약점.',
  },
  // 순항함II - 795년 B형 (포격 강화)
  {
    class: ShipClass.CRUISER,
    variant: 'II' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 B형 순항함',
    nameKo: '순항함 II형',
    nameJp: '巡航艦II型',
    nameEn: 'Cruiser Type II (795-B)',
    faction: 'ALLIANCE',
    buildTime: 65,
    crewRequired: 50,
    power: 250,
    maxSpeed: 22000,         // 매뉴얼: 22,000
    emergencySpeed: 28000,
    sensorRange: 2,
    frontArmor: 22,          // 매뉴얼: 22 (방어 강화)
    sideArmor: 13,           // 매뉴얼: 13
    rearArmor: 8,            // 매뉴얼: 8
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5200,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 60,            // 매뉴얼: 60 (신형포)
    gunConsumption: 3,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 320,      // 매뉴얼: 320
    fighterCapacity: 0,      // 매뉴얼: 전투정 미탑재
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 8000,
    creditCost: 46000,
    techLevel: 3,
    criticalHitChance: 7,
    evasionBonus: 3,
    specialAbilities: ['REINFORCED_HULL', 'IMPROVED_GUNS'],
    lore: '795년 B형 순항함. 함수 중성자 펄스포를 신형으로 환장. 전투정 미탑재로 함체 개구부 감소, 방어 강화.',
  },
  // 순항함III - 795년 M형 (장거리 미사일)
  {
    class: ShipClass.CRUISER,
    variant: 'III' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 M형 순항함',
    nameKo: '순항함 III형',
    nameJp: '巡航艦III型',
    nameEn: 'Cruiser Type III (795-M)',
    faction: 'ALLIANCE',
    buildTime: 70,
    crewRequired: 50,
    power: 250,
    maxSpeed: 23000,         // 매뉴얼: 23,000
    emergencySpeed: 29000,
    sensorRange: 2,
    frontArmor: 16,          // 매뉴얼: 16
    sideArmor: 8,            // 매뉴얼: 8
    rearArmor: 5,            // 매뉴얼: 5
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4500,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 3,
    missilePower: 90,        // 매뉴얼: 90/4 (레이저수폭)
    missileConsumption: 4,
    aaPower: 24,
    cargoCapacity: 360,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 9000,
    creditCost: 50000,
    techLevel: 4,
    criticalHitChance: 6,
    evasionBonus: 4,
    specialAbilities: ['FIGHTER_CARRIER', 'LONG_RANGE_MISSILE'],
    lore: '795년 M형 순항함. 중성자 미사일을 장사정 고위력 레이저수폭 미사일로 환장. 전함 보조부대로 장사정 미사일전 수행.',
  },
  // 순항함IV - 795년 L형 (고속순항함)
  {
    class: ShipClass.CRUISER,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 L형 순항함',
    nameKo: '순항함 IV형 (고속순항함)',
    nameJp: '巡航艦IV型',
    nameEn: 'Cruiser Type IV (795-L)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 48,
    power: 280,              // 고출력 기관
    maxSpeed: 28000,         // 매뉴얼: 28,000 (고속)
    emergencySpeed: 35000,
    sensorRange: 2,
    frontArmor: 12,          // 매뉴얼: 12 (장갑 제거)
    sideArmor: 8,            // 매뉴얼: 8
    rearArmor: 4,            // 매뉴얼: 4
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 3800,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 40,            // 매뉴얼: 40/2
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 320,      // 매뉴얼: 320
    fighterCapacity: 0,      // 전투정 미탑재
    troopCapacity: 0,
    repairMaterialPerShip: 70,
    materialCost: 7000,
    creditCost: 40000,
    techLevel: 3,
    criticalHitChance: 5,
    evasionBonus: 8,         // 고기동
    specialAbilities: ['HIGH_SPEED', 'LIGHT_ARMOR'],
    lore: '795년 L형 순항함 (고속순항함). 장갑 일부 제거로 함체 경량화, 고출력 기관 탑재로 고속 항행 가능.',
  },
  // 순항함V - 795년 H형 (장갑 강화)
  {
    class: ShipClass.CRUISER,
    variant: 'V' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 H형 순항함',
    nameKo: '순항함 V형',
    nameJp: '巡航艦V型',
    nameEn: 'Cruiser Type V (795-H)',
    faction: 'ALLIANCE',
    buildTime: 75,
    crewRequired: 52,
    power: 250,
    maxSpeed: 20000,         // 매뉴얼: 20,000 (속도 저하)
    emergencySpeed: 25000,
    sensorRange: 2,
    frontArmor: 24,          // 매뉴얼: 24 (장갑 대폭 증설)
    sideArmor: 18,           // 추정
    rearArmor: 9,            // 추정
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6000,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 3,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 360,
    fighterCapacity: 0,      // 전투정 미탑재 (개구부 감소)
    troopCapacity: 0,
    repairMaterialPerShip: 90,
    materialCost: 9500,
    creditCost: 52000,
    techLevel: 3,
    criticalHitChance: 6,
    evasionBonus: 0,         // 속도/선회 저하
    specialAbilities: ['HEAVY_ARMOR', 'REINFORCED_HULL'],
    lore: '795년 H형 순항함. 복합장갑 증설로 방어 강화. 개구부 감소를 위해 전투정 미탑재. 속도/선회 저하되었으나 견고함으로 전선 신뢰.',
  },
  // 순항함VI - 795년 R형 (정찰순항함)
  {
    class: ShipClass.CRUISER,
    variant: 'VI' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 R형 순항함',
    nameKo: '순항함 VI형 (정찰순항함)',
    nameJp: '巡航艦VI型',
    nameEn: 'Cruiser Type VI (795-R)',
    faction: 'ALLIANCE',
    buildTime: 65,
    crewRequired: 50,
    power: 250,
    maxSpeed: 25000,         // 매뉴얼: 25,000
    emergencySpeed: 31000,
    sensorRange: 4,          // 매뉴얼: 787년형 전함 색적시스템 탑재
    frontArmor: 18,
    sideArmor: 10,
    rearArmor: 6,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 3,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 360,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 9000,
    creditCost: 50000,
    techLevel: 4,
    criticalHitChance: 6,
    evasionBonus: 5,
    specialAbilities: ['FIGHTER_CARRIER', 'ADVANCED_SENSORS', 'SCOUT_CAPABLE'],
    lore: '795년 R형 순항함 (정찰순항함). 787년형 전함의 색적시스템 탑재. 고도의 색적능력 보유. 함대 전위부대의 중핵.',
  },
  // 순항함VII - 795년 Ri형 (고성능 정찰)
  {
    class: ShipClass.CRUISER,
    variant: 'VII' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 Ri형 순항함',
    nameKo: '순항함 VII형',
    nameJp: '巡航艦VII型',
    nameEn: 'Cruiser Type VII (795-Ri)',
    faction: 'ALLIANCE',
    buildTime: 85,
    crewRequired: 50,
    power: 250,
    maxSpeed: 24000,
    emergencySpeed: 30000,
    sensorRange: 8,          // 매뉴얼: 텐게리급 분함대기함 색적시스템
    frontArmor: 18,
    sideArmor: 10,
    rearArmor: 6,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 3,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 400,      // 매뉴얼: 400
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 18000,     // 매뉴얼: 787년형 전함과 동등한 건조비 (고가)
    creditCost: 85000,
    techLevel: 5,
    criticalHitChance: 6,
    evasionBonus: 4,
    specialAbilities: ['FIGHTER_CARRIER', 'ELITE_SENSORS', 'EXPENSIVE'],
    lore: '795년 Ri형 순항함. R형 개량형으로 텐게리급 분함대기함 색적시스템 탑재. 고성능 추구로 건조비가 전함 수준으로 급등, 양산 보류.',
  },
  // 순항함VIII - 795년 C형 (프리깃함)
  {
    class: ShipClass.CRUISER,
    variant: 'VIII' as ShipVariant,
    typeCode: 'Y795',
    modelName: '795년 C형 순항함',
    nameKo: '순항함 VIII형 (프리깃함)',
    nameJp: '巡航艦VIII型',
    nameEn: 'Cruiser Type VIII (795-C)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 48,
    power: 260,              // 연속운전용 기관
    maxSpeed: 22000,
    emergencySpeed: 28000,
    sensorRange: 2,
    frontArmor: 18,
    sideArmor: 10,
    rearArmor: 6,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 3,
    missilePower: 50,
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 400,      // 매뉴얼: 400 (탄약고 확충)
    fighterCapacity: 0,      // 매뉴얼: - (추정 미탑재)
    troopCapacity: 0,
    repairMaterialPerShip: 80,
    materialCost: 8000,
    creditCost: 45000,
    techLevel: 3,
    criticalHitChance: 6,
    evasionBonus: 3,
    specialAbilities: ['LONG_RANGE_PATROL', 'ESCORT'],
    lore: '795년 C형 순항함 (프리깃함). 장기 전투항행에 적합하도록 개조. 연속운전용 기관, 탄약고 확충. 수송선단 호위 등에 사용.',
  },
  // 레거시 데이터 호환용 (기존 AIA 타입)
  {
    class: ShipClass.CRUISER,
    variant: 'I' as ShipVariant,
    typeCode: 'AIA',
    modelName: '아이아스급 순양함 (레거시)',
    nameKo: '아이아스급 I형',
    nameJp: 'アイアス級I型',
    nameEn: 'Ajax-class Type I',
    faction: 'ALLIANCE',
    buildTime: 60,
    crewRequired: 50,
    power: 275,
    maxSpeed: 7800,
    emergencySpeed: 9800,
    sensorRange: 26,
    frontArmor: 62,
    sideArmor: 38,
    rearArmor: 14,
    shieldProtection: 3,
    shieldCapacity: 11000,
    hullStrength: 4800,
    shieldRegenRate: 32,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 85,
    gunConsumption: 2,
    missilePower: 58,
    missileConsumption: 2,
    aaPower: 7,
    cargoCapacity: 9500,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 75,
    materialCost: 7500,
    creditCost: 43000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 6,
    specialAbilities: ['MULTI_ROLE', 'RAPID_FIRE', 'SCOUT_CAPABLE'],
    lore: '동맹 해군의 다목적 순양함 (레거시 데이터).',
  },
  {
    class: ShipClass.CRUISER,
    variant: 'II' as ShipVariant,
    typeCode: 'AIA',
    modelName: '아이아스급 중순양함 (레거시)',
    nameKo: '아이아스급 II형',
    nameJp: 'アイアス級II型',
    nameEn: 'Ajax-class Type II',
    faction: 'ALLIANCE',
    buildTime: 70,
    crewRequired: 55,
    power: 295,
    maxSpeed: 7400,
    emergencySpeed: 9300,
    sensorRange: 28,
    frontArmor: 72,
    sideArmor: 45,
    rearArmor: 17,
    shieldProtection: 4,
    shieldCapacity: 13000,
    hullStrength: 5600,
    shieldRegenRate: 36,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 95,
    gunConsumption: 2,
    missilePower: 70,
    missileConsumption: 2,
    aaPower: 9,
    cargoCapacity: 10500,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 88,
    materialCost: 9000,
    creditCost: 52000,
    techLevel: 3,
    criticalHitChance: 7,
    evasionBonus: 4,
    specialAbilities: ['MULTI_ROLE', 'RAPID_FIRE', 'HEAVY_CRUISER'],
    lore: '화력과 방어력을 균형있게 강화한 중순양함.',
  },
];

/**
 * 동맹 타격순항함 (794년형) - 매뉴얼 9249~9399행 (동맹 전용)
 * 구식화된 790년형 표준순항함의 빔병장과 전투정 탑재기능을 제거하고 다수의 중성자 미사일 발사시스템을 탑재
 * 795년형 표준순항함의 3배 미사일 투사능력 보유, 단 계전능력 저하
 */
export const ALLIANCE_STRIKE_CRUISERS: DetailedShipSpec[] = [
  // 타격순항함I - 794년형 타격순항함
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'I' as ShipVariant,
    typeCode: 'Y794',
    modelName: '794년형 타격순항함',
    nameKo: '타격순항함 I형',
    nameJp: '打撃巡航艦I型',
    nameEn: 'Strike Cruiser Type I (794)',
    faction: 'ALLIANCE',
    buildTime: 90,           // 매뉴얼: 90
    crewRequired: 60,
    power: 230,              // 매뉴얼: 230
    maxSpeed: 24000,         // 매뉴얼: 24,000
    emergencySpeed: 30000,
    sensorRange: 2,          // 매뉴얼: 2만km
    frontArmor: 16,          // 매뉴얼: 16
    sideArmor: 10,           // 매뉴얼: 10
    rearArmor: 6,            // 매뉴얼: 6
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5000,
    shieldRegenRate: 0,
    beamPower: 0,            // 매뉴얼: - (빔병장 제거)
    beamConsumption: 0,
    gunPower: 0,             // 매뉴얼: - (건 없음)
    gunConsumption: 0,
    missilePower: 150,       // 매뉴얼: 150/8 (3배 미사일 투사력)
    missileConsumption: 8,
    aaPower: 40,             // 매뉴얼: 40
    cargoCapacity: 480,      // 매뉴얼: 480
    fighterCapacity: 0,      // 전투정 미탑재
    troopCapacity: 0,
    repairMaterialPerShip: 60, // 매뉴얼: 60
    materialCost: 10000,
    creditCost: 58000,
    techLevel: 3,
    criticalHitChance: 8,
    evasionBonus: 3,
    specialAbilities: ['MISSILE_SATURATION', 'NO_BEAM', 'ALLIANCE_ONLY'],
    lore: '794년형 타격순항함. 790년형 순항함을 개조, 미사일 발사시스템 집중 탑재. 795년형의 3배 미사일 투사력.',
  },
  // 타격순항함II - 794년 L형 (고속형)
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'II' as ShipVariant,
    typeCode: 'Y794',
    modelName: '794년 L형 타격순항함',
    nameKo: '타격순항함 II형',
    nameJp: '打撃巡航艦II型',
    nameEn: 'Strike Cruiser Type II (794-L)',
    faction: 'ALLIANCE',
    buildTime: 80,
    crewRequired: 55,
    power: 250,
    maxSpeed: 28000,         // 매뉴얼: 28,000 (고속)
    emergencySpeed: 35000,
    sensorRange: 2,
    frontArmor: 15,          // 매뉴얼: 15 (장갑 경량화)
    sideArmor: 7,            // 매뉴얼: 7
    rearArmor: 5,            // 매뉴얼: 5
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 150,       // 매뉴얼: 150/8
    missileConsumption: 8,
    aaPower: 40,
    cargoCapacity: 400,      // 매뉴얼: 400
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 60,
    materialCost: 9500,
    creditCost: 55000,
    techLevel: 3,
    criticalHitChance: 7,
    evasionBonus: 6,         // 고기동
    specialAbilities: ['MISSILE_SATURATION', 'NO_BEAM', 'HIGH_SPEED', 'ALLIANCE_ONLY'],
    lore: '794년 L형 타격순항함. 요소 부분 외 복합장갑 제거, 함체 경량화로 항행성능 향상.',
  },
  // 타격순항함III - 794년 H형 (장갑 강화)
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'III' as ShipVariant,
    typeCode: 'Y794',
    modelName: '794년 H형 타격순항함',
    nameKo: '타격순항함 III형',
    nameJp: '打撃巡航艦III型',
    nameEn: 'Strike Cruiser Type III (794-H)',
    faction: 'ALLIANCE',
    buildTime: 100,
    crewRequired: 62,
    power: 230,
    maxSpeed: 22000,         // 매뉴얼: 22,000 (중량 증가로 속도 저하)
    emergencySpeed: 28000,
    sensorRange: 2,
    frontArmor: 24,          // 매뉴얼: 24 (장갑 대폭 강화)
    sideArmor: 14,           // 매뉴얼: 14
    rearArmor: 8,            // 매뉴얼: 8
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 60,        // 매뉴얼: 60 (미사일 탑재량 감소)
    missileConsumption: 8,
    aaPower: 40,
    cargoCapacity: 480,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
    materialCost: 12000,
    creditCost: 68000,
    techLevel: 4,
    criticalHitChance: 8,
    evasionBonus: 0,
    specialAbilities: ['MISSILE_SATURATION', 'NO_BEAM', 'HEAVY_ARMOR', 'ALLIANCE_ONLY'],
    lore: '794년 H형 타격순항함. 장갑을 철저히 강화. 장갑 증가로 함내 공간 압박, 미사일 탑재량 감소.',
  },
  // 타격순항함IV - 794년 E형 (전시급조형)
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y794',
    modelName: '794년 E형 타격순항함',
    nameKo: '타격순항함 IV형 (전시급조형)',
    nameJp: '打撃巡航艦IV型',
    nameEn: 'Strike Cruiser Type IV (794-E)',
    faction: 'ALLIANCE',
    buildTime: 60,           // 전시급조형으로 공기 단축
    crewRequired: 58,
    power: 200,              // 상선용 저출력 기관
    maxSpeed: 20000,         // 매뉴얼: 20,000
    emergencySpeed: 25000,
    sensorRange: 1,          // 796년형 구축함 센서 사용
    frontArmor: 16,
    sideArmor: 10,
    rearArmor: 6,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 150,
    missileConsumption: 8,
    aaPower: 40,
    cargoCapacity: 480,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 60,
    materialCost: 7500,
    creditCost: 42000,
    techLevel: 2,
    criticalHitChance: 6,
    evasionBonus: 1,
    specialAbilities: ['MISSILE_SATURATION', 'NO_BEAM', 'MASS_PRODUCTION', 'ALLIANCE_ONLY'],
    lore: '794년 E형 타격순항함 (전시급조형). 상선용 저출력 기관, 796년형 구축함 센서 사용.',
  },
  // 정찰순항함대 (레다급)
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'V' as ShipVariant,
    typeCode: 'Y794',
    modelName: '레다급 정찰순항함',
    nameKo: '정찰순항함대 (레다급)',
    nameJp: '偵察巡航艦隊（レダ級）',
    nameEn: 'Recon Cruiser (Leda-class)',
    faction: 'ALLIANCE',
    buildTime: 110,
    crewRequired: 70,
    power: 300,              // 매뉴얼: 300
    maxSpeed: 28000,         // 매뉴얼: 28,000 (고속)
    emergencySpeed: 35000,
    sensorRange: 8,          // 고성능 센서
    frontArmor: 17,          // 매뉴얼: 17
    sideArmor: 12,           // 매뉴얼: 12
    rearArmor: 8,            // 매뉴얼: 8
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5500,
    shieldRegenRate: 0,
    beamPower: 4,            // 매뉴얼: 전함용 광자포
    beamConsumption: 0,
    gunPower: 60,            // 매뉴얼: 60
    gunConsumption: 0,
    missilePower: 50,        // 매뉴얼: 50
    missileConsumption: 2,
    aaPower: 40,
    cargoCapacity: 480,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100, // 매뉴얼: 100
    materialCost: 20000,
    creditCost: 95000,
    techLevel: 5,
    criticalHitChance: 7,
    evasionBonus: 6,
    specialAbilities: ['ADVANCED_SENSORS', 'HIGH_SPEED', 'INDEPENDENT_COMBAT', 'ALLIANCE_ONLY'],
    lore: '795년 건조 개시 레다급 정찰순항함. 정찰/연락 전문 고속함. 전함용 광자포와 레이저수폭 미사일 보유, 독립 전투 가능. 한정 용도로 생산수 극소.',
  },
  // 레거시 호환용
  {
    class: ShipClass.STRIKE_CRUISER,
    variant: 'I' as ShipVariant,
    typeCode: 'SCA',
    modelName: '타격순항함 (레거시)',
    nameKo: '타격순항함 I형 (레거시)',
    nameJp: '打撃巡航艦I型',
    nameEn: 'Strike Cruiser Type I (Legacy)',
    faction: 'ALLIANCE',
    buildTime: 75,
    crewRequired: 60,
    power: 300,
    maxSpeed: 7200,
    emergencySpeed: 9000,
    sensorRange: 24,
    frontArmor: 75,
    sideArmor: 45,
    rearArmor: 18,
    shieldProtection: 3,
    shieldCapacity: 13000,
    hullStrength: 5400,
    shieldRegenRate: 35,
    beamPower: 3,
    beamConsumption: 0,
    gunPower: 100,
    gunConsumption: 2,
    missilePower: 75,
    missileConsumption: 3,
    aaPower: 9,
    cargoCapacity: 11000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 90,
    materialCost: 10000,
    creditCost: 58000,
    techLevel: 3,
    criticalHitChance: 8,
    evasionBonus: 3,
    specialAbilities: ['ASSAULT_MODE', 'MISSILE_BARRAGE', 'HEAVY_CRUISER'],
    lore: '동맹군 전용 타격 순양함 (레거시 데이터).',
  },
];

/**
 * 동맹 구축함 (796년형) - 매뉴얼 9400~9561행
 * 795년형 표준순항함의 1/2강의 함체에 6문의 광자 펄스포를 장비하는 중무장함
 * 쉴드, 색적기능, 거주설비는 우주함으로서 필요 최소한만 장비
 * 병장 탑재 용적 확보를 위해 전투정 미탑재
 */
export const ALLIANCE_DESTROYERS: DetailedShipSpec[] = [
  // 구축함I - 796년형 표준구축함
  {
    class: ShipClass.DESTROYER,
    variant: 'I' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년형 표준구축함',
    nameKo: '구축함 I형',
    nameJp: '駆逐艦I型',
    nameEn: 'Destroyer Type I (796)',
    faction: 'ALLIANCE',
    buildTime: 50,           // 매뉴얼: 50
    crewRequired: 30,
    power: 220,              // 매뉴얼: 220
    maxSpeed: 30000,         // 매뉴얼: 30,000
    emergencySpeed: 38000,
    sensorRange: 1,          // 매뉴얼: 1만km (필요 최소한)
    frontArmor: 10,          // 매뉴얼: 10
    sideArmor: 6,            // 매뉴얼: 6
    rearArmor: 4,            // 매뉴얼: 4
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2400,
    shieldRegenRate: 0,
    beamPower: 6,            // 매뉴얼: 6문 광자펄스포 (기함 19)
    beamConsumption: 0,
    gunPower: 50,            // 매뉴얼: 50/2
    gunConsumption: 2,
    missilePower: 50,        // 매뉴얼: 50/2
    missileConsumption: 2,
    aaPower: 24,             // 매뉴얼: 24
    cargoCapacity: 90,       // 매뉴얼: 90
    fighterCapacity: 0,      // 매뉴얼: 전투정 미탑재
    troopCapacity: 0,
    repairMaterialPerShip: 50, // 매뉴얼: 50
    materialCost: 2800,
    creditCost: 17000,
    techLevel: 2,
    criticalHitChance: 5,
    evasionBonus: 10,
    specialAbilities: ['HIGH_SPEED', 'HEAVY_ARMAMENT', 'NO_FIGHTERS'],
    lore: '796년형 표준구축함. 순항함의 1/2 함체에 6문의 광자펄스포 장비. 쉴드/색적/거주는 최소한, 전투정 미탑재.',
  },
  // 구축함II - 796년 M형 (미사일 강화)
  {
    class: ShipClass.DESTROYER,
    variant: 'II' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 M형 구축함',
    nameKo: '구축함 II형',
    nameJp: '駆逐艦II型',
    nameEn: 'Destroyer Type II (796-M)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 30,
    power: 220,
    maxSpeed: 26000,         // 매뉴얼: 26,000
    emergencySpeed: 33000,
    sensorRange: 1,
    frontArmor: 10,
    sideArmor: 6,
    rearArmor: 4,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2400,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 80,        // 매뉴얼: 80/3 (미사일 증설)
    missileConsumption: 3,
    aaPower: 24,
    cargoCapacity: 120,      // 매뉴얼: 120
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 50,
    materialCost: 3200,
    creditCost: 19000,
    techLevel: 2,
    criticalHitChance: 5,
    evasionBonus: 9,         // 매뉴얼: 자세제어 스러스터 증설로 선회 향상
    specialAbilities: ['HIGH_SPEED', 'MISSILE_ENHANCED', 'IMPROVED_MANEUVER'],
    lore: '796년 M형 구축함. 중성자 미사일 발사시스템 증설. 자세제어 스러스터 증설로 선회성능 향상.',
  },
  // 구축함III - 796년 L형 (고속형)
  {
    class: ShipClass.DESTROYER,
    variant: 'III' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 L형 구축함',
    nameKo: '구축함 III형',
    nameJp: '駆逐艦III型',
    nameEn: 'Destroyer Type III (796-L)',
    faction: 'ALLIANCE',
    buildTime: 45,
    crewRequired: 28,
    power: 250,              // 고출력 기관
    maxSpeed: 27000,         // 매뉴얼: 27,000
    emergencySpeed: 34000,
    sensorRange: 1,
    frontArmor: 4,           // 매뉴얼: 4 (장갑 거의 제거)
    sideArmor: 1,            // 매뉴얼: 1
    rearArmor: 1,            // 추정
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 1800,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 2,
    aaPower: 24,
    cargoCapacity: 80,       // 매뉴얼: 80
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 40,
    materialCost: 2500,
    creditCost: 15000,
    techLevel: 2,
    criticalHitChance: 4,
    evasionBonus: 15,        // 고기동
    specialAbilities: ['ULTRA_HIGH_SPEED', 'NO_ARMOR', 'ESCORT'],
    lore: '796년 L형 구축함. 장갑 제거로 고속 항행 가능. 장갑 방어는 거의 없음. 고속 기함 수반 호위용.',
  },
  // 구축함IV - 796년 H형 (장갑 강화)
  {
    class: ShipClass.DESTROYER,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 H형 구축함',
    nameKo: '구축함 IV형',
    nameJp: '駆逐艦IV型',
    nameEn: 'Destroyer Type IV (796-H)',
    faction: 'ALLIANCE',
    buildTime: 60,
    crewRequired: 32,
    power: 220,
    maxSpeed: 28000,         // 매뉴얼: 28,000
    emergencySpeed: 35000,
    sensorRange: 1,
    frontArmor: 12,          // 매뉴얼: 12 (장갑 증설)
    sideArmor: 8,            // 매뉴얼: 8
    rearArmor: 6,            // 매뉴얼: 6
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 3000,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 2,
    aaPower: 24,
    cargoCapacity: 160,      // 매뉴얼: 160
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 55,
    materialCost: 3500,
    creditCost: 20000,
    techLevel: 3,
    criticalHitChance: 5,
    evasionBonus: 8,         // 매뉴얼: 기동성능 약간 저하
    specialAbilities: ['HIGH_SPEED', 'REINFORCED_ARMOR'],
    lore: '796년 H형 구축함. 장갑 증설로 방어 강화. 함체 중량 증대로 기동성능 약간 저하.',
  },
  // 구축함V - 796년 C형 (코르벳함)
  {
    class: ShipClass.DESTROYER,
    variant: 'V' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 C형 구축함',
    nameKo: '구축함 V형 (코르벳함)',
    nameJp: '駆逐艦V型',
    nameEn: 'Destroyer Type V (796-C)',
    faction: 'ALLIANCE',
    buildTime: 50,
    crewRequired: 28,
    power: 230,              // 연속운전용 기관
    maxSpeed: 30000,
    emergencySpeed: 38000,
    sensorRange: 1,
    frontArmor: 10,
    sideArmor: 6,
    rearArmor: 4,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2400,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 2,
    aaPower: 24,
    cargoCapacity: 120,      // 탄약고 확충
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 50,
    materialCost: 3000,
    creditCost: 18000,
    techLevel: 2,
    criticalHitChance: 5,
    evasionBonus: 10,
    specialAbilities: ['HIGH_SPEED', 'LONG_RANGE_PATROL', 'ESCORT'],
    lore: '796년 C형 구축함 (코르벳함). 장기 전투항행에 적합하도록 개조. 연속운전용 기관, 탄약고 확충. 수송선단 호위 등에 사용.',
  },
  // 구축함VI - 796년 R형 (강행정찰용)
  {
    class: ShipClass.DESTROYER,
    variant: 'VI' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 R형 구축함',
    nameKo: '구축함 VI형 (정찰구축함)',
    nameJp: '駆逐艦VI型',
    nameEn: 'Destroyer Type VI (796-R)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 30,
    power: 220,
    maxSpeed: 30000,
    emergencySpeed: 38000,
    sensorRange: 2,          // 매뉴얼: 795년형 순항함 색적센서
    frontArmor: 10,
    sideArmor: 6,
    rearArmor: 4,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2400,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 50,
    missileConsumption: 2,
    aaPower: 24,
    cargoCapacity: 90,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 50,
    materialCost: 3200,
    creditCost: 19000,
    techLevel: 3,
    criticalHitChance: 5,
    evasionBonus: 12,        // 고도 전자신호 차단 기능
    specialAbilities: ['HIGH_SPEED', 'ADVANCED_SENSORS', 'STEALTH', 'RECON'],
    lore: '796년 R형 구축함 (정찰구축함). 강행정찰용으로 개조. 795년형 순항함 색적센서와 고도 전자신호 차단기능, 은밀행동 성능 향상.',
  },
  // 구축함VII - 796년 A형 (방공구축함)
  {
    class: ShipClass.DESTROYER,
    variant: 'VII' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 A형 구축함',
    nameKo: '구축함 VII형 (방공구축함)',
    nameJp: '駆逐艦VII型',
    nameEn: 'Destroyer Type VII (796-A)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 32,
    power: 220,
    maxSpeed: 28000,
    emergencySpeed: 35000,
    sensorRange: 1,
    frontArmor: 8,           // 매뉴얼: 8
    sideArmor: 4,            // 매뉴얼: 4
    rearArmor: 1,            // 매뉴얼: 1
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2200,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 0,             // 매뉴얼: - (대공 특화)
    gunConsumption: 0,
    missilePower: 50,
    missileConsumption: 2,
    aaPower: 120,            // 매뉴얼: 120 (대폭 강화, 순항함 이상)
    cargoCapacity: 90,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 40,
    materialCost: 3500,
    creditCost: 21000,
    techLevel: 3,
    criticalHitChance: 4,
    evasionBonus: 9,
    specialAbilities: ['HIGH_SPEED', 'AA_SPECIALIST'],
    lore: '796년 A형 구축함 (방공구축함). 대공병장을 철저히 강화. 795년형 순항함을 웃도는 대공전투능력.',
  },
  // 구축함VIII - 796년 E형 (전시급조형)
  {
    class: ShipClass.DESTROYER,
    variant: 'VIII' as ShipVariant,
    typeCode: 'Y796D',
    modelName: '796년 E형 구축함',
    nameKo: '구축함 VIII형 (전시급조형)',
    nameJp: '駆逐艦VIII型',
    nameEn: 'Destroyer Type VIII (796-E)',
    faction: 'ALLIANCE',
    buildTime: 25,           // 매뉴얼: 약 절반의 공기
    crewRequired: 28,
    power: 200,
    maxSpeed: 24000,         // 매뉴얼: 24,000
    emergencySpeed: 30000,
    sensorRange: 0,          // 매뉴얼: 색적센서 간략화 (거의 없음)
    frontArmor: 10,
    sideArmor: 6,
    rearArmor: 4,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2200,
    shieldRegenRate: 0,
    beamPower: 6,
    beamConsumption: 0,
    gunPower: 50,
    gunConsumption: 2,
    missilePower: 8,         // 매뉴얼: 외장식 런처 4발만 가능
    missileConsumption: 1,
    aaPower: 24,
    cargoCapacity: 50,       // 매뉴얼: 50
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 45,
    materialCost: 1800,
    creditCost: 11000,
    techLevel: 1,
    criticalHitChance: 4,
    evasionBonus: 7,
    specialAbilities: ['HIGH_SPEED', 'MASS_PRODUCTION', 'LIMITED_MISSILE'],
    lore: '796년 E형 구축함 (전시급조형). 색적센서 간략화, 미사일은 외장식 런처 4발만. 약 절반의 공기로 완성 가능.',
  },
  // 레거시 호환용 (PAT)
  {
    class: ShipClass.DESTROYER,
    variant: 'I' as ShipVariant,
    typeCode: 'PAT',
    modelName: '파트로클로스급 구축함 (레거시)',
    nameKo: '파트로클로스급 I형',
    nameJp: 'パトロクロス級I型',
    nameEn: 'Patroclus-class Type I (Legacy)',
    faction: 'ALLIANCE',
    buildTime: 30,
    crewRequired: 30,
    power: 195,
    maxSpeed: 29000,
    emergencySpeed: 36000,
    sensorRange: 7,
    frontArmor: 28,
    sideArmor: 18,
    rearArmor: 7,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2400,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 48,
    gunConsumption: 2,
    missilePower: 100,
    missileConsumption: 2,
    aaPower: 4,
    cargoCapacity: 2200,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 38,
    materialCost: 2800,
    creditCost: 17000,
    techLevel: 1,
    criticalHitChance: 4,
    evasionBonus: 18,
    specialAbilities: ['TORPEDO_ATTACK', 'HIGH_SPEED', 'SCOUT', 'EVASION_BONUS'],
    lore: '동맹군의 고속 구축함 (레거시 데이터).',
  },
  {
    class: ShipClass.DESTROYER,
    variant: 'II' as ShipVariant,
    typeCode: 'PAT',
    modelName: '파트로클로스급 개량형 (레거시)',
    nameKo: '파트로클로스급 II형',
    nameJp: 'パトロクロス級II型',
    nameEn: 'Patroclus-class Type II (Legacy)',
    faction: 'ALLIANCE',
    buildTime: 35,
    crewRequired: 32,
    power: 210,
    maxSpeed: 30500,
    emergencySpeed: 38000,
    sensorRange: 10,
    frontArmor: 30,
    sideArmor: 20,
    rearArmor: 9,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2600,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 52,
    gunConsumption: 2,
    missilePower: 115,
    missileConsumption: 2,
    aaPower: 6,
    cargoCapacity: 2400,
    fighterCapacity: 1,
    troopCapacity: 0,
    repairMaterialPerShip: 42,
    materialCost: 3200,
    creditCost: 20000,
    techLevel: 2,
    criticalHitChance: 5,
    evasionBonus: 20,
    specialAbilities: ['TORPEDO_ATTACK', 'HIGH_SPEED', 'SCOUT', 'EVASION_BONUS', 'ADVANCED_SENSORS'],
    lore: '센서와 기동성을 강화한 개량형 구축함.',
  },
];

/**
 * 동맹 전투정모함 (796년형) - 매뉴얼 9562~9670행
 * 반수납식 격납고에 단좌전투정 '스파르타니안'을 100척 탑재
 * 787년형 전함에 필적하는 포전능력을 가진 대형 전투함
 */
export const ALLIANCE_FIGHTER_CARRIERS: DetailedShipSpec[] = [
  // 전투정모함I - 796년형 표준전투정모함
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'I' as ShipVariant,
    typeCode: 'Y796C',
    modelName: '796년형 표준전투정모함',
    nameKo: '전투정모함 I형',
    nameJp: '戦闘艇母艦I型',
    nameEn: 'Fighter Carrier Type I (796)',
    faction: 'ALLIANCE',
    buildTime: 180,          // 매뉴얼: 180
    crewRequired: 125,
    power: 300,              // 매뉴얼 추정
    maxSpeed: 16000,         // 매뉴얼: 16,000
    emergencySpeed: 20000,
    sensorRange: 7,          // 매뉴얼: 7만km
    frontArmor: 46,          // 매뉴얼: 46
    sideArmor: 20,           // 매뉴얼: 20
    rearArmor: 14,           // 매뉴얼: 14
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 8000,
    shieldRegenRate: 0,
    beamPower: 4,            // 매뉴얼: 함수광자포 (64)
    beamConsumption: 0,
    gunPower: 0,             // 매뉴얼: -
    gunConsumption: 0,
    missilePower: 70,        // 매뉴얼: 70/3
    missileConsumption: 3,
    aaPower: 180,            // 매뉴얼: 180
    cargoCapacity: 2240,     // 매뉴얼: 2,240
    fighterCapacity: 10,     // 매뉴얼: 전투정 10척 (100대 스파르타니안)
    troopCapacity: 0,
    repairMaterialPerShip: 180, // 매뉴얼: 180
    materialCost: 25000,
    creditCost: 140000,
    techLevel: 4,
    criticalHitChance: 4,
    evasionBonus: 0,
    specialAbilities: ['SPARTANIAN_CARRIER', 'HANGAR_DECK', 'HEAVY_AA'],
    lore: '796년형 표준전투정모함. 스파르타니안 100기 탑재, 787년형 전함에 필적하는 포전능력.',
  },
  // 전투정모함II - 796년 A형 (간략화)
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'II' as ShipVariant,
    typeCode: 'Y796C',
    modelName: '796년 A형 전투정모함',
    nameKo: '전투정모함 II형',
    nameJp: '戦闘艇母艦II型',
    nameEn: 'Fighter Carrier Type II (796-A)',
    faction: 'ALLIANCE',
    buildTime: 160,
    crewRequired: 120,
    power: 280,
    maxSpeed: 18000,         // 매뉴얼: 18,000
    emergencySpeed: 22000,
    sensorRange: 7,
    frontArmor: 44,          // 매뉴얼: 44
    sideArmor: 18,           // 매뉴얼: 18
    rearArmor: 14,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 7500,
    shieldRegenRate: 0,
    beamPower: 0,            // 매뉴얼: 함수광자포 미장비 (구조간략화)
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 70,
    missileConsumption: 3,
    aaPower: 180,
    cargoCapacity: 2000,     // 매뉴얼: 2,000
    fighterCapacity: 10,
    troopCapacity: 0,
    repairMaterialPerShip: 170,
    materialCost: 22000,
    creditCost: 125000,
    techLevel: 4,
    criticalHitChance: 3,
    evasionBonus: 1,
    specialAbilities: ['SPARTANIAN_CARRIER', 'HANGAR_DECK', 'HEAVY_AA', 'SIMPLIFIED'],
    lore: '796년 A형 전투정모함. 구조간략화로 함수광자포 미장비. 외관은 표준형과 구별 어려움.',
  },
  // 전투정모함III - 796년 L형 (고속형)
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'III' as ShipVariant,
    typeCode: 'Y796C',
    modelName: '796년 L형 전투정모함',
    nameKo: '전투정모함 III형',
    nameJp: '戦闘艇母艦III型',
    nameEn: 'Fighter Carrier Type III (796-L)',
    faction: 'ALLIANCE',
    buildTime: 150,
    crewRequired: 118,
    power: 320,
    maxSpeed: 14000,         // 매뉴얼: 14,000
    emergencySpeed: 18000,
    sensorRange: 7,
    frontArmor: 40,          // 장갑 경감
    sideArmor: 16,
    rearArmor: 12,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6800,
    shieldRegenRate: 0,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 70,
    missileConsumption: 3,
    aaPower: 180,
    cargoCapacity: 2240,
    fighterCapacity: 10,
    troopCapacity: 0,
    repairMaterialPerShip: 160,
    materialCost: 23000,
    creditCost: 130000,
    techLevel: 4,
    criticalHitChance: 3,
    evasionBonus: 2,         // 매뉴얼: 선회성능 제한 운용
    specialAbilities: ['SPARTANIAN_CARRIER', 'HANGAR_DECK', 'HEAVY_AA', 'HIGH_SPEED'],
    lore: '796년 L형 전투정모함. 장갑 경감으로 함체 중량 감소, 고속 발휘. 함체구조재도 경량화되어 강도 저하, 선회성능 제한 운용.',
  },
  // 전투정모함IV - 796년 H형 (장갑 강화)
  {
    class: ShipClass.FIGHTER_CARRIER,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y796C',
    modelName: '796년 H형 전투정모함',
    nameKo: '전투정모함 IV형',
    nameJp: '戦闘艇母艦IV型',
    nameEn: 'Fighter Carrier Type IV (796-H)',
    faction: 'ALLIANCE',
    buildTime: 200,
    crewRequired: 130,
    power: 300,
    maxSpeed: 14000,
    emergencySpeed: 18000,
    sensorRange: 7,
    frontArmor: 48,          // 매뉴얼: 48 (장갑 증설)
    sideArmor: 22,           // 매뉴얼: 22
    rearArmor: 18,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 9000,
    shieldRegenRate: 0,
    beamPower: 4,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 70,
    missileConsumption: 3,
    aaPower: 180,
    cargoCapacity: 2240,
    fighterCapacity: 10,
    troopCapacity: 0,
    repairMaterialPerShip: 200,
    materialCost: 28000,
    creditCost: 155000,
    techLevel: 4,
    criticalHitChance: 4,
    evasionBonus: -1,
    specialAbilities: ['SPARTANIAN_CARRIER', 'HANGAR_DECK', 'HEAVY_AA', 'REINFORCED_ARMOR'],
    lore: '796년 H형 전투정모함. 복합장갑 증설. 반수납식 전투정 행거는 여전히 방어상 약점.',
  },
];

/**
 * 동맹 공작함 (793년형) - 매뉴얼 9671~9767행
 * 우주공간에서 자유행성동맹군에 속하는 모든 종류의 함정을 수리하는 능력 보유
 */
export const ALLIANCE_REPAIR_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'Y793',
    modelName: '793년형 표준공작함',
    nameKo: '공작함 I형',
    nameJp: '工作艦I型',
    nameEn: 'Repair Ship Type I (793)',
    faction: 'ALLIANCE',
    buildTime: 120,          // 매뉴얼: 120
    crewRequired: 80,
    power: 180,
    maxSpeed: 18000,         // 매뉴얼: 18,000
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 24,          // 매뉴얼: 24
    sideArmor: 14,           // 매뉴얼: 14
    rearArmor: 8,            // 매뉴얼: 8
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,             // 매뉴얼: 40
    cargoCapacity: 1200,     // 매뉴얼: 1,200
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100, // 매뉴얼: 100
    materialCost: 12000,
    creditCost: 70000,
    techLevel: 3,
    criticalHitChance: 2,
    evasionBonus: 0,
    specialAbilities: ['REPAIR_BAY', 'FLEET_SUPPORT'],
    lore: '793년형 표준공작함. 우주공간에서 동맹군 모든 함정 수리 가능.',
  },
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'Y793',
    modelName: '793년 L형 공작함',
    nameKo: '공작함 II형',
    nameJp: '工作艦II型',
    nameEn: 'Repair Ship Type II (793-L)',
    faction: 'ALLIANCE',
    buildTime: 100,
    crewRequired: 75,
    power: 200,
    maxSpeed: 20000,         // 매뉴얼: 20,000 (고기동)
    emergencySpeed: 25000,
    sensorRange: 1,
    frontArmor: 22,          // 매뉴얼: 22
    sideArmor: 12,           // 매뉴얼: 12
    rearArmor: 8,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 1200,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 95,
    materialCost: 11000,
    creditCost: 65000,
    techLevel: 3,
    criticalHitChance: 2,
    evasionBonus: 2,
    specialAbilities: ['REPAIR_BAY', 'FLEET_SUPPORT', 'HIGH_MOBILITY'],
    lore: '793년 L형 공작함. 함체를 경량구조로 하여 기동성 향상.',
  },
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'III' as ShipVariant,
    typeCode: 'Y793',
    modelName: '793년 E형 공작함',
    nameKo: '공작함 III형',
    nameJp: '工作艦III型',
    nameEn: 'Repair Ship Type III (793-E)',
    faction: 'ALLIANCE',
    buildTime: 80,           // 전시급조형
    crewRequired: 78,
    power: 150,              // 저출력 기관
    maxSpeed: 14000,         // 매뉴얼: 14,000 (항행성능 대폭 저하)
    emergencySpeed: 18000,
    sensorRange: 1,
    frontArmor: 24,
    sideArmor: 14,
    rearArmor: 8,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 1200,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
    materialCost: 9000,
    creditCost: 55000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: -2,
    specialAbilities: ['REPAIR_BAY', 'FLEET_SUPPORT', 'MASS_PRODUCTION'],
    lore: '793년 E형 공작함. 소형함용 저출력 기관 환장. 항행성능 대폭 저하.',
  },
  {
    class: ShipClass.REPAIR_SHIP,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y793',
    modelName: '793년 S형 공작함',
    nameKo: '공작함 IV형',
    nameJp: '工作艦IV型',
    nameEn: 'Repair Ship Type IV (793-S)',
    faction: 'ALLIANCE',
    buildTime: 130,
    crewRequired: 85,
    power: 180,
    maxSpeed: 18000,
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 24,
    sideArmor: 14,
    rearArmor: 8,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 1600,     // 매뉴얼: 수리용 자재 적재량 증가
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 100,
    materialCost: 14000,
    creditCost: 80000,
    techLevel: 3,
    criticalHitChance: 2,
    evasionBonus: 0,
    specialAbilities: ['REPAIR_BAY', 'FLEET_SUPPORT', 'LARGE_CARGO'],
    lore: '793년 S형 공작함. 수리용 자재 적재량 증가.',
  },
];

/**
 * 동맹 수송함 (792년형) - 매뉴얼 9768~9867행
 * 함대기함의 약 2배 전장을 자랑하는 초대형 수송함. 최대 50만톤 화물 수송 가능
 */
export const ALLIANCE_TRANSPORTS: DetailedShipSpec[] = [
  {
    class: ShipClass.TRANSPORT,
    variant: 'I' as ShipVariant,
    typeCode: 'Y792',
    modelName: '792년형 표준수송함',
    nameKo: '수송함 I형',
    nameJp: '輸送艦I型',
    nameEn: 'Transport Type I (792)',
    faction: 'ALLIANCE',
    buildTime: 90,
    crewRequired: 40,
    power: 150,
    maxSpeed: 14000,         // 매뉴얼: 14,000
    emergencySpeed: 18000,
    sensorRange: 1,
    frontArmor: 60,          // 매뉴얼: 60
    sideArmor: 36,           // 매뉴얼: 36
    rearArmor: 22,           // 매뉴얼: 22
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6000,
    shieldRegenRate: 0,
    beamPower: 2,            // 매뉴얼: 광자펄스포 (자위용)
    beamConsumption: 0,
    gunPower: 24,            // 매뉴얼: 24
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,             // 매뉴얼: 40
    cargoCapacity: 20000,    // 매뉴얼: 20,000
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 240, // 매뉴얼: 240
    materialCost: 8000,
    creditCost: 45000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: -3,
    specialAbilities: ['CARGO_HOLD', 'LIMITED_COMBAT'],
    lore: '792년형 표준수송함. 기함의 약 2배 전장. 최대 50만톤 화물 수송 가능. 자위용 광자펄스포 장비.',
  },
  {
    class: ShipClass.TRANSPORT,
    variant: 'II' as ShipVariant,
    typeCode: 'Y792',
    modelName: '792년 A형 수송함',
    nameKo: '수송함 II형',
    nameJp: '輸送艦II型',
    nameEn: 'Transport Type II (792-A)',
    faction: 'ALLIANCE',
    buildTime: 80,
    crewRequired: 38,
    power: 150,
    maxSpeed: 13000,         // 매뉴얼: 13,000
    emergencySpeed: 16000,
    sensorRange: 1,
    frontArmor: 60,
    sideArmor: 36,
    rearArmor: 22,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 6000,
    shieldRegenRate: 0,
    beamPower: 0,            // 매뉴얼: 광자펄스포 생략
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 30,             // 매뉴얼: 30
    cargoCapacity: 20000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 240,
    materialCost: 7000,
    creditCost: 40000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: -3,
    specialAbilities: ['CARGO_HOLD', 'CIVILIAN_USE'],
    lore: '792년 A형 수송함. 광자펄스포 생략. 일부는 민수용으로 사용.',
  },
  {
    class: ShipClass.TRANSPORT,
    variant: 'III' as ShipVariant,
    typeCode: 'Y792',
    modelName: '792년 S형 수송함',
    nameKo: '수송함 III형',
    nameJp: '輸送艦III型',
    nameEn: 'Transport Type III (792-S)',
    faction: 'ALLIANCE',
    buildTime: 70,
    crewRequired: 35,
    power: 140,
    maxSpeed: 15000,         // 매뉴얼: 15,000
    emergencySpeed: 19000,
    sensorRange: 0,          // 매뉴얼: 색적센서도 철저히 간략화 (단독항행 상정외)
    frontArmor: 60,
    sideArmor: 36,
    rearArmor: 22,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 30,
    cargoCapacity: 20000,
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 240,
    materialCost: 6000,
    creditCost: 35000,
    techLevel: 1,
    criticalHitChance: 1,
    evasionBonus: -4,
    specialAbilities: ['CARGO_HOLD', 'CONVOY_ONLY'],
    lore: '792년 S형 수송함. A형 개량형. 색적센서도 철저히 간략화. 단독항행 상정외, 항상 선단 운용.',
  },
  {
    class: ShipClass.TRANSPORT,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y792',
    modelName: '792년 L형 수송함',
    nameKo: '수송함 IV형',
    nameJp: '輸送艦IV型',
    nameEn: 'Transport Type IV (792-L)',
    faction: 'ALLIANCE',
    buildTime: 100,
    crewRequired: 42,
    power: 180,              // 기관출력 강화
    maxSpeed: 16000,         // 매뉴얼: 고속항행 가능
    emergencySpeed: 20000,
    sensorRange: 1,
    frontArmor: 60,
    sideArmor: 36,
    rearArmor: 22,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 5800,
    shieldRegenRate: 0,
    beamPower: 2,
    beamConsumption: 0,
    gunPower: 24,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 16000,    // 매뉴얼: 물자 탑재량 감소 (기관부 압박)
    fighterCapacity: 0,
    troopCapacity: 0,
    repairMaterialPerShip: 220,
    materialCost: 10000,
    creditCost: 55000,
    techLevel: 3,
    criticalHitChance: 1,
    evasionBonus: -1,
    specialAbilities: ['CARGO_HOLD', 'LIMITED_COMBAT', 'HIGH_SPEED'],
    lore: '792년 L형 수송함. 기관출력 강화, 고속항행 가능. 기관부에 압박되어 물자 탑재량 감소.',
  },
];

/**
 * 동맹 병원수송함 (788년형) - 매뉴얼 9868~9975행
 * 자유행성동맹군에서는 정부 보조로 건조된 고속상선이 징용되어 병원수송 수행
 * 완전무장 병원 약 600명과 그 장비 수송 가능
 */
export const ALLIANCE_HOSPITAL_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.TROOP_TRANSPORT,
    variant: 'I' as ShipVariant,
    typeCode: 'Y788',
    modelName: '788년형 표준병원수송함',
    nameKo: '병원수송함 I형',
    nameJp: '兵員輸送艦I型',
    nameEn: 'Hospital Transport Type I (788)',
    faction: 'ALLIANCE',
    buildTime: 100,
    crewRequired: 35,
    power: 160,
    maxSpeed: 18000,         // 매뉴얼: 18,000
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 5,           // 매뉴얼: 5
    sideArmor: 3,            // 매뉴얼: 3
    rearArmor: 2,            // 매뉴얼: 2
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,             // 매뉴얼: -
    gunConsumption: 0,
    missilePower: 0,         // 매뉴얼: -
    missileConsumption: 0,
    aaPower: 40,             // 매뉴얼: 40
    cargoCapacity: 100,      // 매뉴얼: -
    fighterCapacity: 0,
    troopCapacity: 600,      // 약 600명 수송
    repairMaterialPerShip: 30, // 매뉴얼: 30
    materialCost: 5000,
    creditCost: 30000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: 0,
    specialAbilities: ['MEDICAL_BAY', 'TROOP_TRANSPORT', 'CIVILIAN_ORIGIN'],
    lore: '788년형 표준병원수송함. 정부 보조로 건조된 고속상선 징용. 완전무장 병원 약 600명 수송 가능.',
  },
  {
    class: ShipClass.TROOP_TRANSPORT,
    variant: 'II' as ShipVariant,
    typeCode: 'Y788',
    modelName: '788년 A형 병원수송함',
    nameKo: '병원수송함 II형',
    nameJp: '兵員輸送艦II型',
    nameEn: 'Hospital Transport Type II (788-A)',
    faction: 'ALLIANCE',
    buildTime: 110,
    crewRequired: 36,
    power: 160,
    maxSpeed: 19000,         // 매뉴얼: 19,000
    emergencySpeed: 24000,
    sensorRange: 1,
    frontArmor: 7,           // 매뉴얼: 7
    sideArmor: 5,            // 매뉴얼: 5
    rearArmor: 4,            // 매뉴얼: 4
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 40,        // 매뉴얼: 40/1 (자위용 중성자미사일)
    missileConsumption: 1,
    aaPower: 40,
    cargoCapacity: 100,
    fighterCapacity: 0,
    troopCapacity: 600,
    repairMaterialPerShip: 30,
    materialCost: 5500,
    creditCost: 33000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: 0,
    specialAbilities: ['MEDICAL_BAY', 'TROOP_TRANSPORT', 'SELF_DEFENSE'],
    lore: '788년 A형 병원수송함. 자위용 중성자미사일 발사시스템 탑재.',
  },
  {
    class: ShipClass.TROOP_TRANSPORT,
    variant: 'III' as ShipVariant,
    typeCode: 'Y788',
    modelName: '788년 L형 병원수송함',
    nameKo: '병원수송함 III형',
    nameJp: '兵員輸送艦III型',
    nameEn: 'Hospital Transport Type III (788-L)',
    faction: 'ALLIANCE',
    buildTime: 90,
    crewRequired: 34,
    power: 180,              // 신형기관
    maxSpeed: 18000,
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 5,
    sideArmor: 3,
    rearArmor: 2,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 100,
    fighterCapacity: 0,
    troopCapacity: 600,
    repairMaterialPerShip: 30,
    materialCost: 5800,
    creditCost: 35000,
    techLevel: 3,
    criticalHitChance: 1,
    evasionBonus: 2,
    specialAbilities: ['MEDICAL_BAY', 'TROOP_TRANSPORT', 'HIGH_SPEED'],
    lore: '788년 L형 병원수송함. 신형기관 탑재 고속화. 전투우주역에서의 병원수송용.',
  },
  {
    class: ShipClass.TROOP_TRANSPORT,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y788',
    modelName: '788년 H형 병원수송함',
    nameKo: '병원수송함 IV형',
    nameJp: '兵員輸送艦IV型',
    nameEn: 'Hospital Transport Type IV (788-H)',
    faction: 'ALLIANCE',
    buildTime: 120,
    crewRequired: 38,
    power: 160,
    maxSpeed: 18000,
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 7,           // 장갑 강화
    sideArmor: 5,
    rearArmor: 4,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 3000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 0,
    missileConsumption: 0,
    aaPower: 40,
    cargoCapacity: 100,
    fighterCapacity: 0,
    troopCapacity: 600,
    repairMaterialPerShip: 35,
    materialCost: 6500,
    creditCost: 38000,
    techLevel: 2,
    criticalHitChance: 1,
    evasionBonus: 0,
    specialAbilities: ['MEDICAL_BAY', 'TROOP_TRANSPORT', 'REINFORCED_ARMOR'],
    lore: '788년 H형 병원수송함. 장갑 강화. 원형이 비장갑 민간선이므로 방어력 증강도 그리 강고하지 않음.',
  },
];

/**
 * 동맹 양륙함 (786년형/795년형) - 매뉴얼 9976~10068행
 */
export const ALLIANCE_LANDING_SHIPS: DetailedShipSpec[] = [
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'I' as ShipVariant,
    typeCode: 'Y786',
    modelName: '795년형 표준양륙함',
    nameKo: '양륙함 I형',
    nameJp: '揚陸艦I型',
    nameEn: 'Landing Ship Type I (795)',
    faction: 'ALLIANCE',
    buildTime: 50,
    crewRequired: 25,
    power: 120,
    maxSpeed: 15000,         // 매뉴얼: 15,000
    emergencySpeed: 19000,
    sensorRange: 1,
    frontArmor: 17,          // 매뉴얼: 17
    sideArmor: 12,           // 매뉴얼: 12
    rearArmor: 7,            // 매뉴얼: 7
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 2800,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,             // 매뉴얼: -
    gunConsumption: 0,
    missilePower: 40,        // 매뉴얼: 40/1
    missileConsumption: 1,
    aaPower: 40,             // 매뉴얼: 40
    cargoCapacity: 30,       // 매뉴얼: 30
    fighterCapacity: 0,
    troopCapacity: 200,
    repairMaterialPerShip: 40, // 매뉴얼: 40
    materialCost: 3500,
    creditCost: 22000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: 0,
    specialAbilities: ['LANDING_CAPABLE', 'ASSAULT_TRANSPORT'],
    lore: '795년형 표준양륙함. 기함으로 사용되는 함은 고성능 통신설비 모듈 탑재 양륙지휘함.',
  },
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'II' as ShipVariant,
    typeCode: 'Y786',
    modelName: '786년 L형 양륙함',
    nameKo: '양륙함 II형',
    nameJp: '揚陸艦II型',
    nameEn: 'Landing Ship Type II (786-L)',
    faction: 'ALLIANCE',
    buildTime: 45,
    crewRequired: 24,
    power: 140,
    maxSpeed: 18000,         // 매뉴얼: 18,000 (고속화)
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 19,          // 매뉴얼: 19
    sideArmor: 14,           // 매뉴얼: 14
    rearArmor: 9,            // 매뉴얼: 9
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 3000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 40,
    missileConsumption: 1,
    aaPower: 40,
    cargoCapacity: 30,
    fighterCapacity: 0,
    troopCapacity: 200,
    repairMaterialPerShip: 40,
    materialCost: 3800,
    creditCost: 24000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: 2,
    specialAbilities: ['LANDING_CAPABLE', 'ASSAULT_TRANSPORT', 'HIGH_SPEED'],
    lore: '786년 L형 양륙함. 신형기관 탑재 고속화. 전투우주역에서의 양륙작전용.',
  },
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'III' as ShipVariant,
    typeCode: 'Y786',
    modelName: '786년 H형 양륙함',
    nameKo: '양륙함 III형',
    nameJp: '揚陸艦III型',
    nameEn: 'Landing Ship Type III (786-H)',
    faction: 'ALLIANCE',
    buildTime: 55,
    crewRequired: 26,
    power: 120,
    maxSpeed: 15000,
    emergencySpeed: 19000,
    sensorRange: 1,
    frontArmor: 23,          // 매뉴얼: 23 (장갑 강화)
    sideArmor: 18,           // 매뉴얼: 18
    rearArmor: 18,           // 매뉴얼: 18
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 3500,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 40,
    missileConsumption: 1,
    aaPower: 40,
    cargoCapacity: 30,
    fighterCapacity: 0,
    troopCapacity: 200,
    repairMaterialPerShip: 45,
    materialCost: 4200,
    creditCost: 26000,
    techLevel: 2,
    criticalHitChance: 2,
    evasionBonus: 0,
    specialAbilities: ['LANDING_CAPABLE', 'ASSAULT_TRANSPORT', 'REINFORCED_ARMOR'],
    lore: '786년 H형 양륙함. 장갑 강화. 전투우주역에서의 양륙작전용.',
  },
  {
    class: ShipClass.LANDING_SHIP,
    variant: 'IV' as ShipVariant,
    typeCode: 'Y786',
    modelName: '786년 F형 양륙함',
    nameKo: '양륙함 IV형 (요새전용)',
    nameJp: '揚陸艦IV型',
    nameEn: 'Landing Ship Type IV (786-F)',
    faction: 'ALLIANCE',
    buildTime: 60,
    crewRequired: 28,
    power: 150,              // 기관출력 강화
    maxSpeed: 18000,
    emergencySpeed: 22000,
    sensorRange: 1,
    frontArmor: 25,          // 소형함 중 유수의 장갑
    sideArmor: 20,
    rearArmor: 15,
    shieldProtection: 0,
    shieldCapacity: 0,
    hullStrength: 4000,
    shieldRegenRate: 0,
    beamPower: 0,
    beamConsumption: 0,
    gunPower: 0,
    gunConsumption: 0,
    missilePower: 40,
    missileConsumption: 1,
    aaPower: 40,
    cargoCapacity: 20,       // 장갑척탄병 수송만 상정 (대형차량 탑재 불가)
    fighterCapacity: 0,
    troopCapacity: 150,      // 장갑척탄병만
    repairMaterialPerShip: 50,
    materialCost: 5000,
    creditCost: 32000,
    techLevel: 3,
    criticalHitChance: 2,
    evasionBonus: 1,
    specialAbilities: ['LANDING_CAPABLE', 'FORTRESS_ASSAULT', 'HEAVY_ARMOR', 'INFANTRY_ONLY'],
    lore: '786년 F형 양륙함 (요새전용). 대요새전용 특수개조. 기관출력 강화, 장갑도 소형함 유수. 장갑척탄병 수송만 상정, 대형차량 탑재 불가.',
  },
];

// ============================================================
// 전투정/뇌격정 스펙 데이터베이스
// ============================================================

/**
 * 제국 발큐레 전투정
 */
export const VALKYRIE_FIGHTER: FighterSpec = {
  id: 'WALKÜRE',
  typeCode: 'SPA',
  nameKo: '발큐레',
  nameJp: 'ヴァルキューレ',
  nameEn: 'Valkyrie',
  faction: 'EMPIRE',
  hp: 50,
  speed: 300,
  attackPower: 15,
  defensePower: 5,
  fuelCapacity: 50,
  primaryWeapon: '빔 캐논',
  secondaryWeapon: '공대함 미사일',
  abilities: ['DOGFIGHT', 'SHIELD_PENETRATION', 'HIGH_MOBILITY'],
  description: '제국 해군의 주력 전투정. 우수한 기동성과 화력을 갖추고 있다.',
};

/**
 * 제국 뇌격정
 */
export const TORPEDO_BOAT: FighterSpec = {
  id: 'TORPEDO_BOAT',
  typeCode: 'TR88',
  nameKo: '뇌격정',
  nameJp: '雷撃艇',
  nameEn: 'Torpedo Boat',
  faction: 'EMPIRE',
  hp: 40,
  speed: 250,
  attackPower: 8,
  defensePower: 3,
  fuelCapacity: 60,
  primaryWeapon: '대함 어뢰',
  secondaryWeapon: '기관포',
  abilities: ['ANTI_SHIP', 'TORPEDO_ATTACK', 'STEALTH_APPROACH'],
  description: '대형 함선 공격에 특화된 제국군 뇌격정.',
};

/**
 * 동맹 스파르타니안 전투기
 */
export const SPARTANIAN_FIGHTER: FighterSpec = {
  id: 'SPARTANIAN',
  typeCode: 'SPA',
  nameKo: '스파르타니안',
  nameJp: 'スパルタニアン',
  nameEn: 'Spartanian',
  faction: 'ALLIANCE',
  hp: 45,
  speed: 320,
  attackPower: 14,
  defensePower: 4,
  fuelCapacity: 55,
  primaryWeapon: '레이저 캐논',
  secondaryWeapon: '미사일 포드',
  abilities: ['DOGFIGHT', 'EVASION_BONUS', 'HIGH_SPEED'],
  description: '동맹군의 주력 전투기. 기동성과 회피 능력이 뛰어나다.',
};

// ============================================================
// 종합 데이터베이스
// ============================================================

/**
 * 제국군 전체 함선 목록
 */
export const ALL_EMPIRE_SHIPS: DetailedShipSpec[] = [
  ...EMPIRE_BATTLESHIPS,
  ...EMPIRE_FAST_BATTLESHIPS,
  ...EMPIRE_CRUISERS,
  ...EMPIRE_DESTROYERS,
  ...EMPIRE_FIGHTER_CARRIERS,
  ...EMPIRE_TORPEDO_CARRIERS,
  ...EMPIRE_REPAIR_SHIPS,
  ...EMPIRE_LANDING_SHIPS,
  ...EMPIRE_TRANSPORTS,
  ...EMPIRE_HOSPITAL_SHIPS,
];

/**
 * 동맹군 전체 함선 목록
 */
export const ALL_ALLIANCE_SHIPS: DetailedShipSpec[] = [
  ...ALLIANCE_BATTLESHIPS,
  ...ALLIANCE_CRUISERS,
  ...ALLIANCE_STRIKE_CRUISERS,
  ...ALLIANCE_DESTROYERS,
  ...ALLIANCE_FIGHTER_CARRIERS,
  ...ALLIANCE_REPAIR_SHIPS,
  ...ALLIANCE_TRANSPORTS,
  ...ALLIANCE_HOSPITAL_SHIPS,
  ...ALLIANCE_LANDING_SHIPS,
];

/**
 * 전체 함선 목록
 */
export const ALL_SHIPS: DetailedShipSpec[] = [
  ...ALL_EMPIRE_SHIPS,
  ...ALL_ALLIANCE_SHIPS,
];

/**
 * 전체 전투정 목록
 */
export const ALL_FIGHTERS: FighterSpec[] = [
  VALKYRIE_FIGHTER,
  TORPEDO_BOAT,
  SPARTANIAN_FIGHTER,
];

// ============================================================
// 타입 코드 기반 조회 맵
// ============================================================

export const SHIP_BY_TYPE_CODE: Map<ShipTypeCode, DetailedShipSpec[]> = new Map([
  // 제국 함선
  ['SS75', EMPIRE_BATTLESHIPS],
  ['PK86', EMPIRE_FAST_BATTLESHIPS],
  ['SK80', EMPIRE_CRUISERS],
  ['Z82', EMPIRE_DESTROYERS],
  ['FR88', EMPIRE_FIGHTER_CARRIERS],
  ['TR88', EMPIRE_TORPEDO_CARRIERS],
  ['A76', EMPIRE_REPAIR_SHIPS],
  ['A74', EMPIRE_TRANSPORTS],
  ['A72', EMPIRE_HOSPITAL_SHIPS],
  ['A78', EMPIRE_LANDING_SHIPS],
  // 동맹 함선 (매뉴얼 기준 연도형)
  ['Y787', ALLIANCE_BATTLESHIPS],
  ['Y795', ALLIANCE_CRUISERS],
  ['Y794', ALLIANCE_STRIKE_CRUISERS],
  ['Y796D', ALLIANCE_DESTROYERS],
  ['Y796C', ALLIANCE_FIGHTER_CARRIERS],
  ['Y793', ALLIANCE_REPAIR_SHIPS],
  ['Y792', ALLIANCE_TRANSPORTS],
  ['Y788', ALLIANCE_HOSPITAL_SHIPS],
  ['Y786', ALLIANCE_LANDING_SHIPS],
  // 레거시 호환
  ['LN60', EMPIRE_LANDING_SHIPS],
  ['TP90', EMPIRE_TRANSPORTS],
  ['HT90', EMPIRE_HOSPITAL_SHIPS],
  ['ACH', ALLIANCE_BATTLESHIPS],
  ['AIA', ALLIANCE_CRUISERS],
  ['PAT', ALLIANCE_DESTROYERS],
  ['SCA', ALLIANCE_STRIKE_CRUISERS],
]);

