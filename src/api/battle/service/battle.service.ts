import { BattleRepository } from '../repository/battle.repository';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { HttpException } from '../../../common/errors/HttpException';
import { EntityRepository } from '../../../common/repository/entity-repository';
import {
  StartBattleDto,
  IBattleSession,
  IBattleUnit,
  BattleStatus,
  BattleMode,
  BattleFinalizedEvent,
} from '../@types/battle.types';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Battle Service
 * 
 * 전투 세션 관리 및 병력 예약/정산 처리
 * - EntityRepository를 통한 Entity 기반 병력 관리
 * - Lua 스크립트를 통한 원자적 병력 예약/정산
 */
export class BattleService {
  private redis: RedisService;
  private luaScriptSha?: string;

  constructor(private repository: BattleRepository) {
    this.redis = new RedisService();
    this.loadLuaScript();
  }

  /**
   * Lua 스크립트 로드 및 SHA 등록
   */
  private async loadLuaScript(): Promise<void> {
    try {
      const scriptPath = path.join(__dirname, '../../../infrastructure/lua/battle-reservation.lua');
      const script = fs.readFileSync(scriptPath, 'utf-8');
      const client = this.redis.getClient();
      this.luaScriptSha = (await client.script('LOAD', script)) as string;
    } catch (error) {
      console.error('Lua 스크립트 로드 실패:', error);
    }
  }

  /**
   * 전투 시작
   * 
   * 1. Entity 조회 및 검증
   * 2. Lua 스크립트로 병력 예약 (reserveTroops)
   * 3. BattleSession 생성
   * 4. BattleUnit 생성 (Entity 속성 기반)
   * 5. 웹소켓 이벤트 발행
   */
  async startBattle(dto: StartBattleDto): Promise<IBattleSession> {
    const { sessionId, attackerCommanderIds, targetCityId } = dto;

    // 1. Entity 조회 및 검증
    if (!attackerCommanderIds || attackerCommanderIds.length === 0) {
      throw new HttpException(400, '공격 지휘관이 필요합니다.');
    }

    // 전투 ID 생성
    const battleId = randomUUID();

    // 2. 각 지휘관별 병력 예약 (Lua 스크립트 호출)
    const reservationResults: Array<{ commanderId: string; troops: number; entity: any }> = [];
    
    for (const commanderId of attackerCommanderIds) {
      // Entity 조회 (scenario, role, id는 commanderId에서 파싱 필요)
      // TODO: commanderId 포맷 정의 필요 (예: "scenario:role:id")
      const parts = commanderId.split(':');
      const scenario = parts[0];
      const role = parts[1] as any; // Role enum으로 변환
      const id = parts[2];
      
      const entity = await EntityRepository.findById({ scenario, role, id });
      
      if (!entity) {
        throw new HttpException(404, `지휘관을 찾을 수 없습니다: ${commanderId}`);
      }

      // Entity의 resources에서 병력 정보 조회
      const crewTotal = entity.resources?.crew_total || 0;
      const crewReserved = entity.resources?.crew_reserved || 0;
      const available = crewTotal - crewReserved;

      if (available <= 0) {
        throw new HttpException(400, `사용 가능한 병력이 없습니다: ${commanderId}`);
      }

      // 병력 예약 (모든 가용 병력을 전투에 투입)
      const reserveAmount = available;
      
      try {
        await this.reserveTroops(sessionId, commanderId, battleId, reserveAmount);
        reservationResults.push({ 
          commanderId, 
          troops: reserveAmount,
          entity 
        });
      } catch (error: any) {
        throw new HttpException(400, `병력 예약 실패 (${commanderId}): ${error.message}`);
      }
    }

    // 3. BattleSession 생성
    const battleSession: IBattleSession = {
      id: battleId,
      sessionId,
      attackerNationId: '', // TODO: Entity의 Edge를 통해 국가 조회 필요
      defenderNationId: '', // TODO: 목표 도시의 국가 ID 조회 필요
      targetCityId,
      mode: BattleMode.TURN_BASED,
      gridSize: { width: 40, height: 40 },
      attackerCommanders: attackerCommanderIds,
      defenderCommanders: [], // TODO: 수비 지휘관 자동 배치 로직 필요
      status: BattleStatus.PREPARING,
      currentRound: 0,
      currentTick: 0,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Redis에 BattleSession 저장
    const battleKey = `s:${sessionId}:battle:${battleId}`;
    await this.redis.set(battleKey, battleSession, 3600); // 1시간 TTL

    // 4. BattleUnit 생성 (Entity 속성 기반)
    for (const { commanderId, troops, entity } of reservationResults) {
      const unit: IBattleUnit = {
        id: randomUUID(),
        battleId,
        commanderId,
        troops_reserved: troops,
        troops_current: troops,
        unitType: entity.resources?.crewType || 0,
        position: { x: 5, y: 20 }, // TODO: 초기 배치 로직 필요
        hp: troops,
        maxHp: troops,
        attack: entity.attributes?.attack || 100,
        defense: entity.attributes?.defense || 100,
        speed: entity.attributes?.speed || 10,
        morale: entity.resources?.morale || 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Redis에 BattleUnit 저장
      const unitKey = `s:${sessionId}:battle:${battleId}:unit:${unit.id}`;
      await this.redis.set(unitKey, unit, 3600);
    }

    // 5. 웹소켓 이벤트 발행
    await this.redis.publish(`battle:${battleId}`, {
      type: 'BATTLE_STARTED',
      battleId,
      timestamp: Date.now(),
      data: {
        attackerCommanders: attackerCommanderIds,
        targetCityId,
      },
    });

    return battleSession;
  }

  /**
   * 전투 종료
   * 
   * 1. Lua 스크립트로 병력 정산 (finalizeBattle)
   * 2. 전사 지휘관 처리 (status='dead')
   * 3. 결과 저장
   * 4. 웹소켓 이벤트 발행
   */
  async finalizeBattle(battleId: string): Promise<void> {
    const client = this.redis.getClient();

    // BattleSession 조회
    const battleKeys = await client.keys(`s:*:battle:${battleId}`);
    if (battleKeys.length === 0) {
      throw new HttpException(404, '전투 세션을 찾을 수 없습니다.');
    }

    const battleKey = battleKeys[0];
    const battleData = await this.redis.get<IBattleSession>(battleKey);
    
    if (!battleData) {
      throw new HttpException(404, '전투 데이터를 찾을 수 없습니다.');
    }

    const { sessionId, attackerCommanders, defenderCommanders } = battleData;

    // BattleUnit 조회 및 손실 계산
    const unitKeys = await client.keys(`s:${sessionId}:battle:${battleId}:unit:*`);
    const casualties: Record<string, number> = {};
    const killedCommanders: string[] = [];

    for (const unitKey of unitKeys) {
      const unit = await this.redis.get<IBattleUnit>(unitKey);
      if (!unit) continue;

      const { commanderId, troops_reserved, troops_current } = unit;
      const casualty = troops_reserved - troops_current;
      
      casualties[commanderId] = casualty;

      // 1. Lua 스크립트로 병력 정산
      try {
        await this.applyBattleCasualties(sessionId, commanderId, battleId, casualty);
      } catch (error: any) {
        console.error(`병력 정산 실패 (${commanderId}):`, error.message);
      }

      // 2. 전사 처리 (병력이 0이 된 경우)
      if (troops_current <= 0) {
        killedCommanders.push(commanderId);
        
        // Entity 상태를 'dead'로 변경
        const parts = commanderId.split(':');
        const scenario = parts[0];
        const role = parts[1] as any; // Role enum으로 변환
        const id = parts[2];
        
        const entity = await EntityRepository.findById({ scenario, role, id });
        
        if (entity) {
          await EntityRepository.patch(
            { scenario, role, id },
            { 'metadata.status': 'dead' },
            entity.version
          );
        }
      }
    }

    // 3. 결과 저장
    const result = {
      winner: 'attacker' as const, // TODO: 실제 승패 판정 로직 필요
      casualties,
      killedCommanders,
    };

    battleData.result = result;
    battleData.status = BattleStatus.COMPLETED;
    battleData.completedAt = new Date();
    battleData.updatedAt = new Date();

    await this.redis.set(battleKey, battleData, 3600);

    // 4. 웹소켓 이벤트 발행
    const event: BattleFinalizedEvent = {
      type: 'BATTLE_FINALIZED',
      battleId,
      timestamp: Date.now(),
      version: 1,
      data: {
        winner: result.winner,
        casualties,
        killedCommanders,
      },
    };

    await this.redis.publish(`battle:${battleId}`, event);
  }

  /**
   * 병력 예약 (Lua 스크립트 호출)
   * 
   * @param sessionId 게임 세션 ID
   * @param commanderId 지휘관 ID
   * @param battleId 전투 ID
   * @param amount 예약할 병력 수
   */
  async reserveTroops(
    sessionId: string,
    commanderId: string,
    battleId: string,
    amount: number
  ): Promise<void> {
    if (!this.luaScriptSha) {
      throw new HttpException(500, 'Lua 스크립트가 로드되지 않았습니다.');
    }

    // Entity 키 생성 (Redis)
    const entityKey = `s:${sessionId}:entity:${commanderId}`;
    const client = this.redis.getClient();

    try {
      const result = await client.evalsha(
        this.luaScriptSha,
        1,
        entityKey,
        'reserve',
        battleId,
        amount.toString()
      );

      if (result && typeof result === 'object' && 'err' in result) {
        throw new HttpException(400, (result as any).err);
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(500, `병력 예약 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 전투 손실 적용 (Lua 스크립트 호출)
   * 
   * @param sessionId 게임 세션 ID
   * @param commanderId 지휘관 ID
   * @param battleId 전투 ID
   * @param casualties 사상자 수
   */
  async applyBattleCasualties(
    sessionId: string,
    commanderId: string,
    battleId: string,
    casualties: number
  ): Promise<void> {
    if (!this.luaScriptSha) {
      throw new HttpException(500, 'Lua 스크립트가 로드되지 않았습니다.');
    }

    // Entity 키 생성 (Redis)
    const entityKey = `s:${sessionId}:entity:${commanderId}`;
    const client = this.redis.getClient();

    try {
      const result = await client.evalsha(
        this.luaScriptSha,
        1,
        entityKey,
        'finalize',
        battleId,
        casualties.toString()
      );

      if (result && typeof result === 'object' && 'err' in result) {
        throw new HttpException(400, (result as any).err);
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(500, `병력 정산 중 오류 발생: ${error.message}`);
    }
  }

  async findByCommanderId(sessionId: string, commanderId: string) {
    return await this.repository.findByCommanderId(sessionId, commanderId);
  }

  async findActive(sessionId: string) {
    return await this.repository.findActive(sessionId);
  }
}
