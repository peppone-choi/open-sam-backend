/**
 * 자동 생산 품목 정의 (Auto Production Definitions)
 * 매뉴얼 6012~7520행 기반
 *
 * 각 행성별로 자동 생산되는 함선 유닛, 승조원, 육전대 타입을 정의합니다.
 */

/**
 * 자동 생산 품목 인터페이스
 */
export interface AutoProductionItem {
  planetId: string;
  planetName: string;
  systemId: string;
  faction: 'IMPERIAL' | 'ALLIANCE';
  shipUnits: ShipProductionItem[];
  crewUnits: CrewProductionItem[];
  groundUnits: GroundProductionItem[];
}

export interface ShipProductionItem {
  shipTypeId: string;
  shipTypeName: string;
  dailyProduction: number; // 게임 일당 생산량 (0.1 = 10일에 1유닛)
}

export interface CrewProductionItem {
  crewTypeId: string;
  crewTypeName: string;
  dailyProduction: number;
}

export interface GroundProductionItem {
  unitTypeId: string;
  unitTypeName: string;
  dailyProduction: number;
}

/**
 * 제국군 자동 생산 정의
 */
export const IMPERIAL_AUTO_PRODUCTION: AutoProductionItem[] = [
  // 오딘 (수도)
  {
    planetId: 'ODIN',
    planetName: '오딘',
    systemId: 'VALHALLA',
    faction: 'IMPERIAL',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_I', shipTypeName: '전함Ⅰ', dailyProduction: 0.1 },
      { shipTypeId: 'FAST_BATTLESHIP_I', shipTypeName: '고속전함Ⅰ', dailyProduction: 0.08 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.12 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.15 },
      { shipTypeId: 'FAST_BATTLESHIP_II', shipTypeName: '고속전함Ⅱ', dailyProduction: 0.05 },
      { shipTypeId: 'FIGHTER_CARRIER_I', shipTypeName: '전투정모함Ⅰ', dailyProduction: 0.03 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 5 }],
    groundUnits: [{ unitTypeId: 'GRENADIER', unitTypeName: '장갑척탄병', dailyProduction: 0.5 }],
  },
  // 가이에스부르크 요새
  {
    planetId: 'GEIERSBURG',
    planetName: '가이에스부르크',
    systemId: 'EISENHERZ',
    faction: 'IMPERIAL',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_I', shipTypeName: '전함Ⅰ', dailyProduction: 0.15 },
      { shipTypeId: 'FAST_BATTLESHIP_I', shipTypeName: '고속전함Ⅰ', dailyProduction: 0.1 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.15 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.2 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 6 }],
    groundUnits: [
      { unitTypeId: 'ARMORED', unitTypeName: '장갑병', dailyProduction: 0.3 },
      { unitTypeId: 'GRENADIER', unitTypeName: '장갑척탄병', dailyProduction: 0.2 },
    ],
  },
  // 이제를론 요새
  {
    planetId: 'ISERLOHN',
    planetName: '이제를론',
    systemId: 'ISERLOHN_SYSTEM',
    faction: 'IMPERIAL',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_I', shipTypeName: '전함Ⅰ', dailyProduction: 0.12 },
      { shipTypeId: 'FAST_BATTLESHIP_V', shipTypeName: '고속전함Ⅴ', dailyProduction: 0.08 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.15 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.2 },
      { shipTypeId: 'TORPEDO_CARRIER_IV', shipTypeName: '뇌격정모함Ⅳ', dailyProduction: 0.05 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 5 }],
    groundUnits: [{ unitTypeId: 'GRENADIER', unitTypeName: '장갑척탄병', dailyProduction: 0.4 }],
  },
  // 아므리짜
  {
    planetId: 'HAFEN',
    planetName: '하펜',
    systemId: 'AMRITSAR',
    faction: 'IMPERIAL',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_I', shipTypeName: '전함Ⅰ', dailyProduction: 0.08 },
      { shipTypeId: 'FAST_BATTLESHIP_I', shipTypeName: '고속전함Ⅰ', dailyProduction: 0.06 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.1 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.15 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 4 }],
    groundUnits: [{ unitTypeId: 'LIGHT_TROOP', unitTypeName: '경장육전병', dailyProduction: 0.5 }],
  },
  // 추가 제국 행성들...
];

/**
 * 동맹군 자동 생산 정의
 */
export const ALLIANCE_AUTO_PRODUCTION: AutoProductionItem[] = [
  // 하이네센 (수도)
  {
    planetId: 'HEINESSEN',
    planetName: '하이네센',
    systemId: 'BAALAT',
    faction: 'ALLIANCE',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_VII', shipTypeName: '전함Ⅶ', dailyProduction: 0.1 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.12 },
      { shipTypeId: 'ATTACK_CRUISER_I', shipTypeName: '타격순항함Ⅰ', dailyProduction: 0.08 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.15 },
      { shipTypeId: 'FIGHTER_CARRIER_I', shipTypeName: '전투정모함Ⅰ', dailyProduction: 0.05 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 6 }],
    groundUnits: [
      { unitTypeId: 'GRENADIER', unitTypeName: '장갑척탄병', dailyProduction: 0.4 },
      { unitTypeId: 'ARMORED', unitTypeName: '장갑병', dailyProduction: 0.3 },
    ],
  },
  // 발미
  {
    planetId: 'VALMY',
    planetName: '발미',
    systemId: 'LUKAS',
    faction: 'ALLIANCE',
    shipUnits: [
      { shipTypeId: 'BATTLESHIP_I', shipTypeName: '전함Ⅰ', dailyProduction: 0.08 },
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.1 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.12 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 4 }],
    groundUnits: [{ unitTypeId: 'LIGHT_TROOP', unitTypeName: '경장육전병', dailyProduction: 0.4 }],
  },
  // 엘 파실
  {
    planetId: 'SANTA_ANA',
    planetName: '산타 아나',
    systemId: 'EL_FACIL',
    faction: 'ALLIANCE',
    shipUnits: [
      { shipTypeId: 'CRUISER_I', shipTypeName: '순항함Ⅰ', dailyProduction: 0.08 },
      { shipTypeId: 'DESTROYER_I', shipTypeName: '구축함Ⅰ', dailyProduction: 0.1 },
    ],
    crewUnits: [{ crewTypeId: 'FLEET_CREW', crewTypeName: '함대승조원', dailyProduction: 3 }],
    groundUnits: [{ unitTypeId: 'LIGHT_TROOP', unitTypeName: '경장육전병', dailyProduction: 0.3 }],
  },
  // 추가 동맹 행성들...
];

/**
 * 전체 자동 생산 정의 맵
 */
export const ALL_AUTO_PRODUCTION = new Map<string, AutoProductionItem>();

// 제국군 행성 등록
for (const item of IMPERIAL_AUTO_PRODUCTION) {
  ALL_AUTO_PRODUCTION.set(item.planetId, item);
}

// 동맹군 행성 등록
for (const item of ALLIANCE_AUTO_PRODUCTION) {
  ALL_AUTO_PRODUCTION.set(item.planetId, item);
}

/**
 * 행성 ID로 자동 생산 정의 조회
 */
export const getAutoProductionDef = (planetId: string): AutoProductionItem | undefined => {
  return ALL_AUTO_PRODUCTION.get(planetId);
};

/**
 * 진영별 자동 생산 정의 목록 조회
 */
export const getAutoProductionByFaction = (
  faction: 'IMPERIAL' | 'ALLIANCE',
): AutoProductionItem[] => {
  return faction === 'IMPERIAL' ? IMPERIAL_AUTO_PRODUCTION : ALLIANCE_AUTO_PRODUCTION;
};





