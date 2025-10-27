import { CommandModel, ICommandDocument } from '../model/command.model';
import { ICommand, CommandStatus } from '../@types/command.types';

/**
 * Command Repository (데이터 접근 계층)
 */
export class CommandRepository {
  /**
   * ID로 조회
   */
  async findById(id: string): Promise<ICommand | null> {
    // TODO: 구현
    const command = await CommandModel.findById(id).lean().exec();
    return command as ICommand | null;
  }

  /**
   * 장수별 조회
   */
  async findByGeneralId(
    generalId: string,
    limit = 20,
    skip = 0
  ): Promise<ICommand[]> {
    // TODO: 구현
    const commands = await CommandModel.find({ generalId })
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
  async findExecuting(): Promise<ICommand[]> {
    // TODO: 구현
    const commands = await CommandModel.find({
      status: CommandStatus.EXECUTING,
    })
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 완료 예정 명령 조회 (시간 기준)
   */
  async findCompletable(before: Date): Promise<ICommand[]> {
    // TODO: 구현
    const commands = await CommandModel.find({
      status: CommandStatus.EXECUTING,
      completionTime: { $lte: before },
    })
      .lean()
      .exec();

    return commands as ICommand[];
  }

  /**
   * 생성
   */
  async create(data: Partial<ICommand>): Promise<ICommand> {
    // TODO: 구현
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
    // TODO: 구현
    const update: any = { status };
    if (result !== undefined) update.result = result;
    if (error !== undefined) update.error = error;

    const command = await CommandModel.findByIdAndUpdate(id, update, {
      new: true,
    }).exec();

    return command ? (command.toObject() as ICommand) : null;
  }
}
