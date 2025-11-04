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
      return {
        result: false,
        reason: error.message || '토너먼트 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}

