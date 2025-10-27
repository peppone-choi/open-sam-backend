import { CommandModel, ICommandDocument } from '../model/command.model';
import { ICommand, CommandStatus } from '../@types/command.types';

/**
 * Command Repository (데이터 접근 계층)
 * 
 * Entity 시스템과 호환 유지:
 * - MongoDB 컬렉션 사용 (기존 호환성)
 * - Entity Repository 패턴 준수
 */
export class CommandRepository {
  /**
   * ID로 조회
   */
  async findById(id: string): Promise<ICommand | null> {
    const command = await CommandModel.findById(id).lean().exec();
    return command as ICommand | null;
  }

  /**
   * 지휘관별 조회
   */
  async findByCommanderId(
    commanderId: string,
    limit = 20,
    skip = 0
  ): Promise<ICommand[]> {
    const commands = await CommandModel.find({ commanderId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 세션 + 지휘관별 조회
   */
  async findBySessionAndCommander(
    sessionId: string,
    commanderId: string,
    limit = 20,
    skip = 0
  ): Promise<ICommand[]> {
    const commands = await CommandModel.find({ sessionId, commanderId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 실행 중인 명령 조회
   */
  async findExecuting(sessionId?: string): Promise<ICommand[]> {
    const query: any = {
      status: CommandStatus.EXECUTING,
    };
    
    if (sessionId) {
      query.sessionId = sessionId;
    }

    const commands = await CommandModel.find(query)
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 완료 예정 명령 조회 (시간 기준)
   */
  async findCompletable(before: Date, sessionId?: string): Promise<ICommand[]> {
    const query: any = {
      status: CommandStatus.EXECUTING,
      completionTime: { $lte: before },
    };
    
    if (sessionId) {
      query.sessionId = sessionId;
    }

    const commands = await CommandModel.find(query)
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 생성
   */
  async create(data: Partial<ICommand>): Promise<ICommand> {
    const command = new CommandModel(data);
    await command.save();
    return command.toObject() as ICommand;
  }

  /**
   * 상태 업데이트
   */
  async updateStatus(
    id: string,
    status: CommandStatus,
    result?: any,
    error?: string
  ): Promise<ICommand | null> {
    const update: any = { 
      status,
      updatedAt: new Date(),
    };
    
    if (result !== undefined) update.result = result;
    if (error !== undefined) update.error = error;
    if (status === CommandStatus.EXECUTING && !update.startTime) {
      update.startTime = new Date();
    }
    if (status === CommandStatus.COMPLETED || status === CommandStatus.FAILED) {
      update.completionTime = new Date();
    }

    const command = await CommandModel.findByIdAndUpdate(id, update, {
      new: true,
    }).exec();

    return command ? (command.toObject() as ICommand) : null;
  }

  /**
   * 삭제
   */
  async delete(id: string): Promise<boolean> {
    const result = await CommandModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * 세션별 카운트
   */
  async countBySession(sessionId: string, status?: CommandStatus): Promise<number> {
    const query: any = { sessionId };
    if (status) {
      query.status = status;
    }
    return await CommandModel.countDocuments(query).exec();
  }
}
