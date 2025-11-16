import { TournamentService } from '../tournament.service';

/**
 * GetTournamentInfo Service
 * 토너먼트 정보 조회 (TournamentService 래퍼)
 */
export class GetTournamentInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // TournamentService 재사용
      return await TournamentService.getTournamentInfo(sessionId);
    } catch (error: any) {
      // 시스템 오류는 라우터에서 5xx로 처리할 수 있도록 그대로 throw
      throw error;
    }
  }
}

