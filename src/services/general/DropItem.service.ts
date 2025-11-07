import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';

/**
 * DropItem Service (아이템 버리기)
 * 장수가 보유한 아이템을 버리는 기능
 * PHP: /sam/hwe/sammo/API/General/DropItem.php
 */
export class DropItemService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const itemType = data.itemType;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 정보가 없습니다'
      };
    }

    if (!itemType) {
      return {
        success: false,
        message: '아이템 타입이 필요합니다'
      };
    }

    const validItemTypes = ['item0', 'item1', 'item2', 'item3', 'item4'];
    if (!validItemTypes.includes(itemType)) {
      return {
        success: false,
        message: '잘못된 아이템 타입입니다'
      };
    }

    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const item = general.data?.[itemType];
      if (!item || item === 'None') {
        return {
          success: false,
          message: '아이템을 가지고 있지 않습니다.'
        };
      }

      const itemName = this.getItemName(item);
      const generalName = general.data?.name || '무명';

      general.data = general.data || {};
      general.data[itemType] = 'None';
      await generalRepository.save(general);

      const session = await sessionRepository.findBySessionId(sessionId);
      const gameEnv = session?.data || {};

      const { getNextRecordId } = await import('../../utils/record-helpers');
      const recordId1 = await getNextRecordId(sessionId);
      await generalRecordRepository.create({
        session_id: sessionId,
        data: {
          id: recordId1,
          general_id: generalId,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          log_type: 'action',
          text: `${itemName}을(를) 버렸습니다.`,
          date: new Date().toISOString()
        }
      });

      const isBuyable = this.isItemBuyable(item);
      if (!isBuyable) {
        const nationId = general.data?.nation || 0;
        let nationName = '재야';

        if (nationId !== 0) {
          const nation = await nationRepository.findOneByFilter({
            session_id: sessionId,
            'data.nation': nationId
          });
          nationName = nation?.data?.name || '무명';
        }

        const recordId2 = await getNextRecordId(sessionId);
        await generalRecordRepository.create({
          session_id: sessionId,
          data: {
            id: recordId2,
            general_id: 0,
            year: gameEnv.year || 184,
            month: gameEnv.month || 1,
            log_type: 'history',
            text: `${generalName}이(가) ${itemName}을(를) 잃었습니다!`,
            date: new Date().toISOString()
          }
        });

        await worldHistoryRepository.create({
          session_id: sessionId,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          data: {
            nation_id: 0,
            text: `【망실】${nationName}의 ${generalName}이(가) ${itemName}을(를) 잃었습니다!`
          },
          date: new Date()
        });
      }

      return {
        success: true,
        result: true,
        message: '아이템을 버렸습니다'
      };
    } catch (error: any) {
      console.error('DropItem error:', error);
      return {
        success: false,
        message: error.message || '아이템 버리기 중 오류가 발생했습니다'
      };
    }
  }

  private static getItemName(itemCode: string): string {
    const itemNames: Record<string, string> = {
      'None': '없음',
      'weapon_wooden': '목검',
      'weapon_iron': '철검',
      'weapon_steel': '강철검',
      'horse_poor': '말',
      'horse_normal': '준마',
      'horse_fast': '적토마',
      'book_leadership': '통솔서',
      'book_strength': '무력서',
      'book_intel': '지력서',
    };
    return itemNames[itemCode] || itemCode;
  }

  private static isItemBuyable(itemCode: string): boolean {
    const buyableItems = [
      'weapon_wooden', 'weapon_iron', 'horse_poor', 'horse_normal',
      'book_leadership', 'book_strength', 'book_intel'
    ];
    return buyableItems.includes(itemCode);
  }
}
