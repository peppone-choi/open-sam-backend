// @ts-nocheck - Type issues need investigation
import { Server, Socket } from 'socket.io';
import { Battle, BattleStatus, BattlePhase, ITurnAction } from '../models/battle.model';
import { BattleCalculator, BattleContext } from '../core/battle-calculator';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../middleware/auth';
import { verifyGeneralOwnership } from '../common/auth-utils';
import { saveGeneral } from '../common/cache/model-cache.helper';
import { runWithDistributedLock } from '../common/lock/distributed-lock.helper';
import { configManager } from '../config/ConfigManager';
import { logger } from '../common/logger';

const { jwtSecret } = configManager.get().system;
const battleCfg = configManager.get().battle;

const HQ_COMMAND_RADIUS = battleCfg.hqCommandRadius;
const BATTLE_LOCK_TTL = battleCfg.lockTtl;
const DISCONNECT_GRACE_PERIOD = battleCfg.disconnectGraceMs;

function authenticateBattleSocket(socket: Socket): string | null {
  const authToken =
    (socket.handshake.auth && (socket.handshake.auth as any).token) ||
    (socket.handshake.headers &&
      (socket.handshake.headers['x-auth-token'] as string | undefined));

  if (!authToken) {
    socket.emit('battle:error', {
      message: '전투 서버 인증 토큰이 없습니다. 다시 로그인해주세요.',
    });
    socket.disconnect();
    return null;
  }

  if (!jwtSecret) {
    socket.emit('battle:error', {
      message:
        '서버 설정 오류(JWT_SECRET 누락)로 인해 전투 서버에 접속할 수 없습니다.',
    });
    socket.disconnect();
    return null;
  }

  try {
    const decoded = jwt.verify(authToken, jwtSecret) as JwtPayload & {
      iat?: number;
    };

    if (!decoded.userId) {
      socket.emit('battle:error', {
        message: '유효하지 않은 전투 인증 토큰입니다.',
      });
      socket.disconnect();
      return null;
    }

    (socket.data as any).userId = decoded.userId;
    (socket.data as any).generalId = decoded.generalId || null;
    (socket.data as any).sessionId = decoded.sessionId || null;

    return decoded.userId;
  } catch (error) {
    socket.emit('battle:error', {
      message: '전투 인증 토큰 검증에 실패했습니다.',
    });
    socket.disconnect();
    return null;
  }
}

export class BattleSocketHandler {
  private io: Server;
  private battleTimers: Map<string, NodeJS.Timeout> = new Map();
  // 연결된 사용자의 전투 참가 정보 추적 (재연결 시 상태 복구용)
  private userBattleMap: Map<string, { battleId: string; generalId: number }> = new Map();
  // 연결 끊김 타임아웃 (일정 시간 내 재연결 시 상태 유지)
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    const userId = authenticateBattleSocket(socket);
    if (!userId) {
      return;
    }

    this.handleReconnection(socket, userId);

    socket.on('battle:join', async (data) => {
      await this.handleJoin(socket, data);
    });

    socket.on('battle:spectate', async (data) => {
      await this.handleSpectate(socket, data);
    });

    socket.on('battle:action', async (data) => {
      await this.handleAction(socket, data);
    });

    socket.on('battle:ready', async (data) => {
      await this.handleReady(socket, data);
    });

    socket.on('battle:leave', async (data) => {
      await this.handleLeave(socket, data);
    });

    socket.on('battle:command', async (data) => {
      await this.handleRealtimeCommand(socket, data);
    });

    socket.on('battle:reconnect', async (data) => {
      await this.handleReconnectRequest(socket, data);
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket, userId);
    });
  }

  private handleReconnection(socket: Socket, userId: string) {
    const existingTimeout = this.disconnectTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.disconnectTimeouts.delete(userId);
    }

    const battleInfo = this.userBattleMap.get(userId);
    if (battleInfo) {
      socket.emit('battle:reconnect_available', {
        battleId: battleInfo.battleId,
        generalId: battleInfo.generalId,
        message: '이전 전투 세션이 있습니다. 재연결하시겠습니까?',
        timestamp: new Date()
      });
    }
  }

  private async handleDisconnect(socket: Socket, userId: string) {
    const battleInfo = this.userBattleMap.get(userId);
    if (!battleInfo) {
      return;
    }

    const timeout = setTimeout(async () => {
      this.io.to(`battle:${battleInfo.battleId}`).emit('battle:player_disconnected', {
        generalId: battleInfo.generalId,
        userId,
        reason: 'timeout',
        timestamp: new Date()
      });

      this.userBattleMap.delete(userId);
      this.disconnectTimeouts.delete(userId);
    }, DISCONNECT_GRACE_PERIOD);

    this.disconnectTimeouts.set(userId, timeout);

    this.io.to(`battle:${battleInfo.battleId}`).emit('battle:player_connection_lost', {
      generalId: battleInfo.generalId,
      userId,
      gracePeriod: DISCONNECT_GRACE_PERIOD,
      timestamp: new Date()
    });
  }

  private async handleReconnectRequest(
    socket: Socket, 
    data: { battleId: string; generalId: number }
  ) {
    try {
      const { battleId, generalId } = data;
      const userId = (socket.data as any).userId as string;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      if (battle.status === BattleStatus.COMPLETED) {
        socket.emit('battle:reconnect_failed', {
          reason: '전투가 이미 종료되었습니다',
          finalState: {
            winner: battle.winner,
            attackerUnits: battle.attackerUnits,
            defenderUnits: battle.defenderUnits
          }
        });
        this.userBattleMap.delete(userId);
        return;
      }

      socket.join(`battle:${battleId}`);
      this.userBattleMap.set(userId, { battleId, generalId });

      socket.emit('battle:reconnected', {
        battleId: battle.battleId,
        status: battle.status,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        attackerUnits: battle.attackerUnits,
        defenderUnits: battle.defenderUnits,
        terrain: battle.terrain,
        participants: battle.participants,
        timestamp: new Date()
      });

      this.io.to(`battle:${battleId}`).emit('battle:player_reconnected', {
        generalId,
        userId,
        timestamp: new Date()
      });
    } catch (error: any) {
      socket.emit('battle:error', { message: '재연결 처리 중 오류가 발생했습니다' });
    }
  }

  private async handleSpectate(socket: Socket, data: { battleId: string }) {
    try {
      const { battleId } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      socket.join(`battle:${battleId}`);
      
      socket.emit('battle:spectating', {
        battleId: battle.battleId,
        status: battle.status,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        attackerUnits: battle.attackerUnits,
        defenderUnits: battle.defenderUnits,
        terrain: battle.terrain,
        participants: battle.participants,
        weather: battle.weather,
        timestamp: new Date()
      });
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  private async handleJoin(socket: Socket, data: { battleId: string; generalId: number }) {
    try {
      const { battleId, generalId } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      const userId = (socket.data as any).userId as string | undefined;
      if (!userId) {
        socket.emit('battle:error', {
          message: '전투에 참가할 권한이 없습니다 (인증 정보 없음).',
        });
        return;
      }

      const sessionId = battle.session_id || 'sangokushi_default';
      const ownership = await verifyGeneralOwnership(sessionId, Number(generalId), userId);
      if (!ownership.valid) {
        socket.emit('battle:error', {
          message: ownership.error || '해당 장수에 대한 권한이 없습니다',
        });
        return;
      }

      if (!battle.participants) {
        battle.participants = [];
      }
      const existing = battle.participants.find((p: any) => p.generalId === generalId);
      if (!existing) {
        const isFirstParticipant = battle.participants.length === 0;
        battle.participants.push({
          generalId,
          role: isFirstParticipant ? 'FIELD_COMMANDER' : 'SUB_COMMANDER',
          controlledUnitGeneralIds: [],
        } as any);
        await battle.save();
      }

      socket.join(`battle:${battleId}`);
      this.userBattleMap.set(userId, { battleId, generalId });
      
      socket.emit('battle:joined', {
        battleId: battle.battleId,
        status: battle.status,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        attackerUnits: battle.attackerUnits,
        defenderUnits: battle.defenderUnits,
        terrain: battle.terrain,
        participants: battle.participants,
      });

      this.io.to(`battle:${battleId}`).emit('battle:player_joined', {
        generalId,
        timestamp: new Date(),
      });

      if (battle.status === BattleStatus.DEPLOYING) {
        const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
        const allDeployed = allUnits.every((u) => u.position);

        if (allDeployed) {
          battle.status = BattleStatus.IN_PROGRESS;
          battle.currentTurn = 1;
          await battle.save();

          this.io.to(`battle:${battleId}`).emit('battle:started', {
            currentTurn: battle.currentTurn,
            timestamp: new Date(),
          });

          this.startPlanningPhase(battle);
        }
      }
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  private async handleAction(socket: Socket, data: { battleId: string; generalId: number; action: ITurnAction }) {
    try {
      const { battleId, generalId, action } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      if (battle.currentPhase !== BattlePhase.PLANNING) {
        socket.emit('battle:error', { message: '명령 입력 단계가 아닙니다' });
        return;
      }

      const existingIndex = battle.currentTurnActions.findIndex((a) => a.generalId === generalId);
      if (existingIndex >= 0) {
        battle.currentTurnActions[existingIndex] = action;
      } else {
        battle.currentTurnActions.push(action);
      }

      await battle.save();

      this.io.to(`battle:${battleId}`).emit('battle:action_submitted', {
        generalId,
        action,
        timestamp: new Date(),
      });
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  private async handleReady(socket: Socket, data: { battleId: string; generalId: number }) {
    try {
      const { battleId, generalId } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      if (!battle.readyPlayers.includes(generalId)) {
        battle.readyPlayers.push(generalId);
      }

      await battle.save();

      this.io.to(`battle:${battleId}`).emit('battle:player_ready', {
        generalId,
        readyPlayers: battle.readyPlayers,
        timestamp: new Date(),
      });

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const allReady = allUnits.every((u) => battle.readyPlayers.includes(u.generalId));

      if (allReady) {
        this.clearBattleTimer(battleId);
        await this.resolveTurn(battle);
      }
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  private async handleLeave(socket: Socket, data: { battleId: string; generalId: number }) {
    try {
      const { battleId, generalId } = data;
      const userId = (socket.data as any).userId as string | undefined;
      
      socket.leave(`battle:${battleId}`);

      if (userId) {
        this.userBattleMap.delete(userId);
        const existingTimeout = this.disconnectTimeouts.get(userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.disconnectTimeouts.delete(userId);
        }
      }

      this.io.to(`battle:${battleId}`).emit('battle:player_left', {
        generalId,
        timestamp: new Date(),
      });
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  private startPlanningPhase(battle: any) {
    const battleId = battle.battleId;
    const timeLimit = battle.planningTimeLimit * 1000;

    this.io.to(`battle:${battleId}`).emit('battle:planning_phase', {
      currentTurn: battle.currentTurn,
      timeLimit: battle.planningTimeLimit,
      timestamp: new Date(),
    });

    const timer = setTimeout(async () => {
      await this.resolveTurn(battle);
    }, timeLimit);

    this.battleTimers.set(battleId, timer);
  }

  private async resolveTurn(battle: any) {
    const battleId = battle.battleId;
    const lockKey = `battle:turn:${battleId}`;

    const result = await runWithDistributedLock(
      lockKey,
      () => this.executeResolveTurn(battle),
      { ttl: BATTLE_LOCK_TTL, retry: 3, retryDelayMs: 100, context: 'resolveTurn' }
    );

    if (result === null) {
      this.io.to(`battle:${battleId}`).emit('battle:error', {
        message: '턴 처리가 이미 진행 중입니다. 잠시 후 다시 시도해주세요.',
      });
    }
  }

  private async executeResolveTurn(battle: any) {
    try {
      battle.currentPhase = BattlePhase.RESOLUTION;
      await battle.save();

      this.io.to(`battle:${battle.battleId}`).emit('battle:resolution_phase', {
        currentTurn: battle.currentTurn,
        timestamp: new Date(),
      });

      const calculator = new BattleCalculator();
      const attackerUnit = battle.attackerUnits[0];
      const defenderUnit = battle.defenderUnits[0];

      if (!attackerUnit || !defenderUnit) return;

      const context: BattleContext = {
        attacker: attackerUnit,
        defender: defenderUnit,
        terrain: battle.terrain,
        isDefenderCity: true,
        cityWall: 50,
      };

      const result = calculator.calculateBattle(context);

      attackerUnit.troops = result.attackerSurvivors;
      defenderUnit.troops = result.defenderSurvivors;

      battle.turnHistory.push({
        turnNumber: battle.currentTurn,
        timestamp: new Date(),
        actions: battle.currentTurnActions,
        results: {
          attackerDamage: result.attackerCasualties,
          defenderDamage: result.defenderCasualties,
          events: result.battleLog,
        },
        battleLog: result.battleLog,
      });

      if (result.battleLog && Array.isArray(result.battleLog)) {
        for (const log of result.battleLog) {
          this.broadcastBattleLog(battle.battleId, log, 'action');
        }
      }

      battle.currentTurnActions = [];
      battle.readyPlayers = [];

      const battleEnded =
        result.attackerSurvivors <= 0 ||
        result.defenderSurvivors <= 0 ||
        battle.currentTurn >= battle.maxTurns;

      if (battleEnded) {
        battle.status = BattleStatus.COMPLETED;
        battle.winner = result.winner;
        battle.completedAt = new Date();
        await battle.save();

        this.io.to(`battle:${battle.battleId}`).emit('battle:ended', {
          winner: battle.winner,
          finalState: {
            attackerUnits: battle.attackerUnits,
            defenderUnits: battle.defenderUnits,
          },
          timestamp: new Date(),
        });

        await this.handleBattleEnded(battle, result);
        this.clearBattleTimer(battle.battleId);
      } else {
        battle.currentTurn += 1;
        battle.currentPhase = BattlePhase.PLANNING;
        await battle.save();

        this.io.to(`battle:${battle.battleId}`).emit('battle:turn_resolved', {
          turnNumber: battle.currentTurn - 1,
          results: result,
          nextTurn: battle.currentTurn,
          timestamp: new Date(),
        });
        
        this.io.to(`battle:${battle.battleId}`).emit('battle:turn_result', {
          turnNumber: battle.currentTurn - 1,
          results: result,
          nextTurn: battle.currentTurn,
          attackerUnits: battle.attackerUnits,
          defenderUnits: battle.defenderUnits,
          timestamp: new Date(),
        });

        setTimeout(() => {
          this.startPlanningPhase(battle);
        }, battle.resolutionTimeLimit * 1000);
      }
    } catch (error: any) {
      this.io.to(`battle:${battle.battleId}`).emit('battle:error', {
        message: '턴 해결 중 오류가 발생했습니다',
      });
    }
  }

  private clearBattleTimer(battleId: string) {
    const timer = this.battleTimers.get(battleId);
    if (timer) {
      clearTimeout(timer);
      this.battleTimers.delete(battleId);
    }
  }

  private async handleRealtimeCommand(
    socket: Socket,
    data: {
      battleId: string;
      generalId: number;
      command: 'move' | 'attack' | 'hold' | 'retreat' | 'volley';
      targetPosition?: { x: number; y: number };
      targetGeneralId?: number;
      seq?: number;
    },
  ) {
    try {
      const { battleId, generalId, command, targetPosition, targetGeneralId, seq = 0 } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      if (battle.status !== BattleStatus.IN_PROGRESS) {
        socket.emit('battle:error', { message: '전투가 진행 중이 아닙니다' });
        return;
      }

      const userId = (socket.data as any).userId as string | undefined;
      if (!userId) {
        socket.emit('battle:error', { message: '전투 명령 권한이 없습니다' });
        return;
      }

      const sessionId = battle.session_id || 'sangokushi_default';
      const ownership = await verifyGeneralOwnership(sessionId, Number(generalId), userId);
      if (!ownership.valid) {
        socket.emit('battle:error', { message: ownership.error || '권한 오류' });
        return;
      }

      const participants = battle.participants || [];
      const me = participants.find((p: any) => p.generalId === generalId);
      if (!me || me.role === 'STAFF') {
        socket.emit('battle:error', { message: '명령 권한이 없습니다' });
        return;
      }

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find((u) => u.generalId === generalId);

      if (!unit) {
        socket.emit('battle:error', { message: '유닛을 찾을 수 없습니다' });
        return;
      }

      if (seq !== 0 && unit.lastCommandSeq && seq <= unit.lastCommandSeq) return;
      const now = Date.now();
      if (unit.lastCommandTime && now - unit.lastCommandTime < 50) return;

      unit.lastCommandSeq = seq;
      unit.lastCommandTime = now;

      if (me.role === 'SUB_COMMANDER') {
        const controlled = me.controlledUnitGeneralIds || [];
        if (controlled.length > 0 && !controlled.includes(unit.generalId)) {
          socket.emit('battle:error', { message: '지휘권이 없습니다' });
          return;
        }
      }

      const fieldCommander = participants.find((p: any) => p.role === 'FIELD_COMMANDER');
      if (fieldCommander) {
        const hqUnit = allUnits.find((u) => u.generalId === fieldCommander.generalId);
        if (hqUnit) {
          const dx = (unit.position?.x || 0) - (hqUnit.position?.x || 0);
          const dy = (unit.position?.y || 0) - (hqUnit.position?.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > HQ_COMMAND_RADIUS * 2) {
            socket.emit('battle:error', { message: '사령관 지휘 범위 밖입니다' });
            return;
          }
        }
      }

      unit.isAIControlled = false;

      switch (command) {
        case 'move':
          if (targetPosition) { unit.targetPosition = targetPosition; unit.stance = 'aggressive'; }
          break;
        case 'attack':
          if (typeof targetGeneralId === 'number') {
            const target = allUnits.find((u) => u.generalId === targetGeneralId);
            if (target) { unit.targetPosition = target.position; unit.stance = 'aggressive'; }
          }
          break;
        case 'volley':
          unit.isVolleyMode = true;
          if (typeof targetGeneralId === 'number') {
            const target = allUnits.find((u) => u.generalId === targetGeneralId);
            if (target) { unit.targetPosition = target.position; unit.stance = 'aggressive'; }
          } else if (targetPosition) { unit.targetPosition = targetPosition; unit.stance = 'aggressive'; }
          break;
        case 'hold':
          unit.targetPosition = undefined; unit.stance = 'hold';
          break;
        case 'retreat':
          unit.stance = 'retreat'; unit.isAIControlled = true;
          break;
      }

      await battle.save();
      socket.emit('battle:command_acknowledged', { generalId, command, timestamp: new Date() });
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  broadcastBattleState(battleId: string, state: any) {
    this.io.to(`battle:${battleId}`).emit('battle:state', { ...state, timestamp: new Date() });
  }

  broadcastBattleLog(battleId: string, logText: string, logType: string = 'action') {
    this.io.to(`battle:${battleId}`).emit('battle:log', { battleId, logText, logType, timestamp: new Date() });
  }

  private async handleBattleEnded(battle: any, result: any) {
    const lockKey = `battle:world:${battle.battleId}`;
    const lockResult = await runWithDistributedLock(
      lockKey,
      () => this.executeHandleBattleEnded(battle, result),
      { ttl: BATTLE_LOCK_TTL * 2, retry: 5, retryDelayMs: 200, context: 'handleBattleEnded' }
    );
    if (lockResult === null) logger.error(`[BattleEventHook] 월드 반영 락 획득 실패: ${battle.battleId}`);
  }

  private async executeHandleBattleEnded(battle: any, result: any) {
    try {
      const { winner, session_id: sessionId, targetCityId, attackerNationId } = battle;
      await this.awardBattleRewards(battle, result);
      await this.saveBattleResultLogs(battle, result);
      if (winner === 'attacker' && targetCityId) {
        const attackerGeneralId = battle.attackerUnits?.[0]?.generalId || 0;
        if (attackerGeneralId > 0) await BattleEventHook.onCityOccupied(sessionId, targetCityId, attackerNationId, attackerGeneralId);
      }
    } catch (error: any) {
      logger.error('[BattleEventHook] 전투 종료 처리 중 오류:', error);
    }
  }

  private async awardBattleRewards(battle: any, result: any) {
    try {
      const { General } = await import('../models/general.model');
      const { generalRepository } = await import('../repositories/general.repository');
      const sessionId = battle.session_id;

      const winnerUnits = battle.winner === 'attacker' ? battle.attackerUnits : battle.defenderUnits;
      const loserUnits = battle.winner === 'attacker' ? battle.defenderUnits : battle.attackerUnits;

      for (const unit of winnerUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;
        const general = await General.findOne({ session_id: sessionId, no: unit.generalId });
        if (general) {
          const enemyCasualties = battle.winner === 'attacker' ? result.defenderCasualties || 0 : result.attackerCasualties || 0;
          const baseExp = 500 + Math.floor(enemyCasualties / 10);
          general.addExperience(baseExp);
          general.addDedication(Math.floor(baseExp / 2));
          await generalRepository.updateByGeneralNo(sessionId, unit.generalId, { $inc: { 'data.killnum': 1, 'data.killcrew': enemyCasualties, 'data.warnum': 1 } });
          await saveGeneral(sessionId, general.no || general.data?.no || unit.generalId, general.toObject());
        }
      }

      for (const unit of loserUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;
        const general = await General.findOne({ session_id: sessionId, no: unit.generalId });
        if (general) {
          const ownCasualties = battle.winner === 'attacker' ? result.defenderCasualties || 0 : result.attackerCasualties || 0;
          general.addExperience(100);
          await generalRepository.updateByGeneralNo(sessionId, unit.generalId, { $inc: { 'data.deathnum': 1, 'data.deathcrew': ownCasualties, 'data.warnum': 1 } });
          await saveGeneral(sessionId, general.no || general.data?.no || unit.generalId, general.toObject());
        }
      }
    } catch (error: any) {
      logger.error('[BattleReward] 경험치 지급 중 오류:', error);
    }
  }

  private async saveBattleResultLogs(battle: any, result: any) {
    try {
      const { ActionLogger } = await import('../services/logger/ActionLogger');
      const { LogFormatType } = await import('../types/log.types');
      const { session_id: sessionId, year = 184, month = 1 } = battle;
      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

      for (const unit of allUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;
        const isWinner = (battle.winner === 'attacker' && battle.attackerUnits.includes(unit)) || (battle.winner === 'defender' && battle.defenderUnits.includes(unit));
        const actionLogger = new ActionLogger(unit.generalId, unit.nationId || 0, year, month, sessionId, false);
        actionLogger.pushGeneralBattleResultLog(isWinner ? '전투 승리!' : '전투 패배', LogFormatType.PLAIN);
        actionLogger.pushGeneralBattleDetailLog(`지형: ${battle.terrain || '평지'}, 턴: ${battle.currentTurn}, 잔여병력: ${unit.troops || 0}`, LogFormatType.PLAIN);
        await actionLogger.flush();
      }
    } catch (error: any) {
      logger.error('[BattleLog] 로그 저장 중 오류:', error);
    }
  }
}
