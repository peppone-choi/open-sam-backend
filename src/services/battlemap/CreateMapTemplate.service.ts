import { BattleMapTemplate, IBattleMapTemplate } from '../../models/battlemap-template.model';
import { battleMapTemplateRepository } from '../../repositories/battle-map-template.repository';

export class CreateMapTemplateService {
  static async execute(data: {
    session_id?: string;
    city_id: number;
    name: string;
    width?: number;
    height?: number;
    terrain: any[];
    castle: any;
    exits: any[];
    deployment: any;
    strategicPoints?: any[];
  }) {
    try {
      const sessionId = data.session_id || 'sangokushi_default';
      
      const existing = await battleMapTemplateRepository.findOneByFilter({
        session_id: sessionId,
        city_id: data.city_id
      });
      
      if (existing) {
        return {
          success: false,
          message: `이미 존재하는 맵입니다: city_id=${data.city_id}`
        };
      }
      
      const template = await battleMapTemplateRepository.create({
        session_id: sessionId,
        city_id: data.city_id,
        name: data.name,
        width: data.width || 40,
        height: data.height || 40,
        terrain: data.terrain,
        castle: data.castle,
        exits: data.exits,
        deployment: data.deployment,
        strategicPoints: data.strategicPoints || []
      });
      
      console.log(`✅ 맵 템플릿 생성: ${data.name} (city_id=${data.city_id})`);
      
      return {
        success: true,
        template
      };
    } catch (error: any) {
      console.error('CreateMapTemplate error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
