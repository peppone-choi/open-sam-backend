/**
 * 상세 함선 스펙 정의 (Detailed Ship Specifications)
 * 매뉴얼 7523~8600행 기반 전체 함선 데이터
 * 
 * 제국군: SS75 전함, 고속전함, SK80 순양함, Z82 구축함, FR88 전투정모함, TR88 뇌격정모함, A76 공작함
 * 동맹군: 아킬레우스급, 아이아스급, 파트로클로스급, 스파르타니안
 */

import { ShipClass, ShipVariant, ShipSpec, EMPIRE_SHIP_SPECS, ALLIANCE_SHIP_SPECS } from './ship_definitions';

/**
 * 상세 함선 스펙 인터페이스 (요청된 형식)
 */
export interface DetailedShipSpec {
  id: string;
  name: string;
  nameJp: string;
  nameEn: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  class: ShipClass;
  variant: ShipVariant;
  
  // 전투 스탯
  attack: number;        // 총 공격력 (빔 + 포 + 미사일 + 대공)
  defense: number;       // 총 방어력 (장갑 평균)
  speed: number;         // 최대 속력
  
  // 용량
  crewCapacity: number;      // 필요 승조원
  cargoCapacity: number;     // 물자 적재량
  fighterCapacity: number;   // 전투정 탑재 수
  troopCapacity: number;     // 육전대 탑재 수
  
  // 생산
  buildTime: number;     // 건조 공기 (일)
  buildCost: { 
    credits: number; 
    materials: number; 
  };
  
  // 특수 능력
  abilities: string[];
  
  // 상세 스탯 (원본 데이터 참조용)
  detailedStats: {
    power: number;
    sensorRange: number;
    frontArmor: number;
    sideArmor: number;
    rearArmor: number;
    shieldProtection: number;
    shieldCapacity: number;
    beamPower: number;
    gunPower: number;
    missilePower: number;
    aaPower: number;
    repairMaterial: number;
  };
}

/**
 * 명명된 함선 클래스 (동맹군 고유)
 */
export interface NamedShipClass {
  id: string;
  className: string;
  classNameJp: string;
  classNameEn: string;
  baseClass: ShipClass;
  faction: 'ALLIANCE';
  description: string;
}

/**
 * 동맹군 명명 클래스 정의
 */
export const ALLIANCE_NAMED_CLASSES: NamedShipClass[] = [
  {
    id: 'ACHILLES',
    className: '아킬레우스급',
    classNameJp: 'アキレス級',
    classNameEn: 'Achilles Class',
    baseClass: ShipClass.BATTLESHIP,
    faction: 'ALLIANCE',
    description: '동맹군 주력 전함. 균형 잡힌 공방 성능',
  },
  {
    id: 'AJAX',
    className: '아이아스급',
    classNameJp: 'アイアス級',
    classNameEn: 'Ajax Class',
    baseClass: ShipClass.BATTLESHIP,
    faction: 'ALLIANCE',
    description: '동맹군 중장갑 전함. 방어력 특화',
  },
  {
    id: 'PATROCLUS',
    className: '파트로클로스급',
    classNameJp: 'パトロクロス級',
    classNameEn: 'Patroclus Class',
    baseClass: ShipClass.CRUISER,
    faction: 'ALLIANCE',
    description: '동맹군 고속 순양함. 기동성 특화',
  },
];

/**
 * 전투기/전투정 스펙
 */
export interface FighterSpec {
  id: string;
  name: string;
  nameJp: string;
  nameEn: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  type: 'FIGHTER' | 'TORPEDO_BOAT';
  
  attack: number;
  defense: number;
  speed: number;
  range: number;
  
  abilities: string[];
}

/**
 * 전투정 스펙 정의
 */
export const FIGHTER_SPECS: FighterSpec[] = [
  // 제국군 전투정
  {
    id: 'EMPIRE_FIGHTER_WALKÜRE',
    name: '발큐레',
    nameJp: 'ワルキューレ',
    nameEn: 'Walküre',
    faction: 'EMPIRE',
    type: 'FIGHTER',
    attack: 15,
    defense: 5,
    speed: 45000,
    range: 50,
    abilities: ['INTERCEPTOR', 'DOGFIGHT'],
  },
  // 제국군 뇌격정
  {
    id: 'EMPIRE_TORPEDO_BOAT',
    name: '뇌격정',
    nameJp: '雷撃艇',
    nameEn: 'Torpedo Boat',
    faction: 'EMPIRE',
    type: 'TORPEDO_BOAT',
    attack: 40,
    defense: 3,
    speed: 35000,
    range: 80,
    abilities: ['TORPEDO_STRIKE', 'ANTI_CAPITAL'],
  },
  // 동맹군 전투정
  {
    id: 'ALLIANCE_FIGHTER_SPARTANIAN',
    name: '스파르타니안',
    nameJp: 'スパルタニアン',
    nameEn: 'Spartanian',
    faction: 'ALLIANCE',
    type: 'FIGHTER',
    attack: 18,
    defense: 4,
    speed: 48000,
    range: 45,
    abilities: ['INTERCEPTOR', 'DOGFIGHT', 'MULTI_ROLE'],
  },
];

/**
 * ShipSpec을 DetailedShipSpec으로 변환
 */
function convertToDetailedSpec(
  spec: ShipSpec,
  id: string,
  abilities: string[] = []
): DetailedShipSpec {
  const attack = spec.beamPower + spec.gunPower + spec.missilePower + spec.aaPower;
  const defense = Math.floor((spec.frontArmor + spec.sideArmor + spec.rearArmor) / 3);
  
  // 건조 비용 계산 (건조 공기 * 기본 계수)
  const baseCost = spec.buildTime * 1000;
  const materialCost = spec.repairMaterialPerShip * 10;
  
  return {
    id,
    name: spec.nameKo,
    nameJp: spec.nameJp,
    nameEn: spec.nameEn,
    faction: spec.faction,
    class: spec.class,
    variant: spec.variant,
    attack,
    defense,
    speed: spec.maxSpeed,
    crewCapacity: spec.crewRequired,
    cargoCapacity: spec.cargoCapacity,
    fighterCapacity: spec.fighterCapacity,
    troopCapacity: spec.troopCapacity,
    buildTime: spec.buildTime,
    buildCost: {
      credits: baseCost,
      materials: materialCost,
    },
    abilities,
    detailedStats: {
      power: spec.power,
      sensorRange: spec.sensorRange,
      frontArmor: spec.frontArmor,
      sideArmor: spec.sideArmor,
      rearArmor: spec.rearArmor,
      shieldProtection: spec.shieldProtection,
      shieldCapacity: spec.shieldCapacity,
      beamPower: spec.beamPower,
      gunPower: spec.gunPower,
      missilePower: spec.missilePower,
      aaPower: spec.aaPower,
      repairMaterial: spec.repairMaterialPerShip,
    },
  };
}

/**
 * 함선 타입별 특수 능력 정의
 */
const SHIP_ABILITIES: Partial<Record<ShipClass, string[]>> = {
  [ShipClass.BATTLESHIP]: ['FLAGSHIP_CAPABLE', 'HEAVY_BOMBARDMENT', 'LINE_FORMATION'],
  [ShipClass.FAST_BATTLESHIP]: ['FLAGSHIP_CAPABLE', 'HIGH_SPEED_PURSUIT', 'FLANKING_MANEUVER'],
  [ShipClass.CRUISER]: ['ESCORT', 'PATROL', 'MISSILE_BARRAGE'],
  [ShipClass.STRIKE_CRUISER]: ['ASSAULT', 'HEAVY_MISSILE', 'BREAKTHROUGH'],
  [ShipClass.DESTROYER]: ['SCREENING', 'TORPEDO_ATTACK', 'ANTI_FIGHTER'],
  [ShipClass.FIGHTER_CARRIER]: ['LAUNCH_FIGHTERS', 'CAP_PATROL', 'FIGHTER_RECOVERY'],
  [ShipClass.TORPEDO_CARRIER]: ['LAUNCH_TORPEDO_BOATS', 'AMBUSH_STRIKE', 'TORPEDO_BARRAGE'],
  [ShipClass.LANDING_SHIP]: ['PLANETARY_ASSAULT', 'TROOP_DEPLOYMENT', 'BEACH_HEAD'],
  [ShipClass.TRANSPORT]: ['CARGO_TRANSPORT', 'SUPPLY_CHAIN', 'CONVOY'],
  [ShipClass.TROOP_TRANSPORT]: ['MEDICAL_SUPPORT', 'TROOP_RECOVERY', 'HOSPITAL_SHIP'],
  [ShipClass.REPAIR_SHIP]: ['FIELD_REPAIR', 'SALVAGE', 'EMERGENCY_REFIT'],
};

/**
 * 제국군 전함 상세 스펙 (SS75형 I~VIII)
 */
export const EMPIRE_BATTLESHIP_DETAILED: DetailedShipSpec[] = [
  // Type I (기존 데이터 기반)
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['BATTLESHIP_I']!,
    'EMPIRE_BATTLESHIP_I',
    SHIP_ABILITIES[ShipClass.BATTLESHIP]
  ),
  // Type II ~ VIII (스케일링 적용)
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['BATTLESHIP_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_BATTLESHIP_${variant}`,
      name: `전함 ${variant}형`,
      nameJp: `戦艦${variant}`,
      nameEn: `Battleship Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.BATTLESHIP,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.05)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.BATTLESHIP] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 고속전함 상세 스펙
 */
export const EMPIRE_FAST_BATTLESHIP_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['FAST_BATTLESHIP_I']!,
    'EMPIRE_FAST_BATTLESHIP_I',
    SHIP_ABILITIES[ShipClass.FAST_BATTLESHIP]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['FAST_BATTLESHIP_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_FAST_BATTLESHIP_${variant}`,
      name: `고속전함 ${variant}형`,
      nameJp: `高速戦艦${variant}`,
      nameEn: `Fast Battleship Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.FAST_BATTLESHIP,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.06)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.FAST_BATTLESHIP] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 순양함 상세 스펙 (SK80형)
 */
export const EMPIRE_CRUISER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['CRUISER_I']!,
    'EMPIRE_CRUISER_I',
    SHIP_ABILITIES[ShipClass.CRUISER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['CRUISER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_CRUISER_${variant}`,
      name: `순양함 ${variant}형`,
      nameJp: `巡航艦${variant}`,
      nameEn: `Cruiser Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.CRUISER,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.05)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.CRUISER] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 구축함 상세 스펙 (Z82형)
 */
export const EMPIRE_DESTROYER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['DESTROYER_I']!,
    'EMPIRE_DESTROYER_I',
    SHIP_ABILITIES[ShipClass.DESTROYER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['DESTROYER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_DESTROYER_${variant}`,
      name: `구축함 ${variant}형`,
      nameJp: `駆逐艦${variant}`,
      nameEn: `Destroyer Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.DESTROYER,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: Math.min(level, 3),
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.DESTROYER] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 전투정모함 상세 스펙 (FR88형)
 */
export const EMPIRE_FIGHTER_CARRIER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['FIGHTER_CARRIER_I']!,
    'EMPIRE_FIGHTER_CARRIER_I',
    SHIP_ABILITIES[ShipClass.FIGHTER_CARRIER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['FIGHTER_CARRIER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_FIGHTER_CARRIER_${variant}`,
      name: `전투정모함 ${variant}형`,
      nameJp: `戦闘艇母艦${variant}`,
      nameEn: `Fighter Carrier Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.FIGHTER_CARRIER,
      variant,
      attack: Math.floor(baseSpec.aaPower * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: baseSpec.fighterCapacity + Math.floor((level - 1) * 2),
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.FIGHTER_CARRIER] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.08)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: 0,
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 뇌격정모함 상세 스펙 (TR88형) - 제국 전용
 */
export const EMPIRE_TORPEDO_CARRIER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['TORPEDO_CARRIER_I']!,
    'EMPIRE_TORPEDO_CARRIER_I',
    SHIP_ABILITIES[ShipClass.TORPEDO_CARRIER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['TORPEDO_CARRIER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_TORPEDO_CARRIER_${variant}`,
      name: `뇌격정모함 ${variant}형`,
      nameJp: `雷撃艇母艦${variant}`,
      nameEn: `Torpedo Carrier Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.TORPEDO_CARRIER,
      variant,
      attack: Math.floor(baseSpec.aaPower * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: [...(SHIP_ABILITIES[ShipClass.TORPEDO_CARRIER] || []), `TORPEDO_CAPACITY_${8 + (level - 1) * 2}`],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.08)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: 0,
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 공작함 상세 스펙 (A76형)
 */
export const EMPIRE_REPAIR_SHIP_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['REPAIR_SHIP_I']!,
    'EMPIRE_REPAIR_SHIP_I',
    SHIP_ABILITIES[ShipClass.REPAIR_SHIP]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['REPAIR_SHIP_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_REPAIR_SHIP_${variant}`,
      name: `공작함 ${variant}형`,
      nameJp: `工作艦${variant}`,
      nameEn: `Repair Ship Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.REPAIR_SHIP,
      variant,
      attack: Math.floor(baseSpec.aaPower * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.03)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.1)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor * 1.5),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: [...(SHIP_ABILITIES[ShipClass.REPAIR_SHIP] || []), `REPAIR_RATE_${100 + level * 15}`],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.1)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: 0,
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 양륙함 상세 스펙
 */
export const EMPIRE_LANDING_SHIP_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['LANDING_SHIP_I']!,
    'EMPIRE_LANDING_SHIP_I',
    SHIP_ABILITIES[ShipClass.LANDING_SHIP]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['LANDING_SHIP_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_LANDING_SHIP_${variant}`,
      name: `양륙함 ${variant}형`,
      nameJp: `揚陸艦${variant}`,
      nameEn: `Landing Ship Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.LANDING_SHIP,
      variant,
      attack: Math.floor((baseSpec.gunPower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: Math.floor(baseSpec.troopCapacity * (1 + (level - 1) * 0.15)),
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.LANDING_SHIP] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 제국군 수송함 상세 스펙
 */
export const EMPIRE_TRANSPORT_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    EMPIRE_SHIP_SPECS['TRANSPORT_I']!,
    'EMPIRE_TRANSPORT_I',
    SHIP_ABILITIES[ShipClass.TRANSPORT]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = EMPIRE_SHIP_SPECS['TRANSPORT_I']!;
    const scaleFactor = 1 + (level - 1) * 0.15;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `EMPIRE_TRANSPORT_${variant}`,
      name: `수송함 ${variant}형`,
      nameJp: `輸送艦${variant}`,
      nameEn: `Transport Type ${variant}`,
      faction: 'EMPIRE',
      class: ShipClass.TRANSPORT,
      variant,
      attack: Math.floor((baseSpec.gunPower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.03)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.1)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.08)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.TRANSPORT] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 동맹군 전함 상세 스펙 (아킬레우스급/아이아스급)
 */
export const ALLIANCE_BATTLESHIP_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    ALLIANCE_SHIP_SPECS['BATTLESHIP_I']!,
    'ALLIANCE_BATTLESHIP_I',
    [...(SHIP_ABILITIES[ShipClass.BATTLESHIP] || []), 'ACHILLES_CLASS']
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = ALLIANCE_SHIP_SPECS['BATTLESHIP_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    const isAjaxClass = level >= 5;
    
    return {
      id: `ALLIANCE_BATTLESHIP_${variant}`,
      name: isAjaxClass ? `아이아스급 전함 ${variant}형` : `아킬레우스급 전함 ${variant}형`,
      nameJp: isAjaxClass ? `アイアス級戦艦${variant}` : `アキレス級戦艦${variant}`,
      nameEn: isAjaxClass ? `Ajax Class Battleship Type ${variant}` : `Achilles Class Battleship Type ${variant}`,
      faction: 'ALLIANCE',
      class: ShipClass.BATTLESHIP,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor * (isAjaxClass ? 1.1 : 1)),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.05)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: [...(SHIP_ABILITIES[ShipClass.BATTLESHIP] || []), isAjaxClass ? 'AJAX_CLASS' : 'ACHILLES_CLASS'],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor * (isAjaxClass ? 1.1 : 1)),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor * (isAjaxClass ? 1.1 : 1)),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor * (isAjaxClass ? 1.1 : 1)),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 동맹군 순양함 상세 스펙 (파트로클로스급)
 */
export const ALLIANCE_CRUISER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    ALLIANCE_SHIP_SPECS['CRUISER_I']!,
    'ALLIANCE_CRUISER_I',
    [...(SHIP_ABILITIES[ShipClass.CRUISER] || []), 'PATROCLUS_CLASS']
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = ALLIANCE_SHIP_SPECS['CRUISER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `ALLIANCE_CRUISER_${variant}`,
      name: `파트로클로스급 순양함 ${variant}형`,
      nameJp: `パトロクロス級巡航艦${variant}`,
      nameEn: `Patroclus Class Cruiser Type ${variant}`,
      faction: 'ALLIANCE',
      class: ShipClass.CRUISER,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.06)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: [...(SHIP_ABILITIES[ShipClass.CRUISER] || []), 'PATROCLUS_CLASS'],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 동맹군 타격순양함 상세 스펙
 */
export const ALLIANCE_STRIKE_CRUISER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    ALLIANCE_SHIP_SPECS['STRIKE_CRUISER_I']!,
    'ALLIANCE_STRIKE_CRUISER_I',
    SHIP_ABILITIES[ShipClass.STRIKE_CRUISER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = ALLIANCE_SHIP_SPECS['STRIKE_CRUISER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `ALLIANCE_STRIKE_CRUISER_${variant}`,
      name: `타격순양함 ${variant}형`,
      nameJp: `打撃巡航艦${variant}`,
      nameEn: `Strike Cruiser Type ${variant}`,
      faction: 'ALLIANCE',
      class: ShipClass.STRIKE_CRUISER,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.05)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: 0,
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.STRIKE_CRUISER] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: Math.floor(baseSpec.shieldProtection * scaleFactor),
        shieldCapacity: Math.floor(baseSpec.shieldCapacity * scaleFactor),
        beamPower: Math.floor(baseSpec.beamPower * scaleFactor),
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 동맹군 구축함 상세 스펙
 */
export const ALLIANCE_DESTROYER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    ALLIANCE_SHIP_SPECS['DESTROYER_I']!,
    'ALLIANCE_DESTROYER_I',
    SHIP_ABILITIES[ShipClass.DESTROYER]
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = ALLIANCE_SHIP_SPECS['DESTROYER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `ALLIANCE_DESTROYER_${variant}`,
      name: `구축함 ${variant}형`,
      nameJp: `駆逐艦${variant}`,
      nameEn: `Destroyer Type ${variant}`,
      faction: 'ALLIANCE',
      class: ShipClass.DESTROYER,
      variant,
      attack: Math.floor((baseSpec.beamPower + baseSpec.gunPower + baseSpec.missilePower + baseSpec.aaPower) * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: Math.min(level, 3),
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: SHIP_ABILITIES[ShipClass.DESTROYER] || [],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.05)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: Math.floor(baseSpec.gunPower * scaleFactor),
        missilePower: Math.floor(baseSpec.missilePower * scaleFactor),
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 동맹군 전투정모함 상세 스펙
 */
export const ALLIANCE_FIGHTER_CARRIER_DETAILED: DetailedShipSpec[] = [
  convertToDetailedSpec(
    ALLIANCE_SHIP_SPECS['FIGHTER_CARRIER_I']!,
    'ALLIANCE_FIGHTER_CARRIER_I',
    [...(SHIP_ABILITIES[ShipClass.FIGHTER_CARRIER] || []), 'SPARTANIAN_CARRIER']
  ),
  ...[2, 3, 4, 5, 6, 7, 8].map((level): DetailedShipSpec => {
    const baseSpec = ALLIANCE_SHIP_SPECS['FIGHTER_CARRIER_I']!;
    const scaleFactor = 1 + (level - 1) * 0.12;
    const variant = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][level - 1] as ShipVariant;
    
    return {
      id: `ALLIANCE_FIGHTER_CARRIER_${variant}`,
      name: `전투정모함 ${variant}형`,
      nameJp: `戦闘艇母艦${variant}`,
      nameEn: `Fighter Carrier Type ${variant}`,
      faction: 'ALLIANCE',
      class: ShipClass.FIGHTER_CARRIER,
      variant,
      attack: Math.floor(baseSpec.aaPower * scaleFactor),
      defense: Math.floor(((baseSpec.frontArmor + baseSpec.sideArmor + baseSpec.rearArmor) / 3) * scaleFactor),
      speed: Math.floor(baseSpec.maxSpeed * (1 + (level - 1) * 0.04)),
      crewCapacity: Math.floor(baseSpec.crewRequired * (1 + (level - 1) * 0.08)),
      cargoCapacity: Math.floor(baseSpec.cargoCapacity * scaleFactor),
      fighterCapacity: baseSpec.fighterCapacity + Math.floor((level - 1) * 2),
      troopCapacity: 0,
      buildTime: Math.floor(baseSpec.buildTime * (1 + (level - 1) * 0.1)),
      buildCost: {
        credits: Math.floor(baseSpec.buildTime * 1000 * scaleFactor),
        materials: Math.floor(baseSpec.repairMaterialPerShip * 10 * scaleFactor),
      },
      abilities: [...(SHIP_ABILITIES[ShipClass.FIGHTER_CARRIER] || []), 'SPARTANIAN_CARRIER'],
      detailedStats: {
        power: Math.floor(baseSpec.power * scaleFactor),
        sensorRange: Math.floor(baseSpec.sensorRange * (1 + (level - 1) * 0.08)),
        frontArmor: Math.floor(baseSpec.frontArmor * scaleFactor),
        sideArmor: Math.floor(baseSpec.sideArmor * scaleFactor),
        rearArmor: Math.floor(baseSpec.rearArmor * scaleFactor),
        shieldProtection: 0,
        shieldCapacity: 0,
        beamPower: 0,
        gunPower: 0,
        missilePower: 0,
        aaPower: Math.floor(baseSpec.aaPower * scaleFactor),
        repairMaterial: Math.floor(baseSpec.repairMaterialPerShip * scaleFactor),
      },
    };
  }),
];

/**
 * 모든 제국군 함선 스펙
 */
export const ALL_EMPIRE_SHIPS: DetailedShipSpec[] = [
  ...EMPIRE_BATTLESHIP_DETAILED,
  ...EMPIRE_FAST_BATTLESHIP_DETAILED,
  ...EMPIRE_CRUISER_DETAILED,
  ...EMPIRE_DESTROYER_DETAILED,
  ...EMPIRE_FIGHTER_CARRIER_DETAILED,
  ...EMPIRE_TORPEDO_CARRIER_DETAILED,
  ...EMPIRE_REPAIR_SHIP_DETAILED,
  ...EMPIRE_LANDING_SHIP_DETAILED,
  ...EMPIRE_TRANSPORT_DETAILED,
];

/**
 * 모든 동맹군 함선 스펙
 */
export const ALL_ALLIANCE_SHIPS: DetailedShipSpec[] = [
  ...ALLIANCE_BATTLESHIP_DETAILED,
  ...ALLIANCE_CRUISER_DETAILED,
  ...ALLIANCE_STRIKE_CRUISER_DETAILED,
  ...ALLIANCE_DESTROYER_DETAILED,
  ...ALLIANCE_FIGHTER_CARRIER_DETAILED,
];

/**
 * 모든 함선 스펙 (통합)
 */
export const ALL_SHIPS: DetailedShipSpec[] = [
  ...ALL_EMPIRE_SHIPS,
  ...ALL_ALLIANCE_SHIPS,
];

/**
 * ID로 함선 스펙 조회
 */
export function getDetailedShipSpecById(id: string): DetailedShipSpec | undefined {
  return ALL_SHIPS.find(ship => ship.id === id);
}

/**
 * 세력 및 클래스로 함선 스펙 목록 조회
 */
export function getDetailedShipSpecsByFactionAndClass(
  faction: 'EMPIRE' | 'ALLIANCE',
  shipClass: ShipClass
): DetailedShipSpec[] {
  return ALL_SHIPS.filter(
    ship => ship.faction === faction && ship.class === shipClass
  );
}

/**
 * 특정 능력을 가진 함선 조회
 */
export function getShipsWithAbility(ability: string): DetailedShipSpec[] {
  return ALL_SHIPS.filter(ship => ship.abilities.includes(ability));
}





