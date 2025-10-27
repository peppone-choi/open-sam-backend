import { RedisService } from '../../../infrastructure/cache/redis.service';
import { IBattleSession, BattleStatus } from '../@types/battle.types';

/**
 * Battle Repository
 * 
 * Redis 기반 전투 세션 관리
 * - Entity와 연동
 * - BattleSession 조회/검색
 */
export class BattleRepository {
  private redis: RedisService;

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 지휘관 ID로 전투 조회
   */
  async findByCommanderId(sessionId: string, commanderId: string): Promise<IBattleSession[]> {
    const client = this.redis.getClient();
    const battleKeys = await client.keys(`s:${sessionId}:battle:*`);
    
    const battles: IBattleSession[] = [];
    
    for (const key of battleKeys) {
      const battle = await this.redis.get<IBattleSession>(key);
      
      if (!battle) continue;
      
      // 공격자 또는 수비자에 포함되어 있는지 확인
      if (
        battle.attackerCommanders.includes(commanderId) ||
        battle.defenderCommanders.includes(commanderId)
      ) {
        battles.push(battle);
      }
    }
    
    return battles;
  }
  
  /**
   * 진행 중인 전투 조회
   */
  async findActive(sessionId: string): Promise<IBattleSession[]> {
    const client = this.redis.getClient();
    const battleKeys = await client.keys(`s:${sessionId}:battle:*`);
    
    const battles: IBattleSession[] = [];
    
    for (const key of battleKeys) {
      const battle = await this.redis.get<IBattleSession>(key);
      
      if (!battle) continue;
      
      // PREPARING 또는 IN_PROGRESS 상태인 전투만 조회
      if (
        battle.status === BattleStatus.PREPARING ||
        battle.status === BattleStatus.IN_PROGRESS
      ) {
        battles.push(battle);
      }
    }
    
    return battles;
  }

  /**
   * 전투 ID로 조회
   */
  async findById(sessionId: string, battleId: string): Promise<IBattleSession | null> {
    const battleKey = `s:${sessionId}:battle:${battleId}`;
    return await this.redis.get<IBattleSession>(battleKey);
  }

  /**
   * 전투 저장
   */
  async save(sessionId: string, battle: IBattleSession): Promise<void> {
    const battleKey = `s:${sessionId}:battle:${battle.id}`;
    await this.redis.set(battleKey, battle, 3600); // 1시간 TTL
  }

  /**
   * 전투 삭제
   */
  async delete(sessionId: string, battleId: string): Promise<void> {
    const battleKey = `s:${sessionId}:battle:${battleId}`;
    const client = this.redis.getClient();
    await client.del(battleKey);
  }

  /**
   * 세션의 모든 전투 조회
   */
  async findAll(sessionId: string): Promise<IBattleSession[]> {
    const client = this.redis.getClient();
    const battleKeys = await client.keys(`s:${sessionId}:battle:*`);
    
    const battles: IBattleSession[] = [];
    
    for (const key of battleKeys) {
      // unit, intent 등의 키는 제외
      if (key.includes(':unit:') || key.includes(':intent:')) {
        continue;
      }
      
      const battle = await this.redis.get<IBattleSession>(key);
      if (battle) {
        battles.push(battle);
      }
    }
    
    return battles;
  }

  /**
   * 도시 ID로 전투 조회
   */
  async findByTargetCity(sessionId: string, targetCityId: string): Promise<IBattleSession[]> {
    const client = this.redis.getClient();
    const battleKeys = await client.keys(`s:${sessionId}:battle:*`);
    
    const battles: IBattleSession[] = [];
    
    for (const key of battleKeys) {
      const battle = await this.redis.get<IBattleSession>(key);
      
      if (!battle) continue;
      
      if (battle.targetCityId === targetCityId) {
        battles.push(battle);
      }
    }
    
    return battles;
  }
}
