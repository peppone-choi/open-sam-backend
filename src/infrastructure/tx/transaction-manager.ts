import mongoose, { ClientSession } from 'mongoose';
import { GeneralRepository } from '../../api/general/repository/general.repository';
import { CityRepository } from '../../api/city/repository/city.repository';
import { NationRepository } from '../../api/nation/repository/nation.repository';
import { CommandRepository } from '../../api/command/repository/command.repository';
import { MessageRepository } from '../../api/message/repository/message.repository';

/**
 * 트랜잭션 내에서 사용할 리포지토리 컨텍스트
 */
export interface RepositoryContext {
  generalRepo: GeneralRepository;
  cityRepo: CityRepository;
  nationRepo: NationRepository;
  commandRepo: CommandRepository;
  messageRepo: MessageRepository;
  session: ClientSession;
}

/**
 * MongoDB 트랜잭션 관리자
 * 
 * 커맨드 처리 시 원자성(Atomicity)을 보장:
 * - 성공: 모든 변경사항 커밋
 * - 실패: 모든 변경사항 롤백
 */
export class TransactionManager {
  /**
   * 트랜잭션 내에서 함수 실행
   * 
   * @param fn - 트랜잭션 내에서 실행할 함수
   * @returns 함수 실행 결과
   */
  async runInTransaction<T>(
    fn: (repositories: RepositoryContext) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 세션이 적용된 리포지토리 컨텍스트 생성
      const repositories: RepositoryContext = {
        generalRepo: new GeneralRepository(),
        cityRepo: new CityRepository(),
        nationRepo: new NationRepository(),
        commandRepo: new CommandRepository(),
        messageRepo: new MessageRepository(),
        session,
      };

      // 비즈니스 로직 실행
      const result = await fn(repositories);

      // 커밋
      await session.commitTransaction();
      console.log('트랜잭션 커밋 완료');

      return result;
    } catch (error) {
      // 롤백
      await session.abortTransaction();
      console.error('트랜잭션 롤백:', error);
      throw error;
    } finally {
      // 세션 종료
      session.endSession();
    }
  }

  /**
   * 읽기 전용 트랜잭션 실행 (스냅샷 격리)
   */
  async runReadOnly<T>(
    fn: (repositories: RepositoryContext) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction({
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
    });

    try {
      const repositories: RepositoryContext = {
        generalRepo: new GeneralRepository(),
        cityRepo: new CityRepository(),
        nationRepo: new NationRepository(),
        commandRepo: new CommandRepository(),
        messageRepo: new MessageRepository(),
        session,
      };

      const result = await fn(repositories);
      await session.commitTransaction();

      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
