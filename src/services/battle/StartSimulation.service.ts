import { BattleStatus } from '../../models/battle.model';
import { battleRepository } from '../../repositories/battle.repository';
import { BattleSimulationManager } from './BattleSimulation.service';

/**
 * 실시간 전투 시뮬레이션 시작
 * - 모든 유닛이 배치되면 자동으로 시작
 * - AI 제어 유닛 자동 배치
 */
export class StartSimulationService {
  static async execute(data: any, user?: any) {
    const { battleId } = data;

    try {
      if (!battleId) {
        return { success: false, message: '전투 ID가 필요합니다.' };
      }

      const battle = await battleRepository.findByBattleId(battleId);

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.DEPLOYING) {
        return { success: false, message: '배치 단계가 아닙니다' };
      }

      // AI 제어 유닛 자동 배치
      this.autoDeployAIUnits(battle);

      // 전투 상태 변경
      battle.status = BattleStatus.IN_PROGRESS;
      battle.startedAt = new Date();
      await battle.save();

      // 시뮬레이션 시작
      await BattleSimulationManager.startSimulation(battleId);

      return {
        success: true,
        message: '전투 시작',
        battleId: battle.battleId
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * AI 제어 유닛 자동 배치
   */
  private static autoDeployAIUnits(battle: any): void {
    // 공격자 배치
    this.deployUnitsInZone(
      battle.attackerUnits,
      battle.map.attackerZone,
      'attacker'
    );

    // 방어자 배치 (성문 제외)
    const nonGateDefenders = battle.defenderUnits.filter(u => u.generalId !== -1);
    this.deployUnitsInZone(
      nonGateDefenders,
      battle.map.defenderZone,
      'defender'
    );
  }

  /**
   * 배치 영역 내에 유닛 배치
   */
  private static deployUnitsInZone(
    units: any[],
    zone: { x: [number, number]; y: [number, number] },
    side: 'attacker' | 'defender'
  ): void {
    const zoneWidth = zone.x[1] - zone.x[0];
    const zoneHeight = zone.y[1] - zone.y[0];

    // 유닛을 진형에 따라 배치
    units.forEach((unit, index) => {
      // 이미 배치된 유닛은 스킵
      if (unit.position && unit.position.x !== 0 && unit.position.y !== 0) {
        return;
      }

      // 진형별 배치 로직
      const formation = unit.formation || 'line';
      const position = this.calculateFormationPosition(
        index,
        units.length,
        zone,
        formation,
        unit.collisionRadius
      );

      unit.position = position;
      unit.isAIControlled = true; // AI 제어 활성화
    });
  }

  /**
   * 진형별 배치 위치 계산
   */
  private static calculateFormationPosition(
    index: number,
    totalUnits: number,
    zone: { x: [number, number]; y: [number, number] },
    formation: string,
    radius: number
  ): { x: number; y: number } {
    const zoneWidth = zone.x[1] - zone.x[0];
    const zoneHeight = zone.y[1] - zone.y[0];
    const zoneCenterX = zone.x[0] + zoneWidth / 2;
    const zoneCenterY = zone.y[0] + zoneHeight / 2;

    const spacing = radius * 3; // 유닛 간 간격

    switch (formation) {
      case 'line': {
        // 가로 일렬
        const totalWidth = (totalUnits - 1) * spacing;
        const startX = zoneCenterX - totalWidth / 2;
        return {
          x: Math.max(zone.x[0] + radius, Math.min(zone.x[1] - radius, startX + index * spacing)),
          y: zoneCenterY
        };
      }

      case 'column': {
        // 세로 일렬
        const totalHeight = (totalUnits - 1) * spacing;
        const startY = zoneCenterY - totalHeight / 2;
        return {
          x: zoneCenterX,
          y: Math.max(zone.y[0] + radius, Math.min(zone.y[1] - radius, startY + index * spacing))
        };
      }

      case 'wedge': {
        // 쐐기형 (V자)
        const row = Math.floor(Math.sqrt(index));
        const col = index - row * row;
        const offsetX = (col - row / 2) * spacing;
        return {
          x: Math.max(zone.x[0] + radius, Math.min(zone.x[1] - radius, zoneCenterX + offsetX)),
          y: Math.max(zone.y[0] + radius, Math.min(zone.y[1] - radius, zoneCenterY + row * spacing))
        };
      }

      case 'square': {
        // 사각 진형
        const cols = Math.ceil(Math.sqrt(totalUnits));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: Math.max(zone.x[0] + radius, Math.min(zone.x[1] - radius, zoneCenterX + (col - cols / 2) * spacing)),
          y: Math.max(zone.y[0] + radius, Math.min(zone.y[1] - radius, zoneCenterY + (row - cols / 2) * spacing))
        };
      }

      case 'skirmish': {
        // 산개 (랜덤)
        const randomX = zone.x[0] + radius + Math.random() * (zoneWidth - radius * 2);
        const randomY = zone.y[0] + radius + Math.random() * (zoneHeight - radius * 2);
        return { x: randomX, y: randomY };
      }

      default:
        return { x: zoneCenterX, y: zoneCenterY };
    }
  }
}
