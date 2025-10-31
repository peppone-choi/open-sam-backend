import { BattleMapTemplate } from '../../models/battlemap-template.model';

export class DeleteMapTemplateService {
  static async execute(data: { id: string }) {
    try {
      const template = await BattleMapTemplate.findById(data.id);
      
      if (!template) {
        return {
          success: false,
          message: `맵 템플릿을 찾을 수 없습니다: id=${data.id}`
        };
      }
      
      await BattleMapTemplate.deleteOne({ _id: data.id });
      
      console.log(`🗑️  맵 템플릿 삭제: ${template.name} (city_id=${template.city_id})`);
      
      return {
        success: true,
        message: '맵 템플릿이 삭제되었습니다'
      };
    } catch (error: any) {
      console.error('DeleteMapTemplate error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
