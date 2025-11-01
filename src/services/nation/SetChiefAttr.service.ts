import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * SetChiefAttr Service
 * 수뇌부 속성 설정
 */
export class SetChiefAttrService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const attrName = data.attrName || data.attr_name;
    const attrValue = data.attrValue || data.attr_value;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!attrName) {
        return { success: false, message: '속성 이름이 필요합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const nationId = general.data?.nation || 0;

      if (officerLevel < 5) {
        return { success: false, message: '권한이 부족합니다. 수뇌부만 설정할 수 있습니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      const allowedAttrs = ['chief_set', 'strategic_cmd_limit'];
      if (!allowedAttrs.includes(attrName)) {
        return { success: false, message: '허용되지 않은 속성입니다' };
      }

      const updateData: any = {};
      updateData[`data.${attrName}`] = attrValue;

      await Nation.updateOne(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          $set: updateData
        }
      );

      return {
        success: true,
        result: true,
        message: '수뇌부 속성이 설정되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
