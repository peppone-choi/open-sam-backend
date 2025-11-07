import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { getSession } from '../../common/cache/model-cache.helper';
import { cacheService } from '../../common/cache/cache.service';

/**
 * GeneralList Service
 * Returns complete list of all generals with their stats, nation info, etc.
 * Used for viewing all generals in the game
 */
export class GeneralListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session (L1 → L2 → DB)
      const session = await getSession(sessionId);
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get all generals with essential fields (캐시 적용 - 목록은 짧은 TTL)
      const generals: any[] = await cacheService.getOrLoad(
        `generals:list:${sessionId}`,
        () => generalRepository.findBySession(sessionId )
          
          ,
        30 // 목록은 30초 TTL
      ) || [];

      // Get all nations (캐시 적용)
      const nations: any[] = await cacheService.getOrLoad(
        `nations:list:${sessionId}`,
        () => nationRepository.findByFilter({ session_id: sessionId }),
        60 // 1분 TTL
      ) || [];
      const nationMap: Record<number, any> = {};
      for (const nation of nations) {
        nationMap[nation.nation] = {
          ...nation.data,
          nation: nation.nation,
          name: nation.name
        };
      }

      // Build general list
      const generalList: any[] = [];
      const resultColumns = [
        'no',
        'picture',
        'imgsvr',
        'npc',
        'age',
        'nationName',
        'special',
        'special2',
        'personal',
        'name',
        'ownerName',
        'injury',
        'leadership',
        'lbonus',
        'strength',
        'intel',
        'explevel',
        'honorText',
        'dedLevelText',
        'officerLevelText',
        'killturn',
        'refreshScoreTotal',
      ];

      for (const general of generals) {
        const genData = general.data as any || {};
        const nationId = genData.nation || 0;
        const nationInfo = nationMap[nationId] || { name: '재야', level: 0 };

        // Calculate leadership bonus
        const officerLevel = genData.officer_level || 1;
        const nationLevel = nationInfo.level || 0;
        const lbonus = this.calcLeadershipBonus(officerLevel, nationLevel);

        // Calculate experience level
        const experience = genData.experience || 0;
        const explevel = this.getExpLevel(experience);
        const honorText = this.getHonor(experience);

        // Calculate dedication level
        const dedication = genData.dedication || 0;
        const dedLevelText = this.getDed(dedication);

        // Officer level text
        const officerLevelText = this.getOfficerLevelText(officerLevel, nationLevel);

        generalList.push([
          general.no,
          general.picture || null,
          genData.imgsvr || null,
          general.owner === 'NPC' ? 1 : 0,
          genData.age || 0,
          nationInfo.name,
          genData.special || 'None',
          genData.special2 || 'None',
          genData.personal || 'None',
          general.name,
          general.owner === 'NPC' ? (genData.owner_name || null) : null,
          genData.injury || 0,
          genData.leadership || 0,
          lbonus,
          genData.strength || 0,
          genData.intel || 0,
          explevel,
          honorText,
          dedLevelText,
          officerLevelText,
          genData.killturn || 0,
          genData.refresh_score_total || 0,
        ]);
      }

      return {
        success: true,
        result: true,
        column: resultColumns,
        list: generalList,
        generals: generalList  // 프론트엔드 호환성
      };
    } catch (error: any) {
      console.error('GeneralList error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Helper function: Calculate leadership bonus based on officer level and nation level
  // PHP: calcLeadershipBonus
  private static calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
    if (officerLevel === 12) {
      return nationLevel * 2;
    } else if (officerLevel >= 5) {
      return nationLevel;
    } else {
      return 0;
    }
  }

  // Helper function: Get experience level
  private static getExpLevel(experience: number): number {
    if (experience < 1000) return 0;
    if (experience < 3000) return 1;
    if (experience < 6000) return 2;
    if (experience < 10000) return 3;
    if (experience < 15000) return 4;
    if (experience < 21000) return 5;
    if (experience < 28000) return 6;
    if (experience < 36000) return 7;
    if (experience < 45000) return 8;
    if (experience < 55000) return 9;
    if (experience < 66000) return 10;
    if (experience < 78000) return 11;
    if (experience < 91000) return 12;
    if (experience < 105000) return 13;
    if (experience < 120000) return 14;
    return 15;
  }

  // Helper function: Get honor text based on experience
  private static getHonor(experience: number): string {
    const level = this.getExpLevel(experience);
    const honorTitles = [
      '없음', '하진병', '촌장', '현장', '태수', '자사', 
      '대장군', '대도독', '태위', '사공', '사도', 
      '태사', '태부', '태보', '승상', '대장군', '태위'
    ];
    return honorTitles[level] || honorTitles[0];
  }

  // Helper function: Get dedication level text
  private static getDed(dedication: number): string {
    if (dedication < 100) return '하하';
    if (dedication < 300) return '하중';
    if (dedication < 600) return '하상';
    if (dedication < 1000) return '중하';
    if (dedication < 1500) return '중중';
    if (dedication < 2100) return '중상';
    if (dedication < 2800) return '상하';
    if (dedication < 3600) return '상중';
    if (dedication < 4500) return '상상';
    if (dedication < 5500) return '특상';
    return '최상';
  }

  // Helper function: Get officer level text
  private static getOfficerLevelText(officerLevel: number, nationLevel: number): string {
    if (officerLevel < 5) return '평민';
    if (officerLevel < 10) return '하급관리';
    if (officerLevel < 15) return '중급관리';
    if (officerLevel < 20) return '상급관리';
    if (officerLevel < 25) return '부장';
    if (officerLevel < 30) return '장군';
    if (officerLevel < 35) return '대장군';
    if (officerLevel < 40) return '장상';
    if (officerLevel < 45) return '원로';
    
    // Special titles for high level officers
    if (nationLevel >= 5) {
      if (officerLevel >= 50) return '재상';
      if (officerLevel >= 45) return '삼공';
    }
    
    return '중신';
  }
}
