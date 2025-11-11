// @ts-nocheck
import { BattlemapTemplate } from '../models/battlemap-template.model';
import { DeleteResult } from 'mongodb';

/**
 * 전투맵 템플릿 리포지토리 (중복 - battle-map-template과 동일 컬렉션)
 * 
 * Note: BattleMapTemplate과 BattlemapTemplate은 같은 모델입니다.
 * 이 파일은 하위 호환성을 위해 존재합니다.
 */
class BattlemapTemplateRepository {
  async findBySession(sessionId: string) {
    return BattlemapTemplate.find({ session_id: sessionId });
  }

  async findById(templateId: string) {
    return BattlemapTemplate.findById(templateId);
  }

  async create(data: any) {
    return BattlemapTemplate.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return BattlemapTemplate.deleteMany({ session_id: sessionId });
  }
}

export const battlemapTemplateRepository = new BattlemapTemplateRepository();
