import { GameSessionRepository } from '../repository/game-session.repository';
import { IGameSession, IScenarioTemplate } from '../@types/game-session.types';
import { EntityRepository } from '../../../common/repository/entity-repository';
import { Role, createRef } from '../../../common/@types/role.types';
import { HttpException } from '../../../common/errors/HttpException';

/**
 * GameSession Service (비즈니스 로직 계층)
 * 
 * 게임 세션 관련 조회 및 관리 기능 제공
 * 
 * Entity 시스템 통합:
 * - GameSession 생성 시 Entity 초기화
 * - 시나리오 템플릿 기반 Entity 생성 (General, City, Nation, Commander)
 * - EntityRepository를 통한 통계 계산
 * 
 * 게임 진행(턴 처리 등)은 Game Daemon에서 처리
 */
export class GameSessionService {
  constructor(private repository: GameSessionRepository) {}

  /**
   * ID로 세션 조회
   */
  async getById(id: string): Promise<IGameSession | null> {
    return await this.repository.findById(id);
  }

  /**
   * 전체 세션 조회
   */
  async getAll(limit: number, skip: number): Promise<IGameSession[]> {
    return await this.repository.findAll(limit, skip);
  }

  /**
   * 세션 생성 (Entity 기반 초기화 포함)
   * 
   * 1. GameSession 생성
   * 2. 시나리오 템플릿 로드 (TODO: ScenarioLoader 구현)
   * 3. Entity 초기화 (General, City, Nation, Commander)
   * 4. 통계 계산 및 업데이트
   */
  async create(data: Partial<IGameSession>): Promise<IGameSession> {
    // 1. GameSession 생성
    const session = await this.repository.create(data);

    // 2. Entity 초기화 (시나리오 템플릿 기반)
    try {
      await this.initializeEntities(session);
    } catch (error: any) {
      console.error(`Entity 초기화 실패 (session: ${session.id}):`, error.message);
      // Entity 초기화 실패 시에도 세션은 유지 (나중에 재시도 가능)
    }

    return session;
  }

  /**
   * Entity 초기화 (시나리오 템플릿 기반)
   * 
   * @param session GameSession
   */
  private async initializeEntities(session: IGameSession): Promise<void> {
    // TODO: 시나리오 템플릿 로더 구현 필요
    // const template = await ScenarioLoader.load(session.scenarioId);
    
    // 임시: 빈 시나리오로 초기화
    const scenarioId = session.scenarioId;

    // 예시: 초기 Entity 생성 (실제로는 시나리오 템플릿에서 로드)
    // General, City, Nation, Commander 등을 EntityRepository.create()로 생성
    
    // 통계 업데이트
    await this.updateStats(session.id);
  }

  /**
   * 통계 업데이트 (Entity 기반 동적 계산)
   */
  async updateStats(sessionId: string): Promise<void> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new HttpException(404, '게임 세션을 찾을 수 없습니다.');
    }

    const scenarioId = session.scenarioId;

    // Entity 카운트 조회
    const [totalGenerals, totalCities, totalNations, activePlayers] = await Promise.all([
      EntityRepository.count(scenarioId, Role.COMMANDER), // 장수 = COMMANDER
      EntityRepository.count(scenarioId, Role.SETTLEMENT), // 도시 = SETTLEMENT
      EntityRepository.count(scenarioId, Role.FACTION), // 국가 = FACTION
      EntityRepository.count(scenarioId, Role.COMMANDER), // 플레이어도 COMMANDER
    ]);

    // 통계 업데이트
    await this.repository.update(sessionId, {
      stats: {
        totalGenerals,
        totalCities,
        totalNations,
        activePlayers,
      },
    });
  }

  /**
   * 세션 업데이트
   */
  async update(id: string, data: Partial<IGameSession>): Promise<IGameSession | null> {
    return await this.repository.update(id, data);
  }

  /**
   * 세션 삭제
   * 
   * 주의: 연관된 Entity는 별도로 삭제해야 함
   */
  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  /**
   * 상태별 세션 조회
   */
  async getByStatus(status: IGameSession['status'], limit: number, skip: number): Promise<IGameSession[]> {
    return await this.repository.findByStatus(status, limit, skip);
  }

  /**
   * 시나리오 ID별 세션 조회
   */
  async getByScenarioId(scenarioId: string): Promise<IGameSession[]> {
    return await this.repository.findByScenarioId(scenarioId);
  }

  /**
   * 세션 카운트
   */
  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
