import { ProcessIncome } from '../../core/event/Action/ProcessIncome';
import { sessionRepository } from '../../repositories/session.repository';
import { ApiError } from '../../errors/ApiError';

export class AdminEconomyService {
  static async paySalary(sessionId: string, resource: 'gold' | 'rice') {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new ApiError(404, '세션을 찾을 수 없습니다');
    }

    const sessionData = session.data || {};
    const gameEnv = sessionData.game_env || {};
    const env = {
      session_id: sessionId,
      year: sessionData.year || gameEnv.year || session.year || gameEnv.startyear || 184,
      month: sessionData.month || gameEnv.month || session.month || 1
    };

    const income = new ProcessIncome(resource);
    await income.run(env);

    const message = resource === 'gold'
      ? '금 봉급 지급이 완료되었습니다'
      : '군량 봉급 지급이 완료되었습니다';

    return {
      result: true,
      reason: message
    };
  }
}
