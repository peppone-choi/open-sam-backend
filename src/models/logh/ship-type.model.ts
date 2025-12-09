/**
 * LOGH Ship Types - 은하영웅전설 함선 정의
 * 
 * 데이터 출처: Sins of a Solar Empire 2 - Gineiden Mod v1.85
 * 1 유닛 = 300척
 */

export type ShipFaction = 'empire' | 'alliance' | 'fezzan' | 'neutral';
export type ShipClass = 'battleship' | 'battleship_fast' | 'cruiser' | 'destroyer' | 
                        'carrier' | 'flagship' | 'fighter' | 'landing' | 'scout' | 
                        'minelayer' | 'minesweeper' | 'transport' | 'resupply';

export interface ShipType {
  id: string;
  name: string;        // 영문명
  nameKo: string;      // 한국어명
  faction: ShipFaction;
  class: ShipClass;
  mesh: string;        // 3D 모델명
  commander?: string;  // 지휘관 (기함 전용)
}

// =========================================================
// 제국군 (Galactic Empire)
// =========================================================
export const EMPIRE_SHIPS: ShipType[] = [
  // 표준 함선
  { id: 'emp_bb', name: 'Empire Battleship', nameKo: '제국군 전함', faction: 'empire', class: 'battleship', mesh: 'empire_battleship' },
  { id: 'emp_bb_fast', name: 'Empire Fast Battleship', nameKo: '제국군 고속전함', faction: 'empire', class: 'battleship_fast', mesh: 'empire_battleship_fast' },
  { id: 'emp_bb_lancer', name: 'Empire Lancer Battleship', nameKo: '제국군 창기병전함', faction: 'empire', class: 'battleship_fast', mesh: 'GE_Battleship_Lancer' },
  { id: 'emp_ca', name: 'Empire Cruiser', nameKo: '제국군 순양함', faction: 'empire', class: 'cruiser', mesh: 'empire_cruiser' },
  { id: 'emp_dd', name: 'Empire Destroyer', nameKo: '제국군 구축함', faction: 'empire', class: 'destroyer', mesh: 'empire_destroyer' },
  { id: 'emp_cv', name: 'Empire Carrier', nameKo: '제국군 항공모함', faction: 'empire', class: 'carrier', mesh: 'empire_carrier' },
  { id: 'emp_cv_s', name: 'Empire Small Carrier', nameKo: '제국군 경항모', faction: 'empire', class: 'carrier', mesh: 'GE_SCarrier' },
  { id: 'emp_cv_g', name: 'Empire Large Carrier', nameKo: '제국군 대형항모', faction: 'empire', class: 'carrier', mesh: 'GE_GCarrier' },
  { id: 'emp_landing', name: 'Empire Landing Ship', nameKo: '제국군 양륙함', faction: 'empire', class: 'landing', mesh: 'empire_transport' },
  { id: 'emp_scout', name: 'Empire Scout', nameKo: '제국군 정찰함', faction: 'empire', class: 'scout', mesh: 'ge_scout' },
  { id: 'emp_minelayer', name: 'Empire Minelayer', nameKo: '제국군 기뢰부설함', faction: 'empire', class: 'minelayer', mesh: 'GE_MineLayer' },
  { id: 'emp_minesweeper', name: 'Empire Minesweeper', nameKo: '제국군 소해함', faction: 'empire', class: 'minesweeper', mesh: 'GE_Minesweeper' },
  
  // 전투기
  { id: 'emp_valkyrie', name: 'Valkyrie', nameKo: '발퀴레', faction: 'empire', class: 'fighter', mesh: 'empire_walkure' },
  
  // 기함 (Flagships)
  { id: 'emp_brunhild', name: 'Brunhild', nameKo: '브륀힐트', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_BrunhildUpgrade', commander: '라인하르트 폰 로엔그람' },
  { id: 'emp_barbarossa', name: 'Barbarossa', nameKo: '바르바로사', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Barbarossa', commander: '지크프리트 키르히아이스' },
  { id: 'emp_tristan', name: 'Tristan', nameKo: '트리스탄', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Tristan', commander: '오스카 폰 로이엔탈' },
  { id: 'emp_konigstiger', name: 'Königstiger', nameKo: '쾨니히스티거', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_KonigsTiger', commander: '볼프강 미터마이어' },
  { id: 'emp_beowulf', name: 'Beowulf', nameKo: '베오울프', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Beowulf', commander: '프리츠 요제프 비텐펠트' },
  { id: 'emp_jotunheim', name: 'Jötunheim', nameKo: '요툰하임', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Jotunheim', commander: '어니스트 메클링거' },
  { id: 'emp_nordlingen', name: 'Nördlingen', nameKo: '뇌르틀링겐', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Nordlingen', commander: '어거스트 자무엘 바렌' },
  { id: 'emp_forkel', name: 'Forkel', nameKo: '포르켈', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Vonkel', commander: '나이트하르트 뮐러' },
  { id: 'emp_wilhelmina', name: 'Wilhelmina', nameKo: '빌헬미나', faction: 'empire', class: 'flagship', mesh: 'GE_CommandShip_Wilhelmina' },
];

// =========================================================
// 자유행성동맹군 (Free Planets Alliance)
// =========================================================
export const ALLIANCE_SHIPS: ShipType[] = [
  // 표준 함선
  { id: 'all_bb', name: 'FPA Battleship', nameKo: '동맹군 전함', faction: 'alliance', class: 'battleship', mesh: 'fpa_battleship' },
  { id: 'all_bb_ulysses', name: 'Ulysses-class Battleship', nameKo: '율리시즈급 전함', faction: 'alliance', class: 'battleship', mesh: 'FPA_Battleship_Ulysses' },
  { id: 'all_ca', name: 'FPA Cruiser', nameKo: '동맹군 순양함', faction: 'alliance', class: 'cruiser', mesh: 'fpa_cruiser' },
  { id: 'all_dd', name: 'FPA Destroyer', nameKo: '동맹군 구축함', faction: 'alliance', class: 'destroyer', mesh: 'fpa_destroyer' },
  { id: 'all_cv', name: 'FPA Carrier', nameKo: '동맹군 항공모함', faction: 'alliance', class: 'carrier', mesh: 'fpa_carrier' },
  { id: 'all_landing', name: 'FPA Landing Ship', nameKo: '동맹군 양륙함', faction: 'alliance', class: 'landing', mesh: 'fpa_transport' },
  { id: 'all_scout', name: 'FPA Scout', nameKo: '동맹군 정찰함', faction: 'alliance', class: 'scout', mesh: 'fpa_scout' },
  { id: 'all_minelayer', name: 'FPA Minelayer', nameKo: '동맹군 기뢰부설함', faction: 'alliance', class: 'minelayer', mesh: 'FPA_MineLayer' },
  { id: 'all_lycus', name: 'Lycus', nameKo: '리커스', faction: 'alliance', class: 'cruiser', mesh: 'fpa_lycus' },
  
  // 전투기
  { id: 'all_spartanian', name: 'Spartanian', nameKo: '스파르타니안', faction: 'alliance', class: 'fighter', mesh: 'fpa_spartanian' },
  
  // 기함 (Flagships)
  { id: 'all_hyperion', name: 'Hyperion', nameKo: '히페리온', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Hyperion', commander: '양 웬리' },
  { id: 'all_triglav', name: 'Triglav', nameKo: '트리그라프', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Triglav', commander: '더스티 아텐보로' },
  { id: 'all_krishna', name: 'Krishna', nameKo: '크리슈나', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Krishna', commander: '아렉산드르 뷰코크' },
  { id: 'all_riogrande', name: 'Rio Grande', nameKo: '리오그란데', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_RioGrande', commander: '우란프' },
  { id: 'all_perun', name: 'Perun', nameKo: '페룬', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Perun' },
  { id: 'all_palamedes', name: 'Palamedes', nameKo: '팔라메데스', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Palamedes', commander: '에드윈 피셔' },
  { id: 'all_airgetlamh', name: 'Airget Lamh', nameKo: '아르게트 람', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_AirgetLamh' },
  { id: 'all_banggoo', name: 'Bang-goo', nameKo: '방구', faction: 'alliance', class: 'flagship', mesh: 'FPA_Commandship_Bang-goo' },
  { id: 'all_cuchulainn', name: 'Cú Chulainn', nameKo: '쿠 훌린', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_CuChulainn' },
  { id: 'all_hector', name: 'Hector', nameKo: '헥토르', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Hector' },
  { id: 'all_leonidas', name: 'Leonidas', nameKo: '레오니다스', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Leonidas', commander: '알렉산드르 비롤라이넨' },
  { id: 'all_patroklos', name: 'Patroklos', nameKo: '파트로클로스', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Patroklos', commander: '월터 폰 쇤코프' },
  { id: 'all_shiva', name: 'Shiva', nameKo: '시바', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Shiva' },
  { id: 'all_epimetheus', name: 'Epimetheus', nameKo: '에피메테우스', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Epimetheus' },
  { id: 'all_pergamon', name: 'Pergamon', nameKo: '페르가몬', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_Pergamon' },
  { id: 'all_abaigeser', name: 'Abai Geser', nameKo: '아바이 게세르', faction: 'alliance', class: 'flagship', mesh: 'FPA_CommandShip_AbaiGeser' },
];

// =========================================================
// 특수 시설
// =========================================================
export const SPECIAL_STRUCTURES: ShipType[] = [
  { id: 'iserlohn', name: 'Iserlohn Fortress', nameKo: '이제를론 요새', faction: 'empire', class: 'flagship', mesh: 'iserlohn' },
];

// =========================================================
// 통합 데이터
// =========================================================
export const ALL_SHIPS: ShipType[] = [
  ...EMPIRE_SHIPS,
  ...ALLIANCE_SHIPS,
  ...SPECIAL_STRUCTURES,
];

// 유틸리티 함수
export const getShipById = (id: string): ShipType | undefined => 
  ALL_SHIPS.find(ship => ship.id === id);

export const getShipsByFaction = (faction: ShipFaction): ShipType[] => 
  ALL_SHIPS.filter(ship => ship.faction === faction);

export const getShipsByClass = (shipClass: ShipClass): ShipType[] => 
  ALL_SHIPS.filter(ship => ship.class === shipClass);

export const getFlagships = (faction?: ShipFaction): ShipType[] => 
  ALL_SHIPS.filter(ship => ship.class === 'flagship' && (!faction || ship.faction === faction));

// 함선 스탯 인터페이스
export interface ShipStats {
  attack: number;
  defense: number;
  speed: number;
  range: number;
  capacity: number;
  cost: number;
}

// 함선 타입별 스탯 (기본값 - 실제 값은 별도 데이터로 관리)
export const SHIP_TYPES: Record<string, ShipStats> = ALL_SHIPS.reduce((acc, ship) => {
  // 기본 스탯 (클래스 기반)
  const classStats: Record<ShipClass, ShipStats> = {
    battleship: { attack: 100, defense: 80, speed: 40, range: 3, capacity: 0, cost: 1000 },
    battleship_fast: { attack: 90, defense: 70, speed: 60, range: 3, capacity: 0, cost: 1200 },
    cruiser: { attack: 60, defense: 50, speed: 50, range: 2, capacity: 0, cost: 600 },
    destroyer: { attack: 40, defense: 30, speed: 70, range: 2, capacity: 0, cost: 400 },
    carrier: { attack: 30, defense: 60, speed: 35, range: 4, capacity: 12, cost: 1500 },
    flagship: { attack: 150, defense: 120, speed: 45, range: 4, capacity: 0, cost: 5000 },
    fighter: { attack: 20, defense: 10, speed: 100, range: 1, capacity: 0, cost: 50 },
    landing: { attack: 10, defense: 40, speed: 30, range: 1, capacity: 3000, cost: 800 },
    scout: { attack: 20, defense: 20, speed: 90, range: 5, capacity: 0, cost: 300 },
    minelayer: { attack: 30, defense: 35, speed: 40, range: 2, capacity: 100, cost: 500 },
    minesweeper: { attack: 25, defense: 35, speed: 50, range: 2, capacity: 0, cost: 450 },
    transport: { attack: 5, defense: 30, speed: 35, range: 1, capacity: 5000, cost: 600 },
    resupply: { attack: 5, defense: 25, speed: 35, range: 1, capacity: 2000, cost: 700 },
  };
  acc[ship.id] = classStats[ship.class];
  return acc;
}, {} as Record<string, ShipStats>);
