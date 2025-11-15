/**
 * 정보 수집 (Espionage)
 * 적 정보 수집 및 분석 - 특정 함대/행성의 상세 정보
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { LoghCommander } from '../../../models/logh/Commander.model';

export class EspionageCommand extends BaseLoghCommand {
  getName(): string {
    return 'espionage';
  }

  getDisplayName(): string {
    return '정보 수집';
  }

  getDescription(): string {
    return '적 정보 수집 및 분석';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 35;
  }

  getRequiredTurns(): number {
    return 120;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 정보 수집 대상 지정
    const targetType = env?.targetType; // 'fleet', 'planet', 'commander'
    const targetId = env?.targetId;

    if (!targetType || !targetId) {
      return {
        success: false,
        message: '정보 수집 대상을 지정해주세요. (targetType: fleet/planet/commander, targetId)',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    let targetInfo: any = null;
    let targetName = '';

    // 대상 유형에 따라 정보 수집
    switch (targetType) {
      case 'fleet': {
        const fleet = await Fleet.findOne({
          session_id: commander.session_id,
          fleetId: targetId,
        });

        if (!fleet) {
          return {
            success: false,
            message: '대상 함대를 찾을 수 없습니다.',
          };
        }

        // 아군 정보는 언제든지 볼 수 있음
        if (fleet.faction === commander.getFactionType()) {
          return {
            success: false,
            message: '아군 함대 정보는 정보 수집 없이 확인할 수 있습니다.',
          };
        }

        targetName = fleet.name;
        targetInfo = {
          type: 'fleet',
          name: fleet.name,
          faction: fleet.faction,
          commanderName: fleet.commanderName,
          totalShips: fleet.totalShips,
          totalStrength: fleet.totalStrength,
          position: fleet.strategicPosition,
          status: fleet.status,
          formation: fleet.formation,
          morale: fleet.morale,
          ships: fleet.ships.map(s => ({
            type: s.type,
            count: s.count,
            health: s.health,
          })),
          training: fleet.training,
          isInCombat: fleet.isInCombat,
        };
        break;
      }

      case 'planet': {
        const planet = await Planet.findOne({
          session_id: commander.session_id,
          planetId: targetId,
        });

        if (!planet) {
          return {
            success: false,
            message: '대상 행성을 찾을 수 없습니다.',
          };
        }

        targetName = planet.name;
        targetInfo = {
          type: 'planet',
          name: planet.name,
          owner: planet.owner,
          position: planet.gridCoordinates,
          stats: planet.stats,
          production: planet.production,
          warehouse: planet.warehouse,
          economy: planet.economy,
          isFortress: planet.isFortress,
          fortressGuns: planet.fortressGuns,
          facilities: planet.facilities,
          garrisonFleetId: planet.garrisonFleetId,
        };
        break;
      }

      case 'commander': {
        const targetCommander = await LoghCommander.findOne({
          session_id: commander.session_id,
          no: parseInt(targetId),
        });

        if (!targetCommander) {
          return {
            success: false,
            message: '대상 커맨더를 찾을 수 없습니다.',
          };
        }

        if (targetCommander.faction === commander.getFactionType()) {
          return {
            success: false,
            message: '아군 커맨더 정보는 정보 수집 없이 확인할 수 있습니다.',
          };
        }

        targetName = targetCommander.name;
        targetInfo = {
          type: 'commander',
          name: targetCommander.name,
          faction: targetCommander.faction,
          rank: targetCommander.rank,
          jobPosition: targetCommander.jobPosition,
          stats: targetCommander.stats,
          achievements: targetCommander.achievements,
          fleetId: targetCommander.fleetId,
          position: targetCommander.position,
          status: targetCommander.status,
        };
        break;
      }

      default:
        return {
          success: false,
          message: '잘못된 대상 유형입니다. (fleet, planet, commander 중 선택)',
        };
    }

    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('espionage', durationMs, {
      targetType,
      targetId,
      targetName,
    });

    return {
      success: true,
      message: `${targetName}에 대한 정보 수집을 시작했습니다.`,
      effects: [
        {
          type: 'espionage',
          targetType,
          targetId,
          targetName,
          intelligence: targetInfo,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
