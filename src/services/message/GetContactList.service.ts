import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
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

      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        npc: { $lt: 2 }
      });

      for (const general of generals) {
        const generalID = general.no || 0;
        const generalName = general.name || '무명';
        const nationID = general.nation || 0;
        const officerLevel = general.officer_level || 0;
        const npc = general.npc || 0;

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

      const nations = await nationRepository.findByFilter({ session_id: sessionId })
        
        ;

      const neutralNation = {
        nation: 0,
        name: '재야',
        color: 0
      };

      const allNations = [neutralNation, ...nations];

      const result = allNations.map(nation => {
        const nationID = nation.nation || 0;
        const mailbox = nationID + this.MAILBOX_NATIONAL;
        const nationName = nation.name || '무명';
        const color = nation.color || 0;
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
    const permission = general.permission;

    if (permission === 'strategic') {
      return 4;
    }

    return 0;
  }
}
