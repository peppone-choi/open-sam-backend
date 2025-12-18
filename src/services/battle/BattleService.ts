// @ts-nocheck - Type issues need investigation
import { randomUUID } from 'crypto';
import { battleRepository } from '../../repositories/battle.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
// 스택 시스템 제거됨
import { cityDefenseRepository } from '../../repositories/city-defense.repository';
import { Battle, BattleStatus, BattlePhase, IBattleUnit } from '../../models/battle.model';
import { StartBattleService } from './StartBattle.service';
import * as BattleEventHook from './BattleEventHook.service';
import { getSocketManager } from '../../socket/socketManager';
import { logger } from '../../common/logger';
import { ActionLogger } from '../logger/ActionLogger';
import { LogFormatType } from '../../types/log.types';
import { GameEventEmitter } from '../gameEventEmitter';

/**
 * 전투 서비스
 * 토탈워 스타일 전투 시스템과 메인 게임 연동
 */
export class BattleService {
  
  // ============================================
  // 전투 조회
  // ============================================

  /**
   * 전투 목록 조회
   */
  async findBattles(params: {
    sessionId: string;
    status?: string;
    nationId?: number;
    limit?: number;
  }) {
    const { sessionId, status = 'active', nationId, limit = 20 } = params;
    
    let query: any = { session_id: sessionId };
    
    // 상태 필터
    if (status === 'active') {
      query.status = { $in: [BattleStatus.PREPARING, BattleStatus.DEPLOYING, BattleStatus.IN_PROGRESS] };
    } else if (status === 'completed') {
      query.status = BattleStatus.COMPLETED;
    }
    
    // 국가 필터
    if (nationId) {
      query.$or = [
        { attackerNationId: nationId },
        { defenderNationId: nationId }
      ];
    }
    
    return Battle.find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .select({
        battleId: 1,
        session_id: 1,
        status: 1,
        currentPhase: 1,
        attackerNationId: 1,
        defenderNationId: 1,
        targetCityId: 1,
        terrain: 1,
        currentTurn: 1,
        winner: 1,
        startedAt: 1,
        completedAt: 1,
        'attackerUnits.generalId': 1,
        'attackerUnits.generalName': 1,
        'attackerUnits.troops': 1,
        'defenderUnits.generalId': 1,
        'defenderUnits.generalName': 1,
        'defenderUnits.troops': 1
      })
      .lean();
  }

  /**
   * 전투 상세 조회
   */
  async getBattleById(battleId: string) {
    return Battle.findOne({ battleId }).lean();
  }

  /**
   * 전투 실시간 상태 조회
   */
  async getBattleState(battleId: string) {
    const battle = await Battle.findOne({ battleId }).lean();
    if (!battle) return null;
    
    return {
      battleId: battle.battleId,
      status: battle.status,
      currentPhase: battle.currentPhase,
      currentTurn: battle.currentTurn,
      attackerUnits: battle.attackerUnits?.map(this.mapUnitToState),
      defenderUnits: battle.defenderUnits?.map(this.mapUnitToState),
      map: battle.map,
      isRealtime: battle.isRealtime,
      currentTick: battle.currentTick
    };
  }

  /**
   * 유닛 상태 매핑
   */
  private mapUnitToState(unit: any) {
    return {
      id: unit.generalId,
      generalId: unit.generalId,
      generalName: unit.generalName,
      troops: unit.troops,
      maxTroops: unit.maxTroops,
      position: unit.position,
      velocity: unit.velocity,
      facing: unit.facing,
      morale: unit.morale,
      stance: unit.stance,
      formation: unit.formation,
      isCharging: unit.isCharging,
      status: unit.troops > 0 ? 'active' : 'destroyed'
    };
  }

  /**
   * 리플레이 데이터 조회
   */
  async getReplayData(battleId: string) {
    const battle = await Battle.findOne({ battleId }).lean();
    if (!battle) return null;
    
    return {
      battleId: battle.battleId,
      meta: {
        attackerNationId: battle.attackerNationId,
        defenderNationId: battle.defenderNationId,
        targetCityId: battle.targetCityId,
        terrain: battle.terrain,
        startedAt: battle.startedAt,
        completedAt: battle.completedAt,
        winner: battle.winner
      },
      initialState: {
        attackerUnits: battle.attackerUnits,
        defenderUnits: battle.defenderUnits,
        map: battle.map
      },
      turnHistory: battle.turnHistory || [],
      replayData: battle.replayData,
      tickSnapshots: battle.tickSnapshots
    };
  }

  /**
   * 전투 기록 조회 (페이징)
   */
  async getBattleHistory(params: {
    sessionId: string;
    nationId?: number;
    generalId?: number;
    page: number;
    limit: number;
  }) {
    const { sessionId, nationId, generalId, page, limit } = params;
    
    let query: any = { 
      session_id: sessionId,
      status: BattleStatus.COMPLETED
    };
    
    // 국가 필터
    if (nationId) {
      query.$or = [
        { attackerNationId: nationId },
        { defenderNationId: nationId }
      ];
    }
    
    // 장수 필터
    if (generalId) {
      query.$or = [
        { 'attackerUnits.generalId': generalId },
        { 'defenderUnits.generalId': generalId }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [battles, total] = await Promise.all([
      Battle.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          battleId: 1,
          status: 1,
          attackerNationId: 1,
          defenderNationId: 1,
          targetCityId: 1,
          terrain: 1,
          winner: 1,
          startedAt: 1,
          completedAt: 1,
          'meta.initialAttackerTroops': 1,
          'meta.initialDefenderTroops': 1,
          'meta.cityName': 1
        })
        .lean(),
      Battle.countDocuments(query)
    ]);
    
    return { battles, total };
  }

  // ============================================
  // 전투 생성 및 제어
  // ============================================

  /**
   * 전투 시작
   */
  async startBattle(data: {
    session_id: string;
    attackerNationId: number;
    defenderNationId: number;
    attackerGeneralIds: number[];
    targetCityId: number;
    battleType?: string;
    multiStackMode?: boolean;
    environment?: any;
  }) {
    // StartBattleService 사용
    return StartBattleService.execute(data);
  }

  /**
   * 유닛 배치
   */
  async deployUnit(data: {
    battleId: string;
    generalId: number;
    unitId?: string;
    position: { x: number; y: number };
    formation?: string;
  }) {
    const battle = await Battle.findOne({ battleId: data.battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (battle.status !== BattleStatus.DEPLOYING && battle.status !== BattleStatus.PREPARING) {
      return { success: false, message: '배치 단계가 아닙니다' };
    }
    
    // 유닛 찾기
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
    const unit = data.unitId 
      ? allUnits.find(u => u.generalId === Number(data.unitId))
      : allUnits.find(u => u.generalId === data.generalId || u.commanderId === data.generalId);
    
    if (!unit) {
      return { success: false, message: '유닛을 찾을 수 없습니다' };
    }
    
    // 배치 영역 검증
    const isAttacker = battle.attackerUnits.some(u => u.generalId === unit.generalId);
    const zone = isAttacker ? battle.map?.attackerZone : battle.map?.defenderZone;
    
    if (zone) {
      const inZone = data.position.x >= zone.x[0] && data.position.x <= zone.x[1] &&
                     data.position.y >= zone.y[0] && data.position.y <= zone.y[1];
      if (!inZone) {
        return { success: false, message: '배치 영역을 벗어났습니다' };
      }
    }
    
    // 위치 및 진형 업데이트
    unit.position = data.position;
    if (data.formation) {
      unit.formation = data.formation;
    }
    
    await battle.save();
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${data.battleId}`).emit('battle:unit_deployed', {
        unitId: unit.generalId,
        position: data.position,
        formation: unit.formation,
        timestamp: new Date()
      });
    }
    
    return { success: true, unit };
  }

  /**
   * 준비 완료 표시
   */
  async markPlayerReady(battleId: string, generalId: number) {
    const battle = await Battle.findOne({ battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (!battle.readyPlayers) {
      battle.readyPlayers = [];
    }
    
    if (!battle.readyPlayers.includes(generalId)) {
      battle.readyPlayers.push(generalId);
    }
    
    // 모든 플레이어 준비 완료 확인
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
    const playerUnits = allUnits.filter(u => !u.isAIControlled && u.generalId > 0);
    const allReady = playerUnits.every(u => battle.readyPlayers.includes(u.generalId));
    
    let battleStarted = false;
    
    if (allReady && battle.status === BattleStatus.DEPLOYING) {
      battle.status = BattleStatus.IN_PROGRESS;
      battle.currentPhase = BattlePhase.PLANNING;
      battle.currentTurn = 1;
      battleStarted = true;
      
      logger.info(`전투 시작: ${battleId}`);
    }
    
    await battle.save();
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${battleId}`).emit('battle:player_ready', {
        generalId,
        readyPlayers: battle.readyPlayers,
        allReady,
        timestamp: new Date()
      });
      
      if (battleStarted) {
        socketManager.getIO().to(`battle:${battleId}`).emit('battle:started', {
          currentTurn: battle.currentTurn,
          timestamp: new Date()
        });
      }
    }
    
    return {
      success: true,
      readyPlayers: battle.readyPlayers,
      allReady,
      battleStarted
    };
  }

  /**
   * 전투 명령 처리
   */
  async processCommand(data: {
    battleId: string;
    generalId: number;
    unitId?: string;
    command: string;
    params: any;
  }) {
    const battle = await Battle.findOne({ battleId: data.battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (battle.status !== BattleStatus.IN_PROGRESS) {
      return { success: false, message: '전투가 진행 중이 아닙니다' };
    }
    
    // 유닛 찾기
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
    const unit = data.unitId 
      ? allUnits.find(u => String(u.generalId) === data.unitId)
      : allUnits.find(u => u.generalId === data.generalId || u.commanderId === data.generalId);
    
    if (!unit) {
      return { success: false, message: '유닛을 찾을 수 없습니다' };
    }
    
    const commandId = `cmd_${randomUUID()}`;
    
    // 명령 적용
    unit.isAIControlled = false;
    
    switch (data.command) {
      case 'move':
        if (data.params?.targetPosition) {
          unit.targetPosition = data.params.targetPosition;
          unit.stance = 'aggressive';
        }
        break;
        
      case 'attack':
        if (data.params?.targetUnitId) {
          const target = allUnits.find(u => String(u.generalId) === data.params.targetUnitId);
          if (target) {
            unit.targetPosition = target.position;
            unit.targetUnitId = data.params.targetUnitId;
            unit.stance = 'aggressive';
          }
        }
        break;
        
      case 'hold':
        unit.targetPosition = undefined;
        unit.targetUnitId = undefined;
        unit.stance = 'hold';
        break;
        
      case 'retreat':
        unit.stance = 'retreat';
        unit.isAIControlled = true; // AI가 후퇴 경로 계산
        break;
        
      case 'formation':
        if (data.params?.formation) {
          unit.formation = data.params.formation;
        }
        break;
        
      case 'stance':
        if (data.params?.stance) {
          unit.stance = data.params.stance;
        }
        break;
        
      case 'ability':
        // 특수 능력 사용
        if (data.params?.abilityId) {
          unit.activeAbility = {
            abilityId: data.params.abilityId,
            targetPosition: data.params.targetPosition,
            targetUnitId: data.params.targetUnitId
          };
        }
        break;
        
      case 'volley':
        // 일제 사격
        unit.isVolleyMode = true;
        if (data.params?.targetPosition) {
          unit.targetPosition = data.params.targetPosition;
        }
        break;
    }
    
    await battle.save();
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${data.battleId}`).emit('battle:command_executed', {
        commandId,
        unitId: unit.generalId,
        command: data.command,
        params: data.params,
        timestamp: new Date()
      });
    }
    
    return { success: true, commandId };
  }

  // ============================================
  // 전투 결과
  // ============================================

  /**
   * 전투 결과 저장
   */
  async submitBattleResult(data: {
    battleId: string;
    winner: 'attacker' | 'defender' | 'draw';
    duration: number;
    attackerResult: any;
    defenderResult: any;
    rewards?: any;
    replayData?: string;
  }) {
    const battle = await Battle.findOne({ battleId: data.battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (battle.status === BattleStatus.COMPLETED) {
      return { success: false, message: '이미 종료된 전투입니다' };
    }
    
    // 전투 결과 업데이트
    battle.status = BattleStatus.COMPLETED;
    battle.winner = data.winner;
    battle.completedAt = new Date();
    battle.duration = data.duration;
    
    // 결과 데이터 저장
    battle.result = {
      winner: data.winner,
      attackerCasualties: data.attackerResult.totalCasualties || 0,
      defenderCasualties: data.defenderResult.totalCasualties || 0,
      attackerStats: data.attackerResult.stats,
      defenderStats: data.defenderResult.stats
    };
    
    // 리플레이 데이터 저장
    if (data.replayData) {
      battle.replayData = data.replayData;
    }
    
    await battle.save();
    
    // 월드 반영 처리
    let worldUpdated = false;
    try {
      await this.applyBattleResultToWorld(battle, data);
      worldUpdated = true;
    } catch (error: any) {
      logger.error('전투 결과 월드 반영 실패:', error);
    }
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${data.battleId}`).emit('battle:ended', {
        battleId: data.battleId,
        winner: data.winner,
        duration: data.duration,
        attackerResult: data.attackerResult,
        defenderResult: data.defenderResult,
        rewards: data.rewards,
        timestamp: new Date()
      });
      
      // 세션 룸에도 알림
      socketManager.broadcastGameEvent(battle.session_id, 'battle:finished', {
        battleId: data.battleId,
        winner: data.winner,
        attackerNationId: battle.attackerNationId,
        defenderNationId: battle.defenderNationId,
        targetCityId: battle.targetCityId
      });
    }
    
    return { success: true, worldUpdated };
  }

  /**
   * 전투 결과를 월드에 반영
   */
  private async applyBattleResultToWorld(battle: any, resultData: any) {
    const sessionId = battle.session_id;
    const { General } = await import('../../models/general.model');
    
    // 1. 장수별 병력 손실 및 경험치 반영
    for (const unitResult of resultData.attackerResult?.survivingTroops || []) {
      await this.updateGeneralAfterBattle(
        sessionId,
        unitResult,
        battle.winner === 'attacker'
      );
    }
    
    for (const unitResult of resultData.defenderResult?.survivingTroops || []) {
      await this.updateGeneralAfterBattle(
        sessionId,
        unitResult,
        battle.winner === 'defender'
      );
    }
    
    // 2. 장수 상태 (전사, 포로 등) 처리
    const allGeneralResults = [
      ...(resultData.attackerResult?.generalResults || []),
      ...(resultData.defenderResult?.generalResults || [])
    ];
    
    for (const generalResult of allGeneralResults) {
      await this.updateGeneralStatus(sessionId, generalResult);
    }
    
    // 3. 도시 점령 처리 (공격자 승리 시)
    if (battle.winner === 'attacker' && battle.targetCityId) {
      const attackerGeneralId = battle.attackerUnits?.[0]?.generalId || 0;
      
      if (attackerGeneralId > 0) {
        await BattleEventHook.onCityOccupied(
          sessionId,
          battle.targetCityId,
          battle.attackerNationId,
          attackerGeneralId
        );
        
        logger.info(`도시 점령: ${battle.targetCityId} by 국가 ${battle.attackerNationId}`);
      }
    }
    
    // 4. 가리슨(수비대) 병력 반영
    await this.updateGarrisonTroops(sessionId, battle, resultData);
    
    // 5. 전투 로그 저장
    await this.saveBattleLogs(battle, resultData);
  }

  /**
   * 장수 병력/경험치 업데이트
   */
  private async updateGeneralAfterBattle(sessionId: string, unitResult: any, isWinner: boolean) {
    if (!unitResult.generalId || unitResult.generalId <= 0) return;
    
    const { General } = await import('../../models/general.model');
    const general = await General.findOne({
      session_id: sessionId,
      no: unitResult.generalId
    });
    
    if (!general) return;
    
    // 병력 업데이트
    const survivors = unitResult.survivors || 0;
    const originalCount = unitResult.originalCount || 0;
    const casualties = originalCount - survivors;
    
    // 현재 병력 감소
    const currentCrew = general.data?.crew ?? general.crew ?? 0;
    const newCrew = Math.max(0, currentCrew - casualties);
    
    // 경험치 지급
    const expGained = unitResult.experienceGained || (isWinner ? 500 : 100);
    
    general.addExperience?.(expGained);
    general.addDedication?.(Math.floor(expGained / 2));
    
    // 통계 업데이트
    await generalRepository.updateByGeneralNo(sessionId, unitResult.generalId, {
      $set: {
        'data.crew': newCrew,
        crew: newCrew
      },
      $inc: {
        'data.warnum': 1,
        warnum: 1,
        'data.killnum': isWinner ? 1 : 0,
        killnum: isWinner ? 1 : 0,
        'data.deathnum': isWinner ? 0 : 1,
        deathnum: isWinner ? 0 : 1,
        'data.killcrew': casualties,
        killcrew: casualties
      }
    });
    
    logger.info(`장수 ${unitResult.generalId} 업데이트: 병력 ${currentCrew} -> ${newCrew}, 경험치 +${expGained}`);
  }

  /**
   * 장수 상태 업데이트 (전사, 포로 등)
   */
  private async updateGeneralStatus(sessionId: string, generalResult: any) {
    if (!generalResult.generalId) return;
    
    const { General } = await import('../../models/general.model');
    
    switch (generalResult.status) {
      case 'killed':
        // 장수 정보 먼저 조회
        const killedGeneral = await General.findOne({
          session_id: sessionId,
          no: Number(generalResult.generalId)
        }).lean();
        
        const generalName = killedGeneral?.name || killedGeneral?.data?.name || '무명';
        const nationId = killedGeneral?.nation || killedGeneral?.data?.nation || 0;
        
        // 장수 사망 처리
        await General.updateOne(
          { session_id: sessionId, no: Number(generalResult.generalId) },
          { 
            $set: { 
              'data.killturn': -1,
              killturn: -1,
              'data.npc': 5, // 사망 상태
              npc: 5
            } 
          }
        );
        
        // 장수 사망 이벤트 브로드캐스트
        GameEventEmitter.broadcastGeneralDied(
          sessionId,
          Number(generalResult.generalId),
          generalName,
          nationId,
          'battle'
        );
        
        logger.info(`장수 ${generalResult.generalId} 전사`);
        break;
        
      case 'captured':
        // 포로 처리 (TODO: 포로 시스템 구현 시 확장)
        await General.updateOne(
          { session_id: sessionId, no: Number(generalResult.generalId) },
          { 
            $set: { 
              'data.npc': 4, // 포로 상태
              npc: 4
            } 
          }
        );
        logger.info(`장수 ${generalResult.generalId} 포로`);
        break;
        
      case 'wounded':
        // 부상 처리
        const woundTurns = Math.ceil((generalResult.woundSeverity || 50) / 10);
        await General.updateOne(
          { session_id: sessionId, no: Number(generalResult.generalId) },
          { 
            $set: { 
              'data.injury': generalResult.woundSeverity || 50,
              injury: generalResult.woundSeverity || 50
            } 
          }
        );
        logger.info(`장수 ${generalResult.generalId} 부상 (${generalResult.woundSeverity}%)`);
        break;
    }
  }

  /**
   * 가리슨 병력 업데이트
   */
  private async updateGarrisonTroops(sessionId: string, battle: any, resultData: any) {
    // meta에서 가리슨 스냅샷 확인
    const garrisonStacks = battle.meta?.garrisonStacks || [];
    if (garrisonStacks.length === 0) return;
    
    for (const stackInfo of garrisonStacks) {
      // 결과에서 해당 스택의 생존 병력 찾기
      const survivingStack = resultData.defenderResult?.survivingTroops?.find(
        (t: any) => t.stackId === stackInfo.stackId
      );
      
      if (survivingStack) {
        const newTroops = survivingStack.survivors || 0;
        // 스택 시스템 제거됨
        logger.info(`가리슨 스택 ${stackInfo.stackId} 병력: ${stackInfo.initialTroops} -> ${newTroops}`);
      }
    }
  }

  /**
   * 전투 로그 저장
   */
  private async saveBattleLogs(battle: any, resultData: any) {
    const sessionId = battle.session_id;
    const year = battle.year || 184;
    const month = battle.month || 1;
    
    const allUnits = [...(battle.attackerUnits || []), ...(battle.defenderUnits || [])];
    
    for (const unit of allUnits) {
      if (!unit.generalId || unit.generalId <= 0) continue;
      
      const isAttacker = battle.attackerUnits?.some((u: any) => u.generalId === unit.generalId);
      const isWinner = 
        (battle.winner === 'attacker' && isAttacker) ||
        (battle.winner === 'defender' && !isAttacker);
      
      try {
        const logger = new ActionLogger(
          unit.generalId,
          unit.nationId || 0,
          year,
          month,
          sessionId,
          false
        );
        
        const resultText = isWinner
          ? `전투 승리! (${battle.terrain || '야전'})`
          : `전투 패배 (${battle.terrain || '야전'})`;
        
        logger.pushGeneralBattleResultLog(resultText, LogFormatType.PLAIN);
        await logger.flush();
      } catch (error) {
        // 로그 저장 실패는 무시
      }
    }
  }

  /**
   * 항복 처리
   */
  async processSurrender(battleId: string, generalId: number) {
    const battle = await Battle.findOne({ battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (battle.status !== BattleStatus.IN_PROGRESS) {
      return { success: false, message: '전투가 진행 중이 아닙니다' };
    }
    
    // 항복자 측 결정
    const isAttacker = battle.attackerUnits?.some((u: any) => 
      u.generalId === generalId || u.commanderId === generalId
    );
    
    const winner = isAttacker ? 'defender' : 'attacker';
    
    battle.status = BattleStatus.COMPLETED;
    battle.winner = winner;
    battle.completedAt = new Date();
    battle.surrenderedBy = generalId;
    
    await battle.save();
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${battleId}`).emit('battle:surrender', {
        battleId,
        surrenderedBy: generalId,
        winner,
        timestamp: new Date()
      });
    }
    
    return { success: true, winner };
  }

  /**
   * 전투 취소
   */
  async cancelBattle(battleId: string, reason?: string) {
    const battle = await Battle.findOne({ battleId });
    if (!battle) {
      return { success: false, message: '전투를 찾을 수 없습니다' };
    }
    
    if (battle.status === BattleStatus.COMPLETED) {
      return { success: false, message: '이미 종료된 전투입니다' };
    }
    
    battle.status = BattleStatus.CANCELLED;
    battle.cancelReason = reason;
    battle.completedAt = new Date();
    
    await battle.save();
    
    // WebSocket 브로드캐스트
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`battle:${battleId}`).emit('battle:cancelled', {
        battleId,
        reason,
        timestamp: new Date()
      });
    }
    
    return { success: true };
  }

  /**
   * 전투 삭제
   */
  async deleteBattle(battleId: string) {
    const result = await battleRepository.delete(battleId);
    return { success: result.deletedCount > 0 };
  }

  // ============================================
  // 레거시 호환 메서드
  // ============================================

  /**
   * 활성 전투 조회 (레거시)
   */
  async findActive(sessionId: string) {
    return this.findBattles({ sessionId, status: 'active' });
  }

  /**
   * 장수별 전투 조회 (레거시)
   */
  async findByCommanderId(sessionId: string, commanderId: string) {
    return Battle.find({
      session_id: sessionId,
      $or: [
        { 'attackerUnits.generalId': Number(commanderId) },
        { 'defenderUnits.generalId': Number(commanderId) },
        { 'attackerUnits.commanderId': Number(commanderId) },
        { 'defenderUnits.commanderId': Number(commanderId) }
      ]
    }).lean();
  }
}

// 싱글톤 export
export const battleService = new BattleService();



