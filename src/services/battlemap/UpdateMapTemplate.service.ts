import { BattleMapTemplate } from '../../models/battlemap-template.model';

export class UpdateMapTemplateService {
  static async execute(data: {
    id: string;
    name?: string;
    width?: number;
    height?: number;
    terrain?: any[];
    castle?: any;
    exits?: any[];
    deployment?: any;
    strategicPoints?: any[];
  }) {
    try {
      const template = await (BattleMapTemplate as any).findById(data.id);
      
      if (!template) {
        return {
          success: false,
          message: `맵 템플릿을 찾을 수 없습니다: id=${data.id}`
        };
      }
      
      const updateFields: any = {};
      
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.width !== undefined) updateFields.width = data.width;
      if (data.height !== undefined) updateFields.height = data.height;
      if (data.terrain !== undefined) updateFields.terrain = data.terrain;
      if (data.castle !== undefined) updateFields.castle = data.castle;
      if (data.exits !== undefined) updateFields.exits = data.exits;
      if (data.deployment !== undefined) updateFields.deployment = data.deployment;
      if (data.strategicPoints !== undefined) updateFields.strategicPoints = data.strategicPoints;
      
      await (BattleMapTemplate as any).updateOne({ _id: data.id }, { $set: updateFields });
      
      const updated = await (BattleMapTemplate as any).findById(data.id);
      
      console.log(`✅ 맵 템플릿 수정: ${updated?.name} (city_id=${updated?.city_id})`);
      
      return {
        success: true,
        template: updated
      };
    } catch (error: any) {
      console.error('UpdateMapTemplate error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
