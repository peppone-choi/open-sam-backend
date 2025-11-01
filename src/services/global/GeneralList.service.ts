import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';
import { getOfficerTitle, getDedicationShortName } from '../../utils/rank-system';

/**
 * GeneralList Service
 * Returns complete list of all generals with their stats, nation info, etc.
 * Used for viewing all generals in the game
 */
export class GeneralListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get all generals with essential fields
      const generals = await General.find({ session_id: sessionId })
        .select('no name owner picture data')
        .lean();

      // Get all nations
      const nations = await Nation.find({ session_id: sessionId }).lean();
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
        result: 'true',
        column: resultColumns,
        list: generalList
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
  private static calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
    const baseBonus = Math.floor(officerLevel / 5) * 5;
    const nationBonus = Math.floor(nationLevel / 5) * 2;
    return baseBonus + nationBonus;
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

  // Helper function: Get dedication level text (rank-system.ts 유틸리티 사용)
  private static getDed(dedication: number): string {
    return getDedicationShortName(dedication);
  }

  // Helper function: Get officer level text (rank-system.ts 유틸리티 사용)
  private static getOfficerLevelText(officerLevel: number, nationLevel: number): string {
    return getOfficerTitle(officerLevel, nationLevel);
  }
}
