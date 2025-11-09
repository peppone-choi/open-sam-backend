// @ts-nocheck - Legacy game data with duplicate keys
/**
 * 은하영웅전설 Ⅶ 게임 데이터
 *
 * 출처: gin7manual.txt (銀河英雄伝説Ⅶ 일본어 매뉴얼)
 *
 * **핵심 개념**:
 * - 다인수 온라인 전략 시뮬레이션
 * - 플레이어는 은하제국 또는 자유혹성동맹의 커맨더
 * - 전략 게임 + 전술 게임(RTS) 혼합
 * - 조직 시뮬레이션 (계급, 직무, 인간관계)
 *
 * @module LoghData
 */

/**
 * 세력 타입
 */
export enum FactionType {
  /** 은하제국 (Galactic Empire) */
  EMPIRE = 'empire',
  /** 자유혹성동맹 (Free Planets Alliance) */
  ALLIANCE = 'alliance',
}

/**
 * 계급 시스템 (일본어 원문 기준)
 */
export enum Rank {
  // 은하제국 계급
  EMPIRE_GRAND_ADMIRAL = '元帥',        // 원수
  EMPIRE_SENIOR_ADMIRAL = '上級大将',   // 상급대장
  EMPIRE_VICE_ADMIRAL = '中将',         // 중장
  EMPIRE_REAR_ADMIRAL = '少将',         // 소장
  EMPIRE_COMMODORE = '准将',            // 준장
  EMPIRE_CAPTAIN = '大佐',              // 대좌
  EMPIRE_COMMANDER = '中佐',            // 중좌
  EMPIRE_LIEUTENANT = '少佐',           // 소좌

  // 자유혹성동맹 계급
  ALLIANCE_GRAND_ADMIRAL = '元帥',      // 원수
  ALLIANCE_ADMIRAL = '大将',            // 대장
  ALLIANCE_VICE_ADMIRAL = '中将',       // 중장
  ALLIANCE_REAR_ADMIRAL = '少将',       // 소장
  ALLIANCE_COMMODORE = '准将',          // 준장
  ALLIANCE_CAPTAIN = '大佐',            // 대좌
  ALLIANCE_COMMANDER = '中佐',          // 중좌
  ALLIANCE_LIEUTENANT = '少佐',         // 소좌
}

/**
 * 캐릭터 파라미터 인터페이스
 *
 * gin7manual.txt 기반
 */
export interface ILoghCharacter {
  /** 캐릭터 이름 */
  name: string;

  /** 소속 세력 */
  faction: FactionType;

  /** 계급 */
  rank: Rank;

  /** 능력치 (삼국지의 통무지정과 유사) */
  stats: {
    /** 지휘 능력 (함대 지휘) */
    command: number;
    /** 전술 능력 (전투 능력) */
    tactics: number;
    /** 전략 능력 (작전 계획) */
    strategy: number;
    /** 정치 능력 (행정/외교) */
    politics: number;
  };

  /** 평가 포인트 (승진에 영향) */
  evaluationPoints: number;

  /** 명성 포인트 (인지도) */
  famePoints: number;

  /** 공적 (전투 승리 등) */
  achievements: number;

  /** 커맨드 포인트 (행동력) */
  commandPoints: number;

  /** 직무 권한 카드 (특수 권한) */
  authorityCards: string[];

  /** 소속 함대 ID */
  fleetId: string | null;

  /** 기함 (Flagship) */
  flagship: {
    name: string;
    type: ShipType;
    firepower: number;
  } | null;

  /** 위치 (그리드 좌표) */
  position: {
    x: number;
    y: number;
    z: number;
  };
}

/**
 * 함선 타입
 */
export enum ShipType {
  /** 전함 */
  BATTLESHIP = 'battleship',
  /** 순양함 */
  CRUISER = 'cruiser',
  /** 구축함 */
  DESTROYER = 'destroyer',
  /** 항공모함 */
  CARRIER = 'carrier',
}

/**
 * 함대 인터페이스
 */
export interface IFleet {
  /** 함대 ID */
  id: string;

  /** 함대 이름 */
  name: string;

  /** 사령관 ID */
  commanderId: string;

  /** 소속 세력 */
  faction: FactionType;

  /** 함선 구성 */
  ships: {
    type: ShipType;
    count: number;
  }[];

  /** 총 함선 수 */
  totalShips: number;

  /** 보급품 */
  supplies: number;

  /** 위치 */
  position: {
    x: number;
    y: number;
    z: number;
  };

  /** 진형 */
  formation: 'standard' | 'offensive' | 'defensive' | 'encircle';
}

/**
 * 작전 계획 인터페이스
 */
export interface IOperationPlan {
  /** 작전 ID */
  id: string;

  /** 작전 이름 */
  name: string;

  /** 작전 타입 */
  type: 'attack' | 'defend' | 'occupy' | 'scout';

  /** 발령자 ID */
  issuerId: string;

  /** 대상 행성/성계 */
  targetId: string;

  /** 참가 함대 목록 */
  fleetIds: string[];

  /** 작전 단계 */
  phases: {
    phase: number;
    description: string;
    requiredTurns: number;
    completed: boolean;
  }[];

  /** 작전 상태 */
  status: 'planning' | 'issued' | 'executing' | 'completed' | 'failed';

  /** 작전 결과 */
  result?: {
    success: boolean;
    casualties: number;
    gainedTerritory: string[];
  };
}

/**
 * 행성 인터페이스
 */
export interface IPlanet {
  /** 행성 ID */
  id: string;

  /** 행성 이름 */
  name: string;

  /** 소유 세력 */
  owner: FactionType | 'neutral';

  /** 생산력 */
  production: {
    /** 함선 생산 */
    ships: number;
    /** 자원 생산 */
    resources: number;
  };

  /** 주둔 함대 */
  garrisonFleetId: string | null;

  /** 요새 여부 */
  isFortress: boolean;

  /** 요새포 */
  fortressGuns: number;

  /** 행성 창고 */
  warehouse: {
    supplies: number;
    ships: number;
  };
}

/**
 * 워프 항행 시스템
 *
 * gin7manual.txt: "ワープ航行の概念"
 */
export interface IWarpSystem {
  /** 워프 시간 (턴 수) */
  warpTime: number;

  /** 워프 거리 제한 */
  maxDistance: number;

  /** 워프 비용 (보급품) */
  cost: number;
}

/**
 * 명장 데이터 (원작 기반)
 */
export const FAMOUS_COMMANDERS: Record<string, Omit<ILoghCharacter, 'evaluationPoints' | 'famePoints' | 'achievements' | 'commandPoints' | 'authorityCards' | 'fleetId' | 'flagship' | 'position'>> = {
  /** 라인하르트 폰 로엔그람 (은하제국) */
  reinhard: {
    name: 'ラインハルト・フォン・ローエングラム',
    faction: FactionType.EMPIRE,
    rank: Rank.EMPIRE_GRAND_ADMIRAL,
    stats: {
      command: 100,   // 최고 지휘 능력
      tactics: 98,
      strategy: 95,
      politics: 92,
    },
  },

  /** 양 웬리 (자유혹성동맹) */
  yang: {
    name: 'ヤン・ウェンリー',
    faction: FactionType.ALLIANCE,
    rank: Rank.ALLIANCE_ADMIRAL,
    stats: {
      command: 95,
      tactics: 100,   // 최고 전술 능력
      strategy: 98,
      politics: 75,
    },
  },

  /** 지크프리트 키르히아이스 (은하제국) */
  kircheis: {
    name: 'ジークフリード・キルヒアイス',
    faction: FactionType.EMPIRE,
    rank: Rank.EMPIRE_SENIOR_ADMIRAL,
    stats: {
      command: 92,
      tactics: 90,
      strategy: 88,
      politics: 90,
    },
  },

  /** 율리안 민츠 (자유혹성동맹) */
  julian: {
    name: 'ユリアン・ミンツ',
    faction: FactionType.ALLIANCE,
    rank: Rank.ALLIANCE_REAR_ADMIRAL,
    stats: {
      command: 85,
      tactics: 88,
      strategy: 82,
      politics: 78,
    },
  },

  /** 오스카 폰 로이엔탈 (은하제국) */
  reuenthal: {
    name: 'オスカー・フォン・ロイエンタール',
    faction: FactionType.EMPIRE,
    rank: Rank.EMPIRE_SENIOR_ADMIRAL,
    stats: {
      command: 94,
      tactics: 92,
      strategy: 89,
      politics: 70,
    },
  },

  /** 볼프강 미터마이어 (은하제국) */
  mittermeyer: {
    name: 'ヴォルフガング・ミッターマイヤー',
    faction: FactionType.EMPIRE,
    rank: Rank.EMPIRE_SENIOR_ADMIRAL,
    stats: {
      command: 93,
      tactics: 95,  // 돌격 전문
      strategy: 88,
      politics: 75,
    },
  },
};

/**
 * 커맨드 포인트 시스템
 *
 * gin7manual.txt: "コマンドポイント"
 * - 캐릭터가 행동할 때 소모
 * - 계급이 높을수록 많이 보유
 */
export const COMMAND_POINTS_BY_RANK: Record<Rank, number> = {
  [Rank.EMPIRE_GRAND_ADMIRAL]: 20,
  [Rank.EMPIRE_SENIOR_ADMIRAL]: 15,
  [Rank.EMPIRE_VICE_ADMIRAL]: 12,
  [Rank.EMPIRE_REAR_ADMIRAL]: 10,
  [Rank.EMPIRE_COMMODORE]: 8,
  [Rank.EMPIRE_CAPTAIN]: 6,
  [Rank.EMPIRE_COMMANDER]: 5,
  [Rank.EMPIRE_LIEUTENANT]: 4,

  [Rank.ALLIANCE_GRAND_ADMIRAL]: 20,
  [Rank.ALLIANCE_ADMIRAL]: 18,
  [Rank.ALLIANCE_VICE_ADMIRAL]: 12,
  [Rank.ALLIANCE_REAR_ADMIRAL]: 10,
  [Rank.ALLIANCE_COMMODORE]: 8,
  [Rank.ALLIANCE_CAPTAIN]: 6,
  [Rank.ALLIANCE_COMMANDER]: 5,
  [Rank.ALLIANCE_LIEUTENANT]: 4,
};

/**
 * RTS 전술 게임 시스템
 *
 * gin7manual.txt: "戦術ゲーム部分はシリーズ初の RTS 型"
 */
export interface IRTSBattleSystem {
  /** 함대 유닛 */
  units: {
    unitId: string;
    type: 'fleet' | 'planet' | 'fortress';
    position: { x: number; y: number };
    commandRange: number; // コマンドレンジサークル
  }[];

  /** 색적 시스템 (索敵) */
  detection: {
    range: number;
    fogOfWar: boolean;
  };

  /** 실시간 전투 */
  realtimeCombat: boolean;
}

/**
 * 직무 권한 카드
 *
 * gin7manual.txt: "職務権限カード"
 * - 상급 직무에 특수 권한 부여
 */
export const AUTHORITY_CARDS = {
  /** 작전 발령 권한 */
  OPERATION_COMMAND: {
    name: '作戦発令',
    description: '함대 작전 계획을 발령할 수 있음',
    requiredRank: Rank.EMPIRE_COMMODORE,
  },
  /** 인사 권한 */
  PERSONNEL_MANAGEMENT: {
    name: '人事管理',
    description: '승진, 임명, 파면 권한',
    requiredRank: Rank.EMPIRE_VICE_ADMIRAL,
  },
  /** 생산 권한 */
  PRODUCTION_AUTHORITY: {
    name: '生産権限',
    description: '함선 및 자원 생산 명령',
    requiredRank: Rank.EMPIRE_REAR_ADMIRAL,
  },
};
