/**
 * Title.service.ts - 칭호/별명 시스템 서비스
 *
 * 장수의 칭호 부여 및 표시를 담당합니다.
 */

import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

/**
 * 칭호 타입
 */
export enum TitleType {
  // 전투 칭호
  WARRIOR = 'warrior',                 // 무인
  BERSERKER = 'berserker',             // 광전사
  GOD_OF_WAR = 'god_of_war',           // 전신
  SLAYER = 'slayer',                   // 살수
  IRON_WALL = 'iron_wall',             // 철벽
  STRATEGIST = 'strategist',           // 책사
  
  // 내정 칭호
  BUILDER = 'builder',                 // 건축가
  MERCHANT = 'merchant',               // 상인
  FARMER = 'farmer',                   // 농부
  ADMINISTRATOR = 'administrator',     // 행정관
  
  // 외교 칭호
  DIPLOMAT = 'diplomat',               // 외교관
  PEACEMAKER = 'peacemaker',           // 평화주의자
  WARMONGER = 'warmonger',             // 전쟁광
  
  // 인사 칭호
  RECRUITER = 'recruiter',             // 인재 발굴가
  MENTOR = 'mentor',                   // 스승
  
  // 국가 칭호
  FOUNDER = 'founder',                 // 건국자
  CONQUEROR = 'conqueror',             // 정복자
  EMPEROR = 'emperor',                 // 황제
  
  // 특수 칭호
  SURVIVOR = 'survivor',               // 생존자
  ESCAPIST = 'escapist',               // 탈출왕
  WEALTHY = 'wealthy',                 // 부자
  VETERAN = 'veteran',                 // 노장
  LEGEND = 'legend',                   // 전설
}

/**
 * 칭호 설정
 */
export interface TitleConfig {
  id: TitleType;
  name: string;
  description: string;
  prefix?: string;    // 이름 앞에 붙는 칭호
  suffix?: string;    // 이름 뒤에 붙는 칭호
  color?: string;     // 표시 색상
  priority: number;   // 우선순위 (높을수록 먼저 표시)
  condition: (general: any) => boolean;
  exclusive?: TitleType[];  // 동시에 가질 수 없는 칭호
}

/**
 * 칭호 목록
 */
export const TITLES: Record<TitleType, TitleConfig> = {
  [TitleType.WARRIOR]: {
    id: TitleType.WARRIOR,
    name: '무인',
    description: '전투에 능숙한 장수',
    prefix: '무인',
    color: '#FF6B6B',
    priority: 10,
    condition: (g) => (g.stats?.warnum || 0) >= 10,
  },
  [TitleType.BERSERKER]: {
    id: TitleType.BERSERKER,
    name: '광전사',
    description: '전투를 두려워하지 않는 용맹한 장수',
    prefix: '광전사',
    color: '#FF0000',
    priority: 20,
    condition: (g) => (g.stats?.warnum || 0) >= 50 && (g.stats?.killnum || 0) >= 30,
  },
  [TitleType.GOD_OF_WAR]: {
    id: TitleType.GOD_OF_WAR,
    name: '전신',
    description: '전장을 지배하는 전쟁의 신',
    prefix: '전신',
    color: '#FFD700',
    priority: 100,
    condition: (g) => (g.stats?.killnum || 0) >= 100 && (g.stats?.warnum || 0) >= 200,
  },
  [TitleType.SLAYER]: {
    id: TitleType.SLAYER,
    name: '살수',
    description: '적장을 다수 사살한 장수',
    prefix: '살수',
    color: '#8B0000',
    priority: 30,
    condition: (g) => (g.stats?.killnum || 0) >= 50,
  },
  [TitleType.IRON_WALL]: {
    id: TitleType.IRON_WALL,
    name: '철벽',
    description: '방어에 능한 장수',
    suffix: '철벽',
    color: '#4682B4',
    priority: 25,
    condition: (g) => (g.stats?.defensewin || 0) >= 20,
  },
  [TitleType.STRATEGIST]: {
    id: TitleType.STRATEGIST,
    name: '책사',
    description: '지략으로 승리를 이끄는 장수',
    prefix: '책사',
    color: '#9932CC',
    priority: 40,
    condition: (g) => (g.stats?.firenum || 0) >= 10 || (g.intel || g.data?.intel || 0) >= 90,
  },
  [TitleType.BUILDER]: {
    id: TitleType.BUILDER,
    name: '건축가',
    description: '도시 건설에 공헌한 장수',
    prefix: '건축가',
    color: '#8B4513',
    priority: 15,
    condition: (g) => (g.stats?.buildwall || 0) >= 5 || (g.stats?.irrigation || 0) >= 5,
  },
  [TitleType.MERCHANT]: {
    id: TitleType.MERCHANT,
    name: '상인',
    description: '상업에 능한 장수',
    suffix: '상인',
    color: '#FFD700',
    priority: 12,
    condition: (g) => (g.stats?.tradenum || 0) >= 20,
  },
  [TitleType.FARMER]: {
    id: TitleType.FARMER,
    name: '농부',
    description: '농업에 힘쓴 장수',
    color: '#228B22',
    priority: 11,
    condition: (g) => (g.stats?.agriinvest || 0) >= 30,
  },
  [TitleType.ADMINISTRATOR]: {
    id: TitleType.ADMINISTRATOR,
    name: '행정관',
    description: '내정에 탁월한 장수',
    prefix: '행정관',
    color: '#4169E1',
    priority: 35,
    condition: (g) => (g.stats?.investnum || 0) >= 100,
  },
  [TitleType.DIPLOMAT]: {
    id: TitleType.DIPLOMAT,
    name: '외교관',
    description: '외교에 능한 장수',
    prefix: '외교관',
    color: '#20B2AA',
    priority: 30,
    condition: (g) => (g.stats?.alliancenum || 0) >= 3,
  },
  [TitleType.PEACEMAKER]: {
    id: TitleType.PEACEMAKER,
    name: '평화주의자',
    description: '평화를 추구하는 장수',
    prefix: '평화의',
    color: '#87CEEB',
    priority: 20,
    condition: (g) => (g.stats?.alliancenum || 0) >= 5 && (g.stats?.declarewar || 0) === 0,
    exclusive: [TitleType.WARMONGER],
  },
  [TitleType.WARMONGER]: {
    id: TitleType.WARMONGER,
    name: '전쟁광',
    description: '전쟁을 즐기는 장수',
    prefix: '전쟁광',
    color: '#DC143C',
    priority: 25,
    condition: (g) => (g.stats?.declarewar || 0) >= 5,
    exclusive: [TitleType.PEACEMAKER],
  },
  [TitleType.RECRUITER]: {
    id: TitleType.RECRUITER,
    name: '인재 발굴가',
    description: '인재 등용에 능한 장수',
    color: '#32CD32',
    priority: 20,
    condition: (g) => (g.stats?.recruitnum || 0) >= 10,
  },
  [TitleType.MENTOR]: {
    id: TitleType.MENTOR,
    name: '스승',
    description: '후학을 양성하는 장수',
    prefix: '스승',
    color: '#DAA520',
    priority: 35,
    condition: (g) => (g.stats?.teachnum || 0) >= 5,
  },
  [TitleType.FOUNDER]: {
    id: TitleType.FOUNDER,
    name: '건국자',
    description: '나라를 세운 장수',
    prefix: '건국자',
    color: '#FFD700',
    priority: 50,
    condition: (g) => (g.stats?.foundnation || 0) >= 1,
  },
  [TitleType.CONQUEROR]: {
    id: TitleType.CONQUEROR,
    name: '정복자',
    description: '다수의 도시를 점령한 장수',
    prefix: '정복자',
    color: '#B22222',
    priority: 60,
    condition: (g) => (g.stats?.conquernum || 0) >= 10,
  },
  [TitleType.EMPEROR]: {
    id: TitleType.EMPEROR,
    name: '황제',
    description: '천하를 통일한 장수',
    prefix: '황제',
    color: '#FFD700',
    priority: 200,
    condition: (g) => (g.stats?.unify || 0) >= 1,
  },
  [TitleType.SURVIVOR]: {
    id: TitleType.SURVIVOR,
    name: '생존자',
    description: '위기를 넘긴 장수',
    suffix: '불사',
    color: '#00CED1',
    priority: 15,
    condition: (g) => (g.stats?.survivedeath || 0) >= 1,
  },
  [TitleType.ESCAPIST]: {
    id: TitleType.ESCAPIST,
    name: '탈출왕',
    description: '포로에서 탈출한 장수',
    color: '#778899',
    priority: 10,
    condition: (g) => (g.stats?.escapeprison || 0) >= 1,
  },
  [TitleType.WEALTHY]: {
    id: TitleType.WEALTHY,
    name: '부자',
    description: '부를 축적한 장수',
    suffix: '거부',
    color: '#FFD700',
    priority: 25,
    condition: (g) => (g.gold || g.data?.gold || 0) >= 500000,
  },
  [TitleType.VETERAN]: {
    id: TitleType.VETERAN,
    name: '노장',
    description: '오랜 세월 활동한 장수',
    prefix: '노장',
    color: '#696969',
    priority: 30,
    condition: (g) => (g.age || g.data?.age || 0) >= 50,
  },
  [TitleType.LEGEND]: {
    id: TitleType.LEGEND,
    name: '전설',
    description: '역사에 이름을 남긴 장수',
    prefix: '전설의',
    color: '#FFD700',
    priority: 150,
    condition: (g) => {
      const stats = g.stats || {};
      return (stats.warnum || 0) >= 100 &&
             (stats.killnum || 0) >= 50 &&
             (stats.conquernum || 0) >= 5;
    },
  },
};

/**
 * 칭호 서비스 클래스
 */
export class TitleService {
  /**
   * 칭호 체크 및 부여
   */
  static async checkTitles(
    sessionId: string,
    generalId: number
  ): Promise<TitleType[]> {
    const newTitles: TitleType[] = [];

    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return newTitles;

      const generalData = general.data || {};
      const currentTitles: TitleType[] = generalData.titles || [];

      // 각 칭호 체크
      for (const [key, config] of Object.entries(TITLES)) {
        const titleId = key as TitleType;
        
        // 이미 보유한 칭호는 스킵
        if (currentTitles.includes(titleId)) continue;

        // 배타적 칭호 체크
        if (config.exclusive?.some(t => currentTitles.includes(t))) continue;

        // 조건 체크
        if (config.condition(generalData)) {
          newTitles.push(titleId);
          
          logger.info('[Title] Granted', {
            sessionId,
            generalId,
            title: titleId,
            name: config.name,
          });
        }
      }

      // 새 칭호 저장
      if (newTitles.length > 0) {
        generalData.titles = [...currentTitles, ...newTitles];
        await generalRepository.updateBySessionAndNo(sessionId, generalId, {
          data: generalData,
        });
      }

      return newTitles;
    } catch (error: any) {
      logger.error('[Title] Check failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 대표 칭호 설정
   */
  static async setMainTitle(
    sessionId: string,
    generalId: number,
    titleId: TitleType | null
  ): Promise<boolean> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return false;

      const generalData = general.data || {};
      const currentTitles: TitleType[] = generalData.titles || [];

      // null이면 칭호 해제
      if (titleId === null) {
        generalData.mainTitle = null;
        await generalRepository.updateBySessionAndNo(sessionId, generalId, {
          data: generalData,
        });
        return true;
      }

      // 보유 칭호 체크
      if (!currentTitles.includes(titleId)) {
        return false;
      }

      generalData.mainTitle = titleId;
      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        data: generalData,
      });

      return true;
    } catch (error: any) {
      logger.error('[Title] Set main title failed', {
        sessionId,
        generalId,
        titleId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 장수의 보유 칭호 목록 조회
   */
  static async getTitles(
    sessionId: string,
    generalId: number
  ): Promise<TitleConfig[]> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return [];

      const generalData = general.data || {};
      const titleIds: TitleType[] = generalData.titles || [];

      return titleIds
        .map((id) => TITLES[id])
        .filter((config): config is TitleConfig => !!config)
        .sort((a, b) => b.priority - a.priority);
    } catch (error: any) {
      logger.error('[Title] Get titles failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 장수 이름에 칭호 적용
   */
  static async formatNameWithTitle(
    sessionId: string,
    generalId: number,
    name: string
  ): Promise<string> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return name;

      const generalData = general.data || {};
      const mainTitle = generalData.mainTitle as TitleType | null;

      if (!mainTitle) return name;

      const config = TITLES[mainTitle];
      if (!config) return name;

      let formattedName = name;
      if (config.prefix) {
        formattedName = `${config.prefix} ${formattedName}`;
      }
      if (config.suffix) {
        formattedName = `${formattedName} ${config.suffix}`;
      }

      return formattedName;
    } catch (error: any) {
      return name;
    }
  }

  /**
   * 모든 칭호 목록 조회
   */
  static getAllTitles(): TitleConfig[] {
    return Object.values(TITLES).sort((a, b) => b.priority - a.priority);
  }
}

export default TitleService;










