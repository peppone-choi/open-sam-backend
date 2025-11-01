import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * GetContactList Service
 * 연락처 목록 조회 (국가 및 장수 목록)
 * PHP: /sam/hwe/sammo/API/Message/GetContactList.php & func_message.php::getMailboxList
 */
export class GetContactListService {
  static readonly MAILBOX_NATIONAL = 1000000;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return {
          success: true,
          result: true,
          nation: []
        };
      }

      const generalNations: { [key: number]: any[] } = {};

      const generals = await General.find({
        session_id: sessionId,
        'data.npc': { $lt: 2 }
      }).select('data.no data.name data.nation data.officer_level data.npc data.permission data.penalty').lean();

      for (const general of generals) {
        const generalID = general.data?.no || 0;
        const generalName = general.data?.name || '무명';
        const nationID = general.data?.nation || 0;
        const officerLevel = general.data?.officer_level || 0;
        const npc = general.data?.npc || 0;

        if (!generalNations[nationID]) {
          generalNations[nationID] = [];
        }

        let flags = 0;
        const permission = this.checkSecretPermission(general);

        if (officerLevel === 12) {
          flags |= 1;
        }

        if (npc === 1) {
          flags |= 2;
        }

        if (permission === 4) {
          flags |= 4;
        }

        generalNations[nationID].push([generalID, generalName, flags]);
      }

      const nations = await Nation.find({ session_id: sessionId })
        .select('data.nation data.name data.color')
        .lean();

      const neutralNation = {
        data: {
          nation: 0,
          name: '재야',
          color: 0
        }
      };

      const allNations = [neutralNation, ...nations];

      const result = allNations.map(nation => {
        const nationID = nation.data?.nation || 0;
        const mailbox = nationID + this.MAILBOX_NATIONAL;
        const nationName = nation.data?.name || '무명';
        const color = nation.data?.color || 0;
        const generals = generalNations[nationID] || [];

        return {
          mailbox,
          name: nationName,
          color,
          general: generals
        };
      });

      return {
        success: true,
        result: true,
        nation: result
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static checkSecretPermission(general: any): number {
    const permission = general.data?.permission;
    
    if (permission === 'strategic') {
      return 4;
    }
    
    return 0;
  }
}
