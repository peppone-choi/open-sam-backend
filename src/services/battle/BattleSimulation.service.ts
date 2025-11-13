import { IBattle, IBattleUnit, BattleStatus } from '../../models/battle.model';
import { battleRepository } from '../../repositories/battle.repository';
import { BattlePhysics } from './BattlePhysics';
import { SimpleBattleAI, AIDecision } from './BattleAI';
import { getSocketManager } from '../../socket/socketManager';

/**
 * 실시간 전투 시뮬레이션
 * - 20 tick/s 게임 루프
 * - AI 명령 생성 → 물리 업데이트 → 충돌 처리 → 공격 처리 → 승리 체크
 */
export class BattleSimulationService {
  private battleId: string;
  private isRunning: boolean = false;
  private physics: BattlePhysics;
  private ai: SimpleBattleAI;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentTime: number = 0;

  constructor(battleId: string) {
    this.battleId = battleId;
    this.physics = new BattlePhysics({
      deltaTime: 50, // 50ms per tick (20 tick/s)
      mapWidth: 800,
      mapHeight: 600
    });
    this.ai = new SimpleBattleAI(this.physics);
  }

  /**
   * 시뮬레이션 시작
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const battle = await battleRepository.findByBattleId(this.battleId);
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다');
    }

    if (battle.status !== BattleStatus.IN_PROGRESS) {
      throw new Error('전투가 진행 중이 아닙니다');
    }

    this.isRunning = true;
    this.currentTime = Date.now();

    console.log(`[BattleSimulation] Started: ${this.battleId}`);

    // 20 tick/s = 50ms interval
    this.tickInterval = setInterval(() => {
      this.tick().catch(error => {
        console.error('[BattleSimulation] Tick error:', error);
        this.stop();
      });
    }, 50);
  }

  /**
   * 시뮬레이션 정지
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isRunning = false;
    console.log(`[BattleSimulation] Stopped: ${this.battleId}`);
  }

  /**
   * 게임 틱 (50ms마다 실행)
   */
  private async tick(): Promise<void> {
    const battle = await battleRepository.findByBattleId(this.battleId);
    if (!battle) {
      this.stop();
      return;
    }

    // 1. AI 명령 생성 (AI 제어 유닛만)
    this.generateAICommands(battle);

    // 2. 물리 업데이트 (이동)
    this.updateMovement(battle);

    // 3. 충돌 감지 및 해결
    this.resolveCollisions(battle);

    // 4. 공격 처리
    this.processAttacks(battle);

    // 5. 승리 조건 체크
    const winner = this.checkVictoryCondition(battle);
    if (winner) {
      battle.winner = winner;
      battle.status = BattleStatus.COMPLETED;
      battle.completedAt = new Date();
      await battle.save();
      this.stop();
      console.log(`[BattleSimulation] Winner: ${winner}`);
      return;
    }

    // 6. 상태 저장
    battle.lastTickTime = new Date();
    await battle.save();

    // 7. WebSocket으로 상태 브로드캐스트 (매 틱마다)
    this.broadcastState(battle);

    this.currentTime += 50;
  }

  /**
   * AI 명령 생성
   */
  private generateAICommands(battle: IBattle): void {
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

    for (const unit of allUnits) {
      if (!unit.isAIControlled) continue;
      if (unit.troops <= 0) continue;

      const allies = this.isAttacker(unit, battle) ? battle.attackerUnits : battle.defenderUnits;
      const enemies = this.isAttacker(unit, battle) ? battle.defenderUnits : battle.attackerUnits;

      const decision = this.ai.decideAction(unit, allies, enemies, battle.map);
      this.applyAIDecision(unit, decision, allUnits);
    }
  }

  /**
   * AI 결정 적용
   */
  private applyAIDecision(unit: IBattleUnit, decision: AIDecision, allUnits: IBattleUnit[]): void {
    switch (decision.action) {
      case 'move':
        if (decision.targetPosition) {
          unit.targetPosition = decision.targetPosition;
        }
        break;

      case 'attack':
        if (decision.targetGeneralId !== undefined) {
          const target = allUnits.find(u => u.generalId === decision.targetGeneralId);
          if (target) {
            // 사거리 내면 targetPosition 제거 (정지)
            if (this.physics.isInAttackRange(unit, target)) {
              unit.targetPosition = undefined;
            } else {
              // 접근
              unit.targetPosition = target.position;
            }
          }
        }
        break;

      case 'hold':
        unit.targetPosition = undefined;
        break;

      case 'retreat':
        if (decision.targetPosition) {
          unit.targetPosition = decision.targetPosition;
        }
        break;
    }
  }

  /**
   * 이동 업데이트
   */
  private updateMovement(battle: IBattle): void {
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

    for (const unit of allUnits) {
      if (unit.troops <= 0) continue;
      this.physics.updateMovement(unit, battle.map);
    }
  }

  /**
   * 충돌 해결
   */
  private resolveCollisions(battle: IBattle): void {
    const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

    for (let i = 0; i < allUnits.length; i++) {
      for (let j = i + 1; j < allUnits.length; j++) {
        const unit1 = allUnits[i];
        const unit2 = allUnits[j];

        if (unit1.troops <= 0 || unit2.troops <= 0) continue;

        if (this.physics.checkCollision(unit1, unit2)) {
          this.physics.resolveCollision(unit1, unit2);
        }
      }
    }
  }

  /**
   * 공격 처리
   */
  private processAttacks(battle: IBattle): void {
    const attackers = battle.attackerUnits.filter(u => u.troops > 0);
    const defenders = battle.defenderUnits.filter(u => u.troops > 0);

    // 공격자 → 방어자
    for (const attacker of attackers) {
      for (const defender of defenders) {
        const damage = this.physics.processAttack(attacker, defender, this.currentTime);
        if (damage !== null) {
          defender.troops = Math.max(0, defender.troops - damage);
          
          // 사기 하락 (피해 비율에 따라)
          const damageRatio = damage / defender.maxTroops;
          defender.morale = Math.max(0, defender.morale - damageRatio * 10);

          console.log(`[Attack] ${attacker.generalName} → ${defender.generalName}: ${damage} 데미지 (남은 병력: ${defender.troops})`);
        }
      }
    }

    // 방어자 → 공격자
    for (const defender of defenders) {
      for (const attacker of attackers) {
        const damage = this.physics.processAttack(defender, attacker, this.currentTime);
        if (damage !== null) {
          attacker.troops = Math.max(0, attacker.troops - damage);
          
          const damageRatio = damage / attacker.maxTroops;
          attacker.morale = Math.max(0, attacker.morale - damageRatio * 10);

          console.log(`[Attack] ${defender.generalName} → ${attacker.generalName}: ${damage} 데미지 (남은 병력: ${attacker.troops})`);
        }
      }
    }
  }

  /**
   * 승리 조건 체크
   */
  private checkVictoryCondition(battle: IBattle): 'attacker' | 'defender' | 'draw' | null {
    const attackersAlive = battle.attackerUnits.filter(u => u.troops > 0).length;
    const defendersAlive = battle.defenderUnits.filter(u => u.troops > 0).length;

    // 성문 체크 (성 공방전)
    if (battle.map.castle) {
      const gate = battle.defenderUnits.find(u => u.generalId === -1);
      if (gate && gate.troops <= 0) {
        return 'attacker'; // 성문 함락
      }
    }

    // 병력 전멸
    if (attackersAlive === 0 && defendersAlive === 0) {
      return 'draw';
    }

    if (attackersAlive === 0) {
      return 'defender';
    }

    if (defendersAlive === 0) {
      return 'attacker';
    }

    // 최대 턴 도달 (15턴 = 15분 = 18000 tick)
    const maxTicks = battle.maxTurns * 60 * 20; // 15턴 * 60초 * 20tick/s
    if (this.currentTime / 50 >= maxTicks) {
      // 남은 병력 비교
      const attackerTroops = battle.attackerUnits.reduce((sum, u) => sum + u.troops, 0);
      const defenderTroops = battle.defenderUnits.reduce((sum, u) => sum + u.troops, 0);

      if (attackerTroops > defenderTroops) {
        return 'attacker';
      } else if (defenderTroops > attackerTroops) {
        return 'defender';
      } else {
        return 'draw';
      }
    }

    return null;
  }

  /**
   * 공격자 유닛 여부
   */
  private isAttacker(unit: IBattleUnit, battle: IBattle): boolean {
    return battle.attackerUnits.some(u => u.generalId === unit.generalId);
  }

  /**
   * WebSocket 상태 브로드캐스트
   */
  private broadcastState(battle: IBattle): void {
    const socketManager = getSocketManager();
    if (!socketManager) return;

    const state = {
      battleId: battle.battleId,
      currentTurn: battle.currentTurn,
      attackerUnits: battle.attackerUnits.map(u => ({
        generalId: u.generalId,
        generalName: u.generalName,
        position: u.position,
        velocity: u.velocity,
        facing: u.facing,
        troops: u.troops,
        maxTroops: u.maxTroops,
        morale: u.morale,
        targetPosition: u.targetPosition,
        isCharging: u.isCharging,
        lastAttackTime: u.lastAttackTime,
        unitType: u.unitType,
        collisionRadius: u.collisionRadius,
        attackRange: u.attackRange
      })),
      defenderUnits: battle.defenderUnits.map(u => ({
        generalId: u.generalId,
        generalName: u.generalName,
        position: u.position,
        velocity: u.velocity,
        facing: u.facing,
        troops: u.troops,
        maxTroops: u.maxTroops,
        morale: u.morale,
        targetPosition: u.targetPosition,
        isCharging: u.isCharging,
        lastAttackTime: u.lastAttackTime,
        unitType: u.unitType,
        collisionRadius: u.collisionRadius,
        attackRange: u.attackRange
      })),
      map: {
        width: battle.map.width,
        height: battle.map.height,
        castle: battle.map.castle
      }
    };

    // Socket.IO를 통해 브로드캐스트
    socketManager.getIO().to(`battle:${battle.battleId}`).emit('battle:state', state);
  }
}

/**
 * 전투 시뮬레이션 매니저
 * 여러 전투 동시 관리
 */
export class BattleSimulationManager {
  private static simulations = new Map<string, BattleSimulationService>();

  /**
   * 전투 시뮬레이션 시작
   */
  static async startSimulation(battleId: string): Promise<void> {
    if (this.simulations.has(battleId)) {
      console.log(`[BattleSimulationManager] Already running: ${battleId}`);
      return;
    }

    const simulation = new BattleSimulationService(battleId);
    this.simulations.set(battleId, simulation);

    await simulation.start();
  }

  /**
   * 전투 시뮬레이션 정지
   */
  static stopSimulation(battleId: string): void {
    const simulation = this.simulations.get(battleId);
    if (simulation) {
      simulation.stop();
      this.simulations.delete(battleId);
    }
  }

  /**
   * 모든 시뮬레이션 정지
   */
  static stopAll(): void {
    for (const [battleId, simulation] of this.simulations.entries()) {
      simulation.stop();
    }
    this.simulations.clear();
  }

  /**
   * 실행 중인 시뮬레이션 목록
   */
  static getRunningSimulations(): string[] {
    return Array.from(this.simulations.keys());
  }
}
