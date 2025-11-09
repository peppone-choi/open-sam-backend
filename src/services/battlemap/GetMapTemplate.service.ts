import { BattleMapTemplate } from '../../models/battlemap-template.model';
import { battleMapTemplateRepository } from '../../repositories/battle-map-template.repository';

export class GetMapTemplateService {
  static async execute(data: { session_id?: string; city_id?: number }) {
    try {
      const sessionId = data.session_id || 'sangokushi_default';
      
      if (data.city_id !== undefined) {
        const template = await battleMapTemplateRepository.findOneByFilter({
          session_id: sessionId,
          city_id: data.city_id
        });
        
        if (!template) {
          return {
            success: false,
            message: `맵 템플릿을 찾을 수 없습니다: city_id=${data.city_id}`
          };
        }
        
        return {
          success: true,
          template
        };
      }
      
      const templates = await battleMapTemplateRepository.findByFilter({ session_id: sessionId })
        .sort({ city_id: 1 }).exec();
      
      return {
        success: true,
        templates,
        count: templates.length
      };
    } catch (error: any) {
      console.error('GetMapTemplate error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
