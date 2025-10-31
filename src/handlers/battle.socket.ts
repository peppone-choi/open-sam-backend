import { Server, Socket } from 'socket.io';
import { Battle, BattleStatus, BattlePhase, ITurnAction } from '../models/battle.model';
import { BattleCalculator, BattleContext } from '../core/battle-calculator';

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
}
