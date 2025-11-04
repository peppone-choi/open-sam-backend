import { General } from '../../models/general.model';
import { GeneralTurn } from '../../models/general_turn.model';

/**
 * GetProcessingCommand Service
 * 명령 데이터 조회
 */
export class GetProcessingCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        const general = await (General as any).findOne({
          session_id: sessionId,
          owner: String(userId),
          'data.npc': { $lt: 2 }
        });
        
        if (!general) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
      }
      
      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      // 예약된 명령 조회
      const turns = await (GeneralTurn as any).find({
        session_id: sessionId,
        'data.general_id': generalId
      }).sort({ 'data.turn_idx': 1 }).limit(30);
      
      const commandList = turns.map((turn: any) => ({
        turn_idx: turn.data.turn_idx,
        action: turn.data.action || '',
        arg: typeof turn.data.arg === 'string' ? JSON.parse(turn.data.arg) : (turn.data.arg || {}),
        brief: turn.data.brief || ''
      }));
      
      return {
        result: true,
        command: {
          generalId,
          commands: commandList,
          totalTurns: commandList.length
        }
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '명령 데이터 조회 중 오류가 발생했습니다'
      };
    }
  }
}

