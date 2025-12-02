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

const HQ_COMMAND_RADIUS = 250; // 총사령관 지휘 기본 반경 (px 기준, 임시 값)
const BATTLE_LOCK_TTL = 30; // 전투 락 TTL (초)

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

  if (!process.env.JWT_SECRET) {
    socket.emit('battle:error', {
      message:
        '서버 설정 오류(JWT_SECRET 누락)로 인해 전투 서버에 접속할 수 없습니다.',
    });
    socket.disconnect();
    return null;
  }

  try {
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET) as JwtPayload & {
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
  private readonly DISCONNECT_GRACE_PERIOD = 60000; // 60초

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    const userId = authenticateBattleSocket(socket);
    if (!userId) {
      // 인증 실패 시 이벤트를 바인딩하지 않는다.
      return;
    }

    // 재연결 처리: 이전 연결 끊김 타임아웃 취소
    this.handleReconnection(socket, userId);

    socket.on('battle:join', async (data) => {
      await this.handleJoin(socket, data);
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

    // 실시간 전투 명령 (Phase 3)
    socket.on('battle:command', async (data) => {
      await this.handleRealtimeCommand(socket, data);
    });

    // 재연결 시 상태 복구 요청
    socket.on('battle:reconnect', async (data) => {
      await this.handleReconnectRequest(socket, data);
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket, userId);
    });
  }

  /**
   * 재연결 처리: 이전 연결 끊김 타임아웃 취소 및 상태 복구 알림
   */
  private handleReconnection(socket: Socket, userId: string) {
    // 이전 연결 끊김 타임아웃 취소
    const existingTimeout = this.disconnectTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.disconnectTimeouts.delete(userId);
      console.log(`[Battle] 사용자 재연결, 연결 끊김 타임아웃 취소: ${userId}`);
    }

    // 이전 전투 참가 정보가 있으면 알림
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

  /**
   * 연결 끊김 처리
   */
  private async handleDisconnect(socket: Socket, userId: string) {
    console.log(`[Battle] 전투 소켓 연결 해제: ${socket.id}, userId: ${userId}`);

    const battleInfo = this.userBattleMap.get(userId);
    if (!battleInfo) {
      return;
    }

    // 즉시 제거하지 않고, 일정 시간 대기 후 제거 (재연결 기회 부여)
    const timeout = setTimeout(async () => {
      console.log(`[Battle] 재연결 대기 시간 초과, 전투 참가 정보 제거: ${userId}`);
      
      // 전투에서 제거 알림
      this.io.to(`battle:${battleInfo.battleId}`).emit('battle:player_disconnected', {
        generalId: battleInfo.generalId,
        userId,
        reason: 'timeout',
        timestamp: new Date()
      });

      // 전투 참가 정보 제거
      this.userBattleMap.delete(userId);
      this.disconnectTimeouts.delete(userId);
    }, this.DISCONNECT_GRACE_PERIOD);

    this.disconnectTimeouts.set(userId, timeout);

    // 일시적 연결 끊김 알림
    this.io.to(`battle:${battleInfo.battleId}`).emit('battle:player_connection_lost', {
      generalId: battleInfo.generalId,
      userId,
      gracePeriod: this.DISCONNECT_GRACE_PERIOD,
      timestamp: new Date()
    });
  }

  /**
   * 재연결 요청 처리
   */
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

      // 전투가 이미 종료되었는지 확인
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

      // 소켓 룸 재참가
      socket.join(`battle:${battleId}`);
      
      // 사용자 전투 정보 업데이트
      this.userBattleMap.set(userId, { battleId, generalId });

      // 현재 전투 상태 전송
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

      // 다른 참가자들에게 재연결 알림
      this.io.to(`battle:${battleId}`).emit('battle:player_reconnected', {
        generalId,
        userId,
        timestamp: new Date()
      });

      console.log(`[Battle] 전투 재연결 성공: ${battleId}, generalId: ${generalId}`);
    } catch (error: any) {
      socket.emit('battle:error', { message: '재연결 처리 중 오류가 발생했습니다' });
      console.error('[Battle] 재연결 처리 중 오류:', error);
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

      // 참가자 역할 초기화/업데이트
      if (!battle.participants) {
        battle.participants = [];
      }
      const existing = battle.participants.find((p: any) => p.generalId === generalId);
      if (!existing) {
        // 아주 단순한 규칙: 첫 참가자를 FIELD_COMMANDER, 나머지는 SUB_COMMANDER로 두되
        // 이후 UI/명령으로 변경 가능하게 여지를 남긴다.
        const isFirstParticipant = battle.participants.length === 0;
        battle.participants.push({
          generalId,
          role: isFirstParticipant ? 'FIELD_COMMANDER' : 'SUB_COMMANDER',
          controlledUnitGeneralIds: [],
        } as any);
        await battle.save();
      }

      socket.join(`battle:${battleId}`);
      
      // 사용자 전투 참가 정보 저장 (재연결용)
      this.userBattleMap.set(userId, { battleId, generalId });
      
      console.log(`장수 ${generalId}가 전투 ${battleId}에 참가했습니다`);

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

      // 사용자 전투 참가 정보 제거
      if (userId) {
        this.userBattleMap.delete(userId);
        // 연결 끊김 타임아웃도 취소
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

      console.log(`장수 ${generalId}가 전투 ${battleId}를 떠났습니다`);
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

    // 분산 락을 사용하여 동시 턴 처리 방지
    const result = await runWithDistributedLock(
      lockKey,
      () => this.executeResolveTurn(battle),
      { ttl: BATTLE_LOCK_TTL, retry: 3, retryDelayMs: 100, context: 'resolveTurn' }
    );

    if (result === null) {
      console.warn(`[Battle] 턴 처리 락 획득 실패: ${battleId}`);
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

      if (!attackerUnit || !defenderUnit) {
        return;
      }

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

      // 전투 로그 실시간 브로드캐스트
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

        // 전투 종료 후 월드 반영 처리
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
        
        // 프론트엔드 호환성을 위해 battle:turn_result 이벤트도 emit
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
      console.error('턴 해결 중 오류:', error);
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

  /**
   * 실시간 전투 명령 처리 (Phase 3)
   */
  private async handleRealtimeCommand(
    socket: Socket,
    data: {
      battleId: string;
      generalId: number;
      command: 'move' | 'attack' | 'hold' | 'retreat' | 'volley';
      targetPosition?: { x: number; y: number };
      targetGeneralId?: number;
    },
  ) {
    try {
      const { battleId, generalId, command, targetPosition, targetGeneralId } = data;

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
        socket.emit('battle:error', {
          message: '전투 명령을 내리기 위해서는 인증이 필요합니다',
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

      const participants = battle.participants || [];
      const me = participants.find((p: any) => p.generalId === generalId);
      if (!me) {
        socket.emit('battle:error', { message: '전투 참가자로 등록되지 않았습니다' });
        return;
      }
      if (me.role === 'STAFF') {
        socket.emit('battle:error', {
          message: '참모는 직접 전투 명령을 내릴 수 없습니다.',
        });
        return;
      }

      // 해당 장수의 유닛 찾기
      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find((u) => u.generalId === generalId);

      if (!unit) {
        socket.emit('battle:error', { message: '해당 장수를 찾을 수 없습니다' });
        return;
      }

      // SUB_COMMANDER인 경우, 자신이 위임받은 유닛인지 확인 (없다면 자신의 일반 유닛 1개만 허용)
      if (me.role === 'SUB_COMMANDER') {
        const controlled = me.controlledUnitGeneralIds || [];
        const isControlled =
          controlled.length === 0
            ? true // 아직 위임 정보가 없다면 일단 자기 일반 유닛은 허용
            : controlled.includes(unit.generalId);
        if (!isControlled) {
          socket.emit('battle:error', {
            message: '이 부대에 대한 지휘권이 없습니다',
          });
          return;
        }
      }

      // 총사령관 지휘 반경 체크 (FIELD_COMMANDER 또는 SUB_COMMANDER 모두 영향 받음)
      const fieldCommander = participants.find((p: any) => p.role === 'FIELD_COMMANDER');
      if (fieldCommander) {
        const hqUnit = allUnits.find((u) => u.generalId === fieldCommander.generalId);
        if (hqUnit) {
          const dx = (unit.position?.x || 0) - (hqUnit.position?.x || 0);
          const dy = (unit.position?.y || 0) - (hqUnit.position?.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > HQ_COMMAND_RADIUS * 2) {
            socket.emit('battle:error', {
              message:
                '총사령관의 지휘 범위를 크게 벗어나 직접 명령을 전달할 수 없습니다',
            });
            return;
          }
        }
      }

      // AI 제어 해제 (유저가 직접 컨트롤)
      unit.isAIControlled = false;

      // 명령 적용
      switch (command) {
        case 'move':
          if (targetPosition) {
            unit.targetPosition = targetPosition;
            unit.stance = 'aggressive';
          }
          break;

        case 'attack':
          if (typeof targetGeneralId === 'number') {
            const target = allUnits.find((u) => u.generalId === targetGeneralId);
            if (target) {
              unit.targetPosition = target.position;
              unit.stance = 'aggressive';
            }
          }
          break;

        case 'volley':
          // 일제 사격: 다음 공격 1회에 한해 강한 사격 적용
          unit.isVolleyMode = true;
          if (typeof targetGeneralId === 'number') {
            const target = allUnits.find((u) => u.generalId === targetGeneralId);
            if (target) {
              unit.targetPosition = target.position;
              unit.stance = 'aggressive';
            }
          } else if (targetPosition) {
            unit.targetPosition = targetPosition;
            unit.stance = 'aggressive';
          }
          break;

        case 'hold':
          unit.targetPosition = undefined;
          unit.stance = 'hold';
          break;

        case 'retreat':
          unit.stance = 'retreat';
          // AI가 후퇴 위치 계산
          unit.isAIControlled = true;
          break;
      }

      await battle.save();

      // 명령 확인 응답
      socket.emit('battle:command_acknowledged', {
        generalId,
        command,
        timestamp: new Date(),
      });
    } catch (error: any) {
      socket.emit('battle:error', { message: error.message });
    }
  }

  /**
   * 실시간 전투 상태 브로드캐스트 (BattleSimulation.service에서 호출)
   */
  broadcastBattleState(battleId: string, state: any) {
    this.io.to(`battle:${battleId}`).emit('battle:state', {
      ...state,
      timestamp: new Date(),
    });
  }

  /**
   * 전투 로그 브로드캐스트
   * @param battleId 전투 ID
   * @param logText 로그 텍스트
   * @param logType 'action' | 'damage' | 'status' | 'result'
   */
  broadcastBattleLog(battleId: string, logText: string, logType: string = 'action') {
    this.io.to(`battle:${battleId}`).emit('battle:log', {
      battleId,
      logText,
      logType,
      timestamp: new Date(),
    });
  }

  /**
   * 전투 종료 후 월드 반영 처리
   */
  private async handleBattleEnded(battle: any, result: any) {
    const battleId = battle.battleId;
    const lockKey = `battle:world:${battleId}`;

    // 분산 락을 사용하여 동시 월드 반영 방지
    const lockResult = await runWithDistributedLock(
      lockKey,
      () => this.executeHandleBattleEnded(battle, result),
      { ttl: BATTLE_LOCK_TTL * 2, retry: 5, retryDelayMs: 200, context: 'handleBattleEnded' }
    );

    if (lockResult === null) {
      console.error(`[BattleEventHook] 월드 반영 락 획득 실패: ${battleId}`);
    }
  }

  /**
   * 전투 종료 후 월드 반영 실행 (락 내부)
   */
  private async executeHandleBattleEnded(battle: any, result: any) {
    try {
      const winner = battle.winner;
      const sessionId = battle.session_id;
      const targetCityId = battle.targetCityId;
      const attackerNationId = battle.attackerNationId;
      const defenderNationId = battle.defenderNationId;

      // 1. 전투 참여 장수들 경험치/명성 지급
      await this.awardBattleRewards(battle, result);

      // 2. 전투 결과 로그 저장
      await this.saveBattleResultLogs(battle, result);

      // 3. 공격자가 승리하고 도시 공격이면 도시 점령 처리
      if (winner === 'attacker' && targetCityId) {
        const attackerGeneralId = battle.attackerUnits?.[0]?.generalId || 0;

        if (attackerGeneralId > 0) {
          await BattleEventHook.onCityOccupied(
            sessionId,
            targetCityId,
            attackerNationId,
            attackerGeneralId,
          );
        }
      }

      console.log(
        `[BattleEventHook] 전투 종료 처리 완료: ${battle.battleId}, 승자: ${winner}`,
      );
    } catch (error: any) {
      console.error('[BattleEventHook] 전투 종료 처리 중 오류:', error);
    }
  }

  /**
   * 전투 참여 장수들에게 경험치/명성 지급 및 통계 업데이트
   */
  private async awardBattleRewards(battle: any, result: any) {
    try {
      const { General } = await import('../models/general.model');
      const { generalRepository } = await import('../repositories/general.repository');
      const sessionId = battle.session_id;

      // 승자 측 장수들
      const winnerUnits =
        battle.winner === 'attacker' ? battle.attackerUnits : battle.defenderUnits;
      // 패자 측 장수들
      const loserUnits =
        battle.winner === 'attacker' ? battle.defenderUnits : battle.attackerUnits;

      // 승자 장수들에게 보상 및 통계 업데이트
      for (const unit of winnerUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;

        const general = await General.findOne({
          session_id: sessionId,
          no: unit.generalId,
        });

        if (general) {
          // 기본 경험치: 500 + 적 피해량 / 10
          const enemyCasualties =
            battle.winner === 'attacker'
              ? result.defenderCasualties || 0
              : result.attackerCasualties || 0;
          const baseExp = 500 + Math.floor(enemyCasualties / 10);

          general.addExperience(baseExp);
          general.addDedication(Math.floor(baseExp / 2));

          // 통계 업데이트: 승리 횟수, 적 살상 수
          await generalRepository.updateByGeneralNo(sessionId, unit.generalId, {
            $inc: {
              'data.killnum': 1, // 승리 횟수
              'data.killcrew': enemyCasualties, // 적 살상 수
              'data.warnum': 1, // 전투 횟수
            },
          });

          // CQRS: 캐시에 저장
          const winnerNo = general.no || general.data?.no || unit.generalId;
          await saveGeneral(sessionId, winnerNo, general.toObject());
          console.log(
            `[BattleReward] 승리 장수 ${general.name}(${unit.generalId}): 경험치 +${baseExp}, 살상 +${enemyCasualties}`,
          );
        }
      }

      // 패자 장수들에게 소량의 경험치 및 통계 업데이트
      for (const unit of loserUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;

        const general = await General.findOne({
          session_id: sessionId,
          no: unit.generalId,
        });

        if (general) {
          const loseExp = 100;
          const ownCasualties =
            battle.winner === 'attacker'
              ? result.defenderCasualties || 0
              : result.attackerCasualties || 0;

          general.addExperience(loseExp);

          // 통계 업데이트: 패배 횟수, 아군 손실 수
          await generalRepository.updateByGeneralNo(sessionId, unit.generalId, {
            $inc: {
              'data.deathnum': 1, // 패배 횟수
              'data.deathcrew': ownCasualties, // 아군 손실 수
              'data.warnum': 1, // 전투 횟수
            },
          });

          // CQRS: 캐시에 저장
          const loserNo = general.no || general.data?.no || unit.generalId;
          await saveGeneral(sessionId, loserNo, general.toObject());
          console.log(
            `[BattleReward] 패배 장수 ${general.name}(${unit.generalId}): 경험치 +${loseExp}, 손실 +${ownCasualties}`,
          );
        }
      }
    } catch (error: any) {
      console.error('[BattleReward] 경험치 지급 중 오류:', error);
    }
  }

  /**
   * 전투 결과 로그 저장
   */
  private async saveBattleResultLogs(battle: any, result: any) {
    try {
      const { ActionLogger } = await import('../services/logger/ActionLogger');
      const { LogFormatType } = await import('../types/log.types');
      const sessionId = battle.session_id;
      const year = battle.year || 184;
      const month = battle.month || 1;

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

      for (const unit of allUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;

        const isWinner =
          (battle.winner === 'attacker' && battle.attackerUnits.includes(unit)) ||
          (battle.winner === 'defender' && battle.defenderUnits.includes(unit));

        const logger = new ActionLogger(
          unit.generalId,
          unit.nationId || 0,
          year,
          month,
          sessionId,
          false,
        );

        // 전투 결과 로그
        const resultText = isWinner
          ? `전투 승리! (${battle.battleType || '일반전투'})`
          : `전투 패배 (${battle.battleType || '일반전투'})`;
        logger.pushGeneralBattleResultLog(resultText, LogFormatType.PLAIN);

        // 전투 상세 로그
        const detailLines = [
          `=== 전투 상세 (${battle.battleId}) ===`,
          `지형: ${battle.terrain || '평지'}`,
          `총 턴 수: ${battle.currentTurn}`,
          `최종 병력: ${unit.troops || 0}명`,
          `결과: ${isWinner ? '승리' : '패배'}`,
        ];

        for (const line of detailLines) {
          logger.pushGeneralBattleDetailLog(line, LogFormatType.PLAIN);
        }

        // 로그 저장
        await logger.flush();
        console.log(`[BattleLog] 장수 ${unit.generalId} 전투 로그 저장 완료`);
      }
    } catch (error: any) {
      console.error('[BattleLog] 로그 저장 중 오류:', error);
    }
  }
}
