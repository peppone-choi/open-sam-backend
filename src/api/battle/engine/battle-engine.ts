import { RedisService } from '../../../infrastructure/cache/redis.service';
import { BattleService } from '../service/battle.service';
import { EntityRepository } from '../../../common/repository/entity-repository';
import {
  IBattleSession,
  IBattleUnit,
  IBattleIntent,
  BattleStatus,
  BattleMode,
  BattleTickEvent,
  UnitDamagedEvent,
  GeneralKIAEvent,
} from '../@types/battle.types';

/**
 * BattleEngine
 * 
 * 전투 실행 엔진:
 * - 틱/라운드 기반 전투 처리
 * - Intent 실행 (이동, 공격, 대기)
 * - Entity 기반 유닛 관리
 * - 전투 이벤트 발행
 * - 전투 종료 조건 체크
 */
export class BattleEngine {
  private redis: RedisService;
  private battleService: BattleService;
  private tickInterval?: NodeJS.Timeout;
  private isRunning = false;

  private readonly TICK_INTERVAL_MS = 500;
  private readonly MAX_ROUNDS = 100;
  private readonly MELEE_RANGE = 2;
  private readonly RANGED_RANGE = 10;

  constructor(battleService: BattleService) {
    this.redis = new RedisService();
    this.battleService = battleService;
  }

  /**
   * 전투 엔진 시작
   */
  async start(battleId: string): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const battle = await this.loadBattle(battleId);
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다.');
    }

    battle.status = BattleStatus.IN_PROGRESS;
    await this.saveBattle(battle);

    if (battle.mode === BattleMode.REALTIME) {
      this.tickInterval = setInterval(() => {
        this.processTick(battleId).catch(console.error);
      }, this.TICK_INTERVAL_MS);
    }
  }

  /**
   * 전투 엔진 중지
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
    this.isRunning = false;
  }

  /**
   * 턴제 라운드 처리
   */
  async processRound(battleId: string): Promise<void> {
    const battle = await this.loadBattle(battleId);
    if (!battle || battle.status !== BattleStatus.IN_PROGRESS) {
      return;
    }

    if (battle.mode !== BattleMode.TURN_BASED) {
      throw new Error('턴제 모드가 아닙니다.');
    }

    battle.currentRound++;
    await this.executeRound(battle);
    await this.saveBattle(battle);

    await this.checkBattleEnd(battle);
  }

  /**
   * 실시간 틱 처리
   */
  private async processTick(battleId: string): Promise<void> {
    const battle = await this.loadBattle(battleId);
    if (!battle || battle.status !== BattleStatus.IN_PROGRESS) {
      this.stop();
      return;
    }

    battle.currentTick++;
    battle.lastTickAt = new Date();

    await this.executeRound(battle);
    await this.saveBattle(battle);

    await this.checkBattleEnd(battle);
  }

  /**
   * 라운드 실행
   */
  private async executeRound(battle: IBattleSession): Promise<void> {
    const units = await this.loadUnits(battle.id, battle.sessionId);
    const intents = await this.loadPendingIntents(battle.id, battle.sessionId);

    for (const intent of intents) {
      await this.executeIntent(intent, units, battle);
    }

    await this.processCombat(units, battle);

    await this.publishTickEvent(battle, units);
  }

  /**
   * Intent 실행
   */
  private async executeIntent(
    intent: IBattleIntent,
    units: IBattleUnit[],
    battle: IBattleSession
  ): Promise<void> {
    const unit = units.find((u) => u.id === intent.unitId);
    if (!unit || unit.status !== 'active') {
      return;
    }

    switch (intent.type) {
      case 'MOVE':
        await this.executeMove(unit, intent);
        break;
      case 'ATTACK':
        await this.executeAttack(unit, intent, units, battle);
        break;
      case 'HOLD':
        break;
      case 'RETREAT':
        unit.status = 'retreating';
        await this.saveUnit(unit, battle.sessionId);
        break;
      default:
        break;
    }

    intent.status = 'completed';
    intent.executedAt = battle.mode === BattleMode.REALTIME ? battle.currentTick : battle.currentRound;
    await this.saveIntent(intent, battle.sessionId);
  }

  /**
   * 이동 실행
   */
  private async executeMove(unit: IBattleUnit, intent: IBattleIntent): Promise<void> {
    if (!intent.params.targetPosition) {
      return;
    }

    const { x, y } = intent.params.targetPosition;
    const distance = this.calculateDistance(unit.position, { x, y });

    if (distance <= unit.speed) {
      unit.position = { x, y };
    } else {
      const ratio = unit.speed / distance;
      unit.position.x = Math.round(unit.position.x + (x - unit.position.x) * ratio);
      unit.position.y = Math.round(unit.position.y + (y - unit.position.y) * ratio);
    }
  }

  /**
   * 공격 실행
   */
  private async executeAttack(
    unit: IBattleUnit,
    intent: IBattleIntent,
    units: IBattleUnit[],
    battle: IBattleSession
  ): Promise<void> {
    if (!intent.params.targetUnitId) {
      return;
    }

    const target = units.find((u) => u.id === intent.params.targetUnitId);
    if (!target || target.status === 'destroyed') {
      return;
    }

    const distance = this.calculateDistance(unit.position, target.position);
    const attackType = intent.params.attackType || 'melee';
    const range = attackType === 'melee' ? this.MELEE_RANGE : this.RANGED_RANGE;

    if (distance > range) {
      return;
    }

    const damage = this.calculateDamage(unit, target);
    target.hp = Math.max(0, target.hp - damage);

    const casualty = Math.floor((damage / target.maxHp) * target.troops_current);
    target.troops_current = Math.max(0, target.troops_current - casualty);

    if (target.hp <= 0) {
      target.status = 'destroyed';
      await this.publishGeneralKIA(battle, target.commanderId, unit.commanderId);
    }

    await this.saveUnit(target, battle.sessionId);
    await this.publishUnitDamaged(battle, target.id, damage, target.hp, unit.id);
  }

  /**
   * 자동 전투 처리
   */
  private async processCombat(units: IBattleUnit[], battle: IBattleSession): Promise<void> {
    const activeUnits = units.filter((u) => u.status === 'active');

    for (const unit of activeUnits) {
      const enemies = this.findNearbyEnemies(unit, activeUnits, battle);
      
      if (enemies.length === 0) {
        continue;
      }

      const target = enemies[0];
      const distance = this.calculateDistance(unit.position, target.position);

      if (distance <= this.MELEE_RANGE) {
        const damage = this.calculateDamage(unit, target);
        target.hp = Math.max(0, target.hp - damage);

        const casualty = Math.floor((damage / target.maxHp) * target.troops_current);
        target.troops_current = Math.max(0, target.troops_current - casualty);

        if (target.hp <= 0) {
          target.status = 'destroyed';
          await this.publishGeneralKIA(battle, target.commanderId, unit.commanderId);
        }

        await this.saveUnit(target, battle.sessionId);
        await this.publishUnitDamaged(battle, target.id, damage, target.hp, unit.id);
      }
    }
  }

  /**
   * 근처 적 유닛 찾기
   */
  private findNearbyEnemies(
    unit: IBattleUnit,
    allUnits: IBattleUnit[],
    battle: IBattleSession
  ): IBattleUnit[] {
    const isAttacker = battle.attackerCommanders.includes(unit.commanderId);
    const enemyCommanders = isAttacker ? battle.defenderCommanders : battle.attackerCommanders;

    return allUnits
      .filter((u) => enemyCommanders.includes(u.commanderId) && u.status === 'active')
      .sort((a, b) => {
        const distA = this.calculateDistance(unit.position, a.position);
        const distB = this.calculateDistance(unit.position, b.position);
        return distA - distB;
      });
  }

  /**
   * 거리 계산
   */
  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 데미지 계산 (Entity 속성 기반)
   */
  private calculateDamage(attacker: IBattleUnit, defender: IBattleUnit): number {
    const baseDamage = attacker.attack * (attacker.morale / 100);
    const defense = defender.defense * (defender.morale / 100);
    const damage = Math.max(1, baseDamage - defense * 0.5);
    
    return Math.round(damage);
  }

  /**
   * 전투 종료 조건 체크
   */
  private async checkBattleEnd(battle: IBattleSession): Promise<void> {
    const units = await this.loadUnits(battle.id, battle.sessionId);
    
    const attackerUnits = units.filter(
      (u) => battle.attackerCommanders.includes(u.commanderId) && u.status === 'active'
    );
    const defenderUnits = units.filter(
      (u) => battle.defenderCommanders.includes(u.commanderId) && u.status === 'active'
    );

    let shouldEnd = false;

    if (attackerUnits.length === 0) {
      shouldEnd = true;
    }

    if (defenderUnits.length === 0) {
      shouldEnd = true;
    }

    const currentRound = battle.mode === BattleMode.REALTIME ? battle.currentTick : battle.currentRound;
    if (currentRound >= this.MAX_ROUNDS) {
      shouldEnd = true;
    }

    const retreatingUnits = units.filter((u) => u.status === 'retreating');
    if (retreatingUnits.length === units.length) {
      shouldEnd = true;
    }

    if (shouldEnd) {
      this.stop();
      await this.battleService.finalizeBattle(battle.id);
    }
  }

  /**
   * BattleTick 이벤트 발행
   */
  private async publishTickEvent(battle: IBattleSession, units: IBattleUnit[]): Promise<void> {
    const event: BattleTickEvent = {
      type: 'BATTLE_TICK',
      battleId: battle.id,
      timestamp: Date.now(),
      version: 1,
      data: {
        round: battle.currentRound,
        tick: battle.currentTick,
        units: units.map((u) => ({
          id: u.id,
          hp: u.hp,
          position: u.position,
          status: u.status,
        })),
      },
    };

    await this.redis.publish(`battle:${battle.id}`, event);
  }

  /**
   * UnitDamaged 이벤트 발행
   */
  private async publishUnitDamaged(
    battle: IBattleSession,
    unitId: string,
    damage: number,
    currentHp: number,
    attackerId?: string
  ): Promise<void> {
    const event: UnitDamagedEvent = {
      type: 'UNIT_DAMAGED',
      battleId: battle.id,
      timestamp: Date.now(),
      version: 1,
      data: {
        unitId,
        damage,
        currentHp,
        attackerId,
      },
    };

    await this.redis.publish(`battle:${battle.id}`, event);
  }

  /**
   * GeneralKIA 이벤트 발행
   */
  private async publishGeneralKIA(
    battle: IBattleSession,
    commanderId: string,
    killerId?: string
  ): Promise<void> {
    const event: GeneralKIAEvent = {
      type: 'GENERAL_KIA',
      battleId: battle.id,
      timestamp: Date.now(),
      version: 1,
      data: {
        commanderId,
        killerId,
      },
    };

    await this.redis.publish(`battle:${battle.id}`, event);
  }

  /**
   * 전투 로드
   */
  private async loadBattle(battleId: string): Promise<IBattleSession | null> {
    const client = this.redis.getClient();
    const keys = await client.keys(`s:*:battle:${battleId}`);
    
    if (keys.length === 0) {
      return null;
    }

    return await this.redis.get<IBattleSession>(keys[0]);
  }

  /**
   * 전투 저장
   */
  private async saveBattle(battle: IBattleSession): Promise<void> {
    const battleKey = `s:${battle.sessionId}:battle:${battle.id}`;
    battle.updatedAt = new Date();
    await this.redis.set(battleKey, battle, 3600);
  }

  /**
   * 유닛 목록 로드
   */
  private async loadUnits(battleId: string, sessionId: string): Promise<IBattleUnit[]> {
    const client = this.redis.getClient();
    const keys = await client.keys(`s:${sessionId}:battle:${battleId}:unit:*`);
    
    const units: IBattleUnit[] = [];
    for (const key of keys) {
      const unit = await this.redis.get<IBattleUnit>(key);
      if (unit) {
        units.push(unit);
      }
    }

    return units;
  }

  /**
   * 유닛 저장
   */
  private async saveUnit(unit: IBattleUnit, sessionId: string): Promise<void> {
    const unitKey = `s:${sessionId}:battle:${unit.battleId}:unit:${unit.id}`;
    unit.updatedAt = new Date();
    await this.redis.set(unitKey, unit, 3600);
  }

  /**
   * 대기 중인 Intent 로드
   */
  private async loadPendingIntents(battleId: string, sessionId: string): Promise<IBattleIntent[]> {
    const client = this.redis.getClient();
    const keys = await client.keys(`s:${sessionId}:battle:${battleId}:intent:*`);
    
    const intents: IBattleIntent[] = [];
    for (const key of keys) {
      const intent = await this.redis.get<IBattleIntent>(key);
      if (intent && intent.status === 'pending') {
        intents.push(intent);
      }
    }

    return intents;
  }

  /**
   * Intent 저장
   */
  private async saveIntent(intent: IBattleIntent, sessionId: string): Promise<void> {
    const intentKey = `s:${sessionId}:battle:${intent.battleId}:intent:${intent.id}`;
    await this.redis.set(intentKey, intent, 3600);
  }
}
