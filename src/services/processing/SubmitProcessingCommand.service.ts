import { General } from '../../models/general.model';

/**
 * SubmitProcessingCommand Service
 * 명령 제출 (ReserveCommandService 재사용)
 */
export class SubmitProcessingCommandService {
  static async execute(data: any, user?: any) {
    // ReserveCommandService 사용
    const { ReserveCommandService } = await import('../command/ReserveCommand.service');
    return await ReserveCommandService.execute(data, user);
  }
}

