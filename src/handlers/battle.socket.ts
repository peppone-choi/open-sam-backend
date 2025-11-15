// @ts-nocheck - Type issues need investigation
import { Server, Socket } from 'socket.io';
import { Battle, BattleStatus, BattlePhase, ITurnAction } from '../models/battle.model';
import { BattleCalculator, BattleContext } from '../core/battle-calculator';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';

export class BattleSocketHandler {
  private io: Server;
  private battleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
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

    socket.on('disconnect', () => {
      console.log('전투 소켓 연결 해제:', socket.id);
    });
  }

  private async handleJoin(socket: Socket, data: { battleId: string; generalId: number }) {
    try {
      const { battleId, generalId } = data;

      const battle = await Battle.findOne({ battleId });
      if (!battle) {
        socket.emit('battle:error', { message: '전투를 찾을 수 없습니다' });
        return;
      }

      socket.join(`battle:${battleId}`);
      console.log(`장수 ${generalId}가 전투 ${battleId}에 참가했습니다`);

      socket.emit('battle:joined', {
        battleId: battle.battleId,
        status: battle.status,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        attackerUnits: battle.attackerUnits,
        defenderUnits: battle.defenderUnits,
        terrain: battle.terrain
      });

      this.io.to(`battle:${battleId}`).emit('battle:player_joined', {
        generalId,
        timestamp: new Date()
      });

      if (battle.status === BattleStatus.DEPLOYING) {
        const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
        const allDeployed = allUnits.every(u => u.position);

        if (allDeployed) {
          battle.status = BattleStatus.IN_PROGRESS;
          battle.currentTurn = 1;
          await battle.save();

          this.io.to(`battle:${battleId}`).emit('battle:started', {
            currentTurn: battle.currentTurn,
            timestamp: new Date()
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

      const existingIndex = battle.currentTurnActions.findIndex(a => a.generalId === generalId);
      if (existingIndex >= 0) {
        battle.currentTurnActions[existingIndex] = action;
      } else {
        battle.currentTurnActions.push(action);
      }

      await battle.save();

      this.io.to(`battle:${battleId}`).emit('battle:action_submitted', {
        generalId,
        action,
        timestamp: new Date()
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
        timestamp: new Date()
      });

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const allReady = allUnits.every(u => battle.readyPlayers.includes(u.generalId));

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
      socket.leave(`battle:${battleId}`);

      this.io.to(`battle:${battleId}`).emit('battle:player_left', {
        generalId,
        timestamp: new Date()
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
      timestamp: new Date()
    });

    const timer = setTimeout(async () => {
      await this.resolveTurn(battle);
    }, timeLimit);

    this.battleTimers.set(battleId, timer);
  }

  private async resolveTurn(battle: any) {
    try {
      battle.currentPhase = BattlePhase.RESOLUTION;
      await battle.save();

      this.io.to(`battle:${battle.battleId}`).emit('battle:resolution_phase', {
        currentTurn: battle.currentTurn,
        timestamp: new Date()
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
        cityWall: 50
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
          events: result.battleLog
        },
        battleLog: result.battleLog
      });

      // 전투 로그 실시간 브로드캐스트
      if (result.battleLog && Array.isArray(result.battleLog)) {
        for (const log of result.battleLog) {
          this.broadcastBattleLog(battle.battleId, log, 'action');
        }
      }

      battle.currentTurnActions = [];
      battle.readyPlayers = [];

      const battleEnded = result.attackerSurvivors <= 0 || result.defenderSurvivors <= 0 || battle.currentTurn >= battle.maxTurns;

      if (battleEnded) {
        battle.status = BattleStatus.COMPLETED;
        battle.winner = result.winner;
        battle.completedAt = new Date();
        await battle.save();

        this.io.to(`battle:${battle.battleId}`).emit('battle:ended', {
          winner: battle.winner,
          finalState: {
            attackerUnits: battle.attackerUnits,
            defenderUnits: battle.defenderUnits
          },
          timestamp: new Date()
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
          timestamp: new Date()
        });

        setTimeout(() => {
          this.startPlanningPhase(battle);
        }, battle.resolutionTimeLimit * 1000);
      }
    } catch (error: any) {
      console.error('턴 해결 중 오류:', error);
      this.io.to(`battle:${battle.battleId}`).emit('battle:error', {
        message: '턴 해결 중 오류가 발생했습니다'
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
  private async handleRealtimeCommand(socket: Socket, data: { 
    battleId: string; 
    generalId: number; 
    command: 'move' | 'attack' | 'hold' | 'retreat';
    targetPosition?: { x: number; y: number };
    targetGeneralId?: number;
  }) {
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

      // 해당 장수의 유닛 찾기
      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find(u => u.generalId === generalId);

      if (!unit) {
        socket.emit('battle:error', { message: '해당 장수를 찾을 수 없습니다' });
        return;
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
          if (targetGeneralId !== undefined) {
            const target = allUnits.find(u => u.generalId === targetGeneralId);
            if (target) {
              unit.targetPosition = target.position;
              unit.stance = 'aggressive';
            }
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
        timestamp: new Date()
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
      timestamp: new Date()
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
      timestamp: new Date()
    });
  }

  /**
   * 전투 종료 후 월드 반영 처리
   */
  private async handleBattleEnded(battle: any, result: any) {
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
            attackerGeneralId
          );
        }
      }

      console.log(`[BattleEventHook] 전투 종료 처리 완료: ${battle.battleId}, 승자: ${winner}`);
    } catch (error: any) {
      console.error('[BattleEventHook] 전투 종료 처리 중 오류:', error);
    }
  }

  /**
   * 전투 참여 장수들에게 경험치/명성 지급
   */
  private async awardBattleRewards(battle: any, result: any) {
    try {
      const { General } = await import('../models/general.model');
      const sessionId = battle.session_id;
      
      // 승자 측 장수들
      const winnerUnits = battle.winner === 'attacker' ? battle.attackerUnits : battle.defenderUnits;
      // 패자 측 장수들
      const loserUnits = battle.winner === 'attacker' ? battle.defenderUnits : battle.attackerUnits;

      // 승자 장수들에게 보상
      for (const unit of winnerUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;

        const general = await General.findOne({ 
          session_id: sessionId, 
          no: unit.generalId 
        });

        if (general) {
          // 기본 경험치: 500 + 적 피해량 / 10
          const enemyCasualties = battle.winner === 'attacker' ? 
            (result.defenderCasualties || 0) : 
            (result.attackerCasualties || 0);
          const baseExp = 500 + Math.floor(enemyCasualties / 10);
          
          general.addExperience(baseExp);
          general.addDedication(Math.floor(baseExp / 2));

          await general.save();
          console.log(`[BattleReward] 승리 장수 ${general.name}(${unit.generalId}): 경험치 +${baseExp}`);
        }
      }

      // 패자 장수들에게 소량의 경험치
      for (const unit of loserUnits) {
        if (!unit.generalId || unit.generalId === 0) continue;

        const general = await General.findOne({ 
          session_id: sessionId, 
          no: unit.generalId 
        });

        if (general) {
          const loseExp = 100;
          general.addExperience(loseExp);
          await general.save();
          console.log(`[BattleReward] 패배 장수 ${general.name}(${unit.generalId}): 경험치 +${loseExp}`);
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

        const isWinner = (battle.winner === 'attacker' && battle.attackerUnits.includes(unit)) ||
                        (battle.winner === 'defender' && battle.defenderUnits.includes(unit));

        const logger = new ActionLogger(
          unit.generalId,
          unit.nationId || 0,
          year,
          month,
          sessionId,
          false
        );

        // 전투 결과 로그
        const resultText = isWinner ? 
          `전투 승리! (${battle.battleType || '일반전투'})` : 
          `전투 패배 (${battle.battleType || '일반전투'})`;
        logger.pushGeneralBattleResultLog(resultText, LogFormatType.PLAIN);

        // 전투 상세 로그
        const detailLines = [
          `=== 전투 상세 (${battle.battleId}) ===`,
          `지형: ${battle.terrain || '평지'}`,
          `총 턴 수: ${battle.currentTurn}`,
          `최종 병력: ${unit.troops || 0}명`,
          `결과: ${isWinner ? '승리' : '패배'}`
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
