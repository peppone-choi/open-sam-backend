import { GeneralRepository } from '../repository/general.repository';
import { CacheManager } from '../../../infrastructure/cache/cache-manager';
import { CommandQueue } from '../../../infrastructure/queue/command-queue';
import { IGeneral } from '../../../@types';
import { HttpException } from '../../../common/errors/HttpException';

/**
 * General Service (비즈니스 로직 계층)
 * 
 * CQRS 패턴:
 * - 읽기: Repository + Cache 사용
 * - 쓰기: CommandQueue에 발행만 (실제 쓰기는 Daemon에서 처리)
 */
export class GeneralService {
  constructor(
    private repository: GeneralRepository,
    private cacheManager: CacheManager,
    private commandQueue: CommandQueue
  ) {}

  /**
   * ID로 조회 (캐시 활용)
   */
  async getById(id: string): Promise<IGeneral | null> {
    // TODO: 캐시 키 생성
    const cacheKey = `cache:general:${id}`;

    // TODO: L1/L2 캐시 확인
    const cached = await this.cacheManager.get<IGeneral>(cacheKey);
    if (cached) {
      return cached;
    }

    // TODO: DB에서 조회
    const general = await this.repository.findById(id);

    // TODO: 캐시에 저장 (3초 TTL)
    if (general) {
      await this.cacheManager.set(cacheKey, general, 3);
    }

    return general;
  }

  /**
   * 전체 조회 (페이지네이션)
   */
  async getAll(limit: number, skip: number): Promise<IGeneral[]> {
    // TODO: 구현
    return await this.repository.findAll(limit, skip);
  }

  /**
   * 국가별 조회
   */
  async getByNationId(
    nationId: string,
    limit: number,
    skip: number
  ): Promise<IGeneral[]> {
    // TODO: 구현
    return await this.repository.findByNationId(nationId, limit, skip);
  }

  /**
   * 장수 훈련 명령 발행
   * 
   * CQRS: DB를 직접 변경하지 않고 명령만 발행
   * 실제 처리는 Game Daemon에서 수행
   */
  async trainGeneral(
    generalId: string,
    statType: 'leadership' | 'strength' | 'intel' | 'politics',
    amount: number
  ): Promise<void> {
    // TODO: 간단한 검증 (형식 검증)
    if (amount <= 0 || amount > 100) {
      throw new HttpException(400, 'Invalid training amount');
    }

    // TODO: 명령 발행
    await this.commandQueue.publish({
      generalId,
      type: 'TRAIN_GENERAL' as any,
      payload: { statType, amount },
    });
  }

  /**
   * 총 개수
   */
  async count(filter?: Record<string, any>): Promise<number> {
    // TODO: 구현
    return await this.repository.count(filter);
  }
}
