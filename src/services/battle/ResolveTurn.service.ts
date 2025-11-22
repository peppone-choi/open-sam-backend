import { BattleStatus, BattlePhase, IBattleUnit, ITurnAction } from '../../models/battle.model';
import { battleRepository } from '../../repositories/battle.repository';
import { CrewType } from '../../models/crew-type.model';

/**
 * ResolveTurn - 전술 전투 턴 해결 로직
 * 
 * 40x40 격자 기반 전술 전투 시스템
 * - 이동 처리 (충돌 검사)
 * - 공격 처리 (병종 상성, 데미지 계산)
 * - 승리 조건 체크
 */

interface BattleEvent {
  type: 'move' | 'attack' | 'damage' | 'death' | 'victory';
  actorId: number;
  actorName: string;
  targetId?: number;
  targetName?: string;
  position?: { x: number; y: number };
  damage?: number;
  message: string;
}

interface CombatResult {
  attackerId: number;
  defenderId: number;
  damage: number;
  defenderKilled: boolean;
  advantageText: string;
}

export class ResolveTurnService {
  /**
   * 턴 해결 메인 함수
   */
  static async execute(battleId: string): Promise<{ success: boolean; message: string; events?: BattleEvent[] }> {
    try {
      const battle = await battleRepository.findByBattleId(battleId);

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.IN_PROGRESS) {
        return { success: false, message: '전투가 진행 중이 아닙니다' };
      }

      if (battle.currentPhase !== BattlePhase.PLANNING) {
        return { success: false, message: '계획 단계가 아닙니다' };
      }

      // 해결 단계로 전환
      battle.currentPhase = BattlePhase.RESOLUTION;
      await battle.save();

      const events: BattleEvent[] = [];
      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];

      // 1. 이동 처리
      const moveActions = battle.currentTurnActions.filter(a => a.action === 'move');
      for (const action of moveActions) {
        const result = this.processMove(battle, action, allUnits);
        if (result) events.push(result);
      }

      // 2. 공격 처리
      const attackActions = battle.currentTurnActions.filter(a => a.action === 'attack');
      const combatResults: CombatResult[] = [];

      for (const action of attackActions) {
        const result = this.processAttack(battle, action, allUnits);
        if (result) {
          combatResults.push(result);
          events.push({
            type: 'attack',
            actorId: result.attackerId,
            actorName: this.getUnitName(allUnits, result.attackerId),
            targetId: result.defenderId,
            targetName: this.getUnitName(allUnits, result.defenderId),
            damage: result.damage,
            message: `${this.getUnitName(allUnits, result.attackerId)}이(가) ${this.getUnitName(allUnits, result.defenderId)}을(를) 공격 (${result.advantageText}) → ${result.damage} 피해`
          });

          if (result.defenderKilled) {
            events.push({
              type: 'death',
              actorId: result.defenderId,
              actorName: this.getUnitName(allUnits, result.defenderId),
              message: `${this.getUnitName(allUnits, result.defenderId)}이(가) 전사했습니다!`
            });
          }
        }
      }

      // 3. 데미지 적용
      this.applyDamage(battle, combatResults);

      // 4. 전사한 유닛 제거
      battle.attackerUnits = battle.attackerUnits.filter(u => u.troops > 0);
      battle.defenderUnits = battle.defenderUnits.filter(u => u.troops > 0);

      // 5. 승리 조건 체크
      const victoryCheck = this.checkVictory(battle);

      if (victoryCheck.hasWinner) {
        battle.status = BattleStatus.COMPLETED;
        battle.winner = victoryCheck.winner;
        battle.completedAt = new Date();

        events.push({
          type: 'victory',
          actorId: 0,
          actorName: victoryCheck.winner === 'attacker' ? '공격군' : '방어군',
          message: `${victoryCheck.winner === 'attacker' ? '공격군' : '방어군'}이(가) 승리했습니다!`
        });
      } else {
        // 턴 증가
        battle.currentTurn += 1;

        // 최대 턴 수 체크
        if (battle.currentTurn >= battle.maxTurns) {
          battle.status = BattleStatus.COMPLETED;
          battle.winner = 'draw';
          battle.completedAt = new Date();

          events.push({
            type: 'victory',
            actorId: 0,
            actorName: '무승부',
            message: `최대 턴 수에 도달하여 무승부로 종료됩니다`
          });
        } else {
          // 다음 턴 Planning 단계로 전환
          battle.currentPhase = BattlePhase.PLANNING;
          battle.currentTurnActions = [];
        }
      }

      // 6. 전투 기록 저장
      battle.turnHistory.push({
        turnNumber: battle.currentTurn,
        timestamp: new Date(),
        actions: battle.currentTurnActions,
        results: {
          attackerDamage: combatResults.filter(r => this.isAttacker(battle, r.defenderId)).reduce((sum, r) => sum + r.damage, 0),
          defenderDamage: combatResults.filter(r => !this.isAttacker(battle, r.defenderId)).reduce((sum, r) => sum + r.damage, 0),
          events: events.map(e => e.message)
        },
        battleLog: events.map(e => e.message)
      });

      await battle.save();

      return {
        success: true,
        message: '턴 해결 완료',
        events
      };

    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 이동 처리
   */
  private static processMove(battle: any, action: ITurnAction, allUnits: IBattleUnit[]): BattleEvent | null {
    const unit = allUnits.find(u => u.generalId === action.generalId);
    if (!unit || !unit.position || !action.target) return null;

    // 충돌 체크
    const hasCollision = allUnits.some(
      u => u.position &&
        u.position.x === action.target!.x &&
        u.position.y === action.target!.y &&
        u.generalId !== action.generalId
    );

    if (hasCollision) {
      return {
        type: 'move',
        actorId: unit.generalId,
        actorName: unit.generalName,
        message: `${unit.generalName}의 이동 실패 (충돌)`
      };
    }

    // 이동 성공
    unit.position.x = action.target.x;
    unit.position.y = action.target.y;

    return {
      type: 'move',
      actorId: unit.generalId,
      actorName: unit.generalName,
      position: { x: action.target.x, y: action.target.y },
      message: `${unit.generalName}이(가) (${action.target.x}, ${action.target.y})로 이동`
    };
  }

  /**
   * 공격 처리
   */
  private static processAttack(battle: any, action: ITurnAction, allUnits: IBattleUnit[]): CombatResult | null {
    const attacker = allUnits.find(u => u.generalId === action.generalId);
    if (!attacker || !attacker.position || !action.target) return null;

    // 타겟 유닛 찾기
    const defender = allUnits.find(
      u => u.position &&
        u.position.x === action.target!.x &&
        u.position.y === action.target!.y &&
        u.generalId !== action.generalId
    );

    if (!defender) return null;

    // 데미지 계산
    const damage = this.calculateDamage(attacker, defender);
    const defenderKilled = defender.troops <= damage;
    
    const attackerCrewId = this.unitTypeToCrewTypeId(attacker.unitType as string, attacker.generalId);
    const defenderCrewId = this.unitTypeToCrewTypeId(defender.unitType as string, defender.generalId);
    const advantageText = CrewType.getAdvantageText(attackerCrewId, defenderCrewId);

    return {
      attackerId: attacker.generalId,
      defenderId: defender.generalId,
      damage,
      defenderKilled,
      advantageText
    };
  }

  /**
   * UnitType을 CrewType ID로 변환
   */
  private static unitTypeToCrewTypeId(unitType: string, generalId?: number): number {
    // 성문 유닛 특수 처리
    if (generalId === -1) {
      return 100; // 성문
    }

    const mapping: Record<string, number> = {
      'FOOTMAN': 1,   // 창병
      'CAVALRY': 4,   // 기병
      'ARCHER': 3,    // 노병
      'WIZARD': 3,    // 노병 (요술사)
      'SIEGE': 5      // 충차
    };
    return mapping[unitType] || 1;
  }

  /**
   * 데미지 계산
   * 
   * 공식:
   * - 기본 공격력 = CrewType.getComputedAttack(병종, 통솔, 무력, 지력, 기술)
   * - 기본 방어력 = CrewType.getComputedDefence(병종, 병사수, 기술)
   * - 상성 계수 = CrewType.getAttackCoef(공격자 병종, 방어자 병종)
   * - 최종 데미지 = (공격력 × 상성계수 - 방어력) × 랜덤(0.9~1.1)
   */
  private static calculateDamage(attacker: IBattleUnit, defender: IBattleUnit): number {
    // UnitType → CrewType ID 변환 (성문 유닛 고려)
    const attackerCrewId = this.unitTypeToCrewTypeId(attacker.unitType as string, attacker.generalId);
    const defenderCrewId = this.unitTypeToCrewTypeId(defender.unitType as string, defender.generalId);

    // 1. 공격자 공격력
    const attackPower = CrewType.getComputedAttack(
      attackerCrewId,
      attacker.leadership,
      attacker.strength,
      attacker.intelligence,
      attacker.techLevel
    );

    // 2. 방어자 방어력
    const defensePower = CrewType.getComputedDefence(
      defenderCrewId,
      defender.troops,
      defender.techLevel
    );

    // 3. 병종 상성 계수
    const attackCoef = CrewType.getAttackCoef(attackerCrewId, defenderCrewId);
    const defenseCoef = CrewType.getDefenceCoef(defenderCrewId, attackerCrewId);

    // 4. 사기/훈련도 보너스
    const moraleBonus = 0.8 + (attacker.morale / 100) * 0.4; // 0.8 ~ 1.2
    const trainingBonus = 0.8 + (attacker.training / 100) * 0.4; // 0.8 ~ 1.2

    // 5. 최종 데미지
    const rawDamage = (attackPower * attackCoef * moraleBonus * trainingBonus) - (defensePower * defenseCoef);
    const variance = 0.9 + Math.random() * 0.2; // 0.9 ~ 1.1
    const finalDamage = Math.max(10, Math.floor(rawDamage * variance));

    // 6. 병사 수로 변환 (데미지 1000당 병사 약 100명)
    const troopLoss = Math.floor(finalDamage / 10);

    return Math.min(troopLoss, defender.troops); // 최대 방어자 병사 수
  }

  /**
   * 데미지 적용
   */
  private static applyDamage(battle: any, combatResults: CombatResult[]): void {
    for (const result of combatResults) {
      const defender = [...battle.attackerUnits, ...battle.defenderUnits].find(
        u => u.generalId === result.defenderId
      );

      if (defender) {
        defender.troops = Math.max(0, defender.troops - result.damage);
      }
    }
  }

  /**
   * 승리 조건 체크
   * 
   * 승리 조건:
   * - 공격군: 방어군 전멸 OR 성문 파괴
   * - 방어군: 공격군 전멸 OR 최대 턴 수 도달
   */
  private static checkVictory(battle: any): { hasWinner: boolean; winner?: 'attacker' | 'defender' } {
    const attackerAlive = battle.attackerUnits.length > 0;
    const defenderAlive = battle.defenderUnits.length > 0;

    // 성문 체크 (generalId === -1)
    const gateUnit = battle.defenderUnits.find((u: IBattleUnit) => u.generalId === -1);
    const gateDestroyed = !gateUnit || gateUnit.troops <= 0;

    // 동시 전멸 시 방어군 승리
    if (!attackerAlive && !defenderAlive) {
      return { hasWinner: true, winner: 'defender' };
    }

    // 공격군 전멸 시 방어군 승리
    if (!attackerAlive) {
      return { hasWinner: true, winner: 'defender' };
    }

    // 방어군 전멸 OR 성문 파괴 시 공격군 승리
    if (!defenderAlive || gateDestroyed) {
      return { hasWinner: true, winner: 'attacker' };
    }

    return { hasWinner: false };
  }

  /**
   * 유닛 이름 가져오기
   */
  private static getUnitName(units: IBattleUnit[], generalId: number): string {
    const unit = units.find(u => u.generalId === generalId);
    return unit?.generalName || '알 수 없음';
  }

  /**
   * 공격군 여부 체크
   */
  private static isAttacker(battle: any, generalId: number): boolean {
    return battle.attackerUnits.some((u: IBattleUnit) => u.generalId === generalId);
  }
}
