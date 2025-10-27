import { CommandRepository } from '../repository/command.repository';
import { CommandQueue } from '../../../infrastructure/queue/command-queue';
import { ICommand, CommandType, SubmitCommandDto } from '../../../@types';
import { HttpException } from '../../../common/errors/HttpException';

/**
 * Command Service (비즈니스 로직 계층)
 * 
 * CQRS 핵심:
 * - submit: Redis Streams에 발행만 (DB 쓰기 없음)
 * - 조회: DB에서 읽기
 */
export class CommandService {
  constructor(
    private repository: CommandRepository,
    private commandQueue: CommandQueue
  ) {}

  /**
   * 명령 제출 (Redis Streams 발행)
   * 
   * API 서버는 DB를 직접 변경하지 않음
   * Game Daemon이 실제 처리
   */
  async submit(dto: SubmitCommandDto): Promise<{ messageId: string }> {
    // TODO: 간단한 검증 (형식 검증)
    if (!dto.generalId || !dto.type || !dto.payload) {
      throw new HttpException(400, 'Invalid command data');
    }

    // TODO: 명령 타입 검증
    if (!Object.values(CommandType).includes(dto.type)) {
      throw new HttpException(400, 'Invalid command type');
    }

    // TODO: Redis Streams에 발행
    const messageId = await this.commandQueue.publish({
      generalId: dto.generalId,
      type: dto.type,
      payload: dto.payload,
    });

    return { messageId };
  }

  /**
   * ID로 조회
   */
  async getById(id: string): Promise<ICommand | null> {
    // TODO: 구현
    return await this.repository.findById(id);
  }

  /**
   * 장수별 명령 조회
   */
  async getByGeneralId(
    generalId: string,
    limit: number,
    skip: number
  ): Promise<ICommand[]> {
    // TODO: 구현
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  /**
   * 실행 중인 명령 조회
   */
  async getExecuting(): Promise<ICommand[]> {
    // TODO: 구현
    return await this.repository.findExecuting();
  }
}
