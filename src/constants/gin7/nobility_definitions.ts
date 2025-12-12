/**
 * 귀족/작위 시스템 정의 (Nobility System Definitions)
 * 매뉴얼 5229~5298행 기반
 */

/**
 * 작위 코드 (제국군 전용)
 */
export enum TitleCode {
  // 귀족 작위 (높은 순)
  HERZOG = 'HERZOG',           // 공작 (Duke)
  MARQUIS = 'MARQUIS',         // 후작 (Marquis)
  GRAF = 'GRAF',               // 백작 (Count)
  VISCOUNT = 'VISCOUNT',       // 자작 (Viscount)
  BARON = 'BARON',             // 남작 (Baron)
  RITTER = 'RITTER',           // 기사 (Knight)
  // 비귀족
  COMMONER = 'COMMONER',       // 평민
}

/**
 * 작위 정의 인터페이스
 */
export interface TitleDefinition {
  code: TitleCode;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  tier: number;                  // 서열 (1이 최고)
  ladderBonus: number;           // 계급 래더 가산점
  canOwnFief: boolean;           // 봉토 소유 가능 여부
  requiredPreviousTitle: TitleCode | null;  // 서작 시 필요한 하위 작위
  privilegeFlags: string[];      // 특권 플래그
}

/**
 * 작위 정의 테이블
 */
export const TITLE_DEFINITIONS: Record<TitleCode, TitleDefinition> = {
  [TitleCode.HERZOG]: {
    code: TitleCode.HERZOG,
    nameKo: '공작',
    nameJp: '公爵',
    nameEn: 'Duke',
    tier: 1,
    ladderBonus: 500,
    canOwnFief: true,
    requiredPreviousTitle: TitleCode.MARQUIS,
    privilegeFlags: ['IMPERIAL_COUNCIL_SEAT', 'MILITARY_COMMAND', 'FIEF_MULTIPLE'],
  },
  [TitleCode.MARQUIS]: {
    code: TitleCode.MARQUIS,
    nameKo: '후작',
    nameJp: '侯爵',
    nameEn: 'Marquis',
    tier: 2,
    ladderBonus: 400,
    canOwnFief: true,
    requiredPreviousTitle: TitleCode.GRAF,
    privilegeFlags: ['IMPERIAL_AUDIENCE', 'MILITARY_COMMAND', 'FIEF_LARGE'],
  },
  [TitleCode.GRAF]: {
    code: TitleCode.GRAF,
    nameKo: '백작',
    nameJp: '伯爵',
    nameEn: 'Count',
    tier: 3,
    ladderBonus: 300,
    canOwnFief: true,
    requiredPreviousTitle: TitleCode.VISCOUNT,
    privilegeFlags: ['IMPERIAL_AUDIENCE', 'FIEF_MEDIUM'],
  },
  [TitleCode.VISCOUNT]: {
    code: TitleCode.VISCOUNT,
    nameKo: '자작',
    nameJp: '子爵',
    nameEn: 'Viscount',
    tier: 4,
    ladderBonus: 200,
    canOwnFief: true,
    requiredPreviousTitle: TitleCode.BARON,
    privilegeFlags: ['FIEF_SMALL'],
  },
  [TitleCode.BARON]: {
    code: TitleCode.BARON,
    nameKo: '남작',
    nameJp: '男爵',
    nameEn: 'Baron',
    tier: 5,
    ladderBonus: 100,
    canOwnFief: true,
    requiredPreviousTitle: TitleCode.RITTER,
    privilegeFlags: ['FIEF_TINY'],
  },
  [TitleCode.RITTER]: {
    code: TitleCode.RITTER,
    nameKo: '기사',
    nameJp: '騎士',
    nameEn: 'Knight',
    tier: 6,
    ladderBonus: 50,
    canOwnFief: false,
    requiredPreviousTitle: TitleCode.COMMONER,
    privilegeFlags: ['NOBLE_STATUS'],
  },
  [TitleCode.COMMONER]: {
    code: TitleCode.COMMONER,
    nameKo: '평민',
    nameJp: '平民',
    nameEn: 'Commoner',
    tier: 99,
    ladderBonus: 0,
    canOwnFief: false,
    requiredPreviousTitle: null,
    privilegeFlags: [],
  },
};

/**
 * 훈장 코드
 */
export enum MedalCode {
  // 제국군 훈장 (높은 순)
  SCHWERTSTERN_KREUZ = 'SCHWERTSTERN_KREUZ',     // 검성십자훈장 (원수급)
  GOLDENE_LORBEER = 'GOLDENE_LORBEER',           // 황금유엽검훈장 (상급대장급)
  KRIEGSVERDIENSTORDEN = 'KRIEGSVERDIENSTORDEN', // 무공장 (대장~중장급)
  FELDZUGSORDEN = 'FELDZUGSORDEN',               // 전역훈장 (소장~대좌급)
  
  // 동맹군 훈장 (높은 순)
  ALLIANCE_VALOR = 'ALLIANCE_VALOR',             // 동맹무공훈장 (최고)
  GALACTIC_CAMPAIGN = 'GALACTIC_CAMPAIGN',       // 은하전역공로훈장 (상급)
  COMBAT_MERIT = 'COMBAT_MERIT',                 // 전공장 (중급)
}

/**
 * 훈장 정의 인터페이스
 */
export interface MedalDefinition {
  code: MedalCode;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'BOTH';
  tier: number;                  // 서열 (1이 최고)
  ladderBonus: number;           // 계급 래더 가산점
  minRank: string;               // 최소 계급
  maxRank: string;               // 최대 계급
  description: string;
}

/**
 * 훈장 정의 테이블
 */
export const MEDAL_DEFINITIONS: Record<MedalCode, MedalDefinition> = {
  // 제국군 훈장
  [MedalCode.SCHWERTSTERN_KREUZ]: {
    code: MedalCode.SCHWERTSTERN_KREUZ,
    nameKo: '검성십자훈장',
    nameJp: '剣星十字勲章',
    nameEn: 'Sword Star Cross',
    faction: 'EMPIRE',
    tier: 1,
    ladderBonus: 100,
    minRank: 'MARSHAL',
    maxRank: 'MARSHAL',
    description: '제국 최고의 무공 훈장. 원수급에게만 수여된다.',
  },
  [MedalCode.GOLDENE_LORBEER]: {
    code: MedalCode.GOLDENE_LORBEER,
    nameKo: '황금유엽검훈장',
    nameJp: '黄金柳葉剣勲章',
    nameEn: 'Golden Laurel Sword',
    faction: 'EMPIRE',
    tier: 2,
    ladderBonus: 75,
    minRank: 'SENIOR_ADMIRAL',
    maxRank: 'MARSHAL',
    description: '뛰어난 전과를 세운 상급대장급 이상에게 수여.',
  },
  [MedalCode.KRIEGSVERDIENSTORDEN]: {
    code: MedalCode.KRIEGSVERDIENSTORDEN,
    nameKo: '무공장',
    nameJp: '武功章',
    nameEn: 'War Merit Order',
    faction: 'EMPIRE',
    tier: 3,
    ladderBonus: 50,
    minRank: 'VICE_ADMIRAL',
    maxRank: 'ADMIRAL',
    description: '대장~중장급에게 수여되는 무공 훈장.',
  },
  [MedalCode.FELDZUGSORDEN]: {
    code: MedalCode.FELDZUGSORDEN,
    nameKo: '전역훈장',
    nameJp: '戦役勲章',
    nameEn: 'Campaign Order',
    faction: 'EMPIRE',
    tier: 4,
    ladderBonus: 25,
    minRank: 'COLONEL',
    maxRank: 'REAR_ADMIRAL',
    description: '소장~대좌급에게 수여되는 전역 참가 훈장.',
  },
  
  // 동맹군 훈장
  [MedalCode.ALLIANCE_VALOR]: {
    code: MedalCode.ALLIANCE_VALOR,
    nameKo: '동맹무공훈장',
    nameJp: '同盟武功勲章',
    nameEn: 'Alliance Medal of Valor',
    faction: 'ALLIANCE',
    tier: 1,
    ladderBonus: 100,
    minRank: 'MARSHAL',
    maxRank: 'MARSHAL',
    description: '동맹 최고의 무공 훈장.',
  },
  [MedalCode.GALACTIC_CAMPAIGN]: {
    code: MedalCode.GALACTIC_CAMPAIGN,
    nameKo: '은하전역공로훈장',
    nameJp: '銀河戦役功労勲章',
    nameEn: 'Galactic Campaign Merit',
    faction: 'ALLIANCE',
    tier: 2,
    ladderBonus: 75,
    minRank: 'VICE_ADMIRAL',
    maxRank: 'MARSHAL',
    description: '은하 전역에서 공로를 세운 자에게 수여.',
  },
  [MedalCode.COMBAT_MERIT]: {
    code: MedalCode.COMBAT_MERIT,
    nameKo: '전공장',
    nameJp: '戦功章',
    nameEn: 'Combat Merit Badge',
    faction: 'ALLIANCE',
    tier: 3,
    ladderBonus: 50,
    minRank: 'COLONEL',
    maxRank: 'ADMIRAL',
    description: '전투에서 공을 세운 중급 장교에게 수여.',
  },
};

/**
 * 유틸리티 함수들
 */

/**
 * 작위의 계급 래더 보너스를 반환
 */
export function getTitleLadderBonus(titleCode: TitleCode): number {
  return TITLE_DEFINITIONS[titleCode]?.ladderBonus || 0;
}

/**
 * 훈장의 계급 래더 보너스를 반환
 */
export function getMedalLadderBonus(medalCode: MedalCode): number {
  return MEDAL_DEFINITIONS[medalCode]?.ladderBonus || 0;
}

/**
 * 작위 서작 가능 여부 확인
 * @param currentTitle 현재 작위
 * @param targetTitle 대상 작위
 */
export function canPromoteTitle(currentTitle: TitleCode, targetTitle: TitleCode): boolean {
  const targetDef = TITLE_DEFINITIONS[targetTitle];
  if (!targetDef) return false;
  
  return targetDef.requiredPreviousTitle === currentTitle;
}

/**
 * 봉토 소유 가능 여부 확인
 */
export function canOwnFief(titleCode: TitleCode): boolean {
  return TITLE_DEFINITIONS[titleCode]?.canOwnFief || false;
}

/**
 * 작위 서열 비교 (낮은 tier가 높은 작위)
 */
export function compareTitles(a: TitleCode, b: TitleCode): number {
  const tierA = TITLE_DEFINITIONS[a]?.tier || 99;
  const tierB = TITLE_DEFINITIONS[b]?.tier || 99;
  return tierA - tierB;
}

/**
 * 훈장 서열 비교 (낮은 tier가 높은 훈장)
 */
export function compareMedals(a: MedalCode, b: MedalCode): number {
  const tierA = MEDAL_DEFINITIONS[a]?.tier || 99;
  const tierB = MEDAL_DEFINITIONS[b]?.tier || 99;
  return tierA - tierB;
}

/**
 * 팩션별 훈장 목록 반환
 */
export function getMedalsByFaction(faction: 'EMPIRE' | 'ALLIANCE'): MedalDefinition[] {
  return Object.values(MEDAL_DEFINITIONS).filter(
    medal => medal.faction === faction || medal.faction === 'BOTH'
  );
}







