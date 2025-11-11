// @ts-nocheck
import { SelectNpcToken } from '../models/select_npc_token.model';
import { DeleteResult } from 'mongodb';

/**
 * NPC 선택 토큰 리포지토리
 */
class SelectNpcTokenRepository {
  async findBySession(sessionId: string) {
    return SelectNpcToken.find({ session_id: sessionId });
  }

  async findByUser(sessionId: string, userId: string) {
    return SelectNpcToken.find({ 
      session_id: sessionId, 
      user_id: userId 
    });
  }

  async create(data: any) {
    return SelectNpcToken.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return SelectNpcToken.deleteMany({ session_id: sessionId });
  }
}

export const selectNpcTokenRepository = new SelectNpcTokenRepository();
