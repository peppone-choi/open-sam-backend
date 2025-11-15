/**
 * 쿠데타 (Coup d'état)
 * 정부 전복 시도 - 성공 시 정권 장악, 실패 시 반역자로 처형
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';
import { getRankIndex } from '../../../utils/logh-rank-system';

export class CoupCommand extends BaseLoghCommand {
  getName(): string {
    return 'coup';
  }

  getDisplayName(): string {
    return '쿠데타';
  }

  getDescription(): string {
    return '정부 전복 시도';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'diplomatic';
  }

  getRequiredCommandPoints(): number {
    return 100;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 제약 조건: 高位 계급이어야 함 (准将 이상)
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          const rankIndex = getRankIndex(input.commander.getRank(), input.commander.getFactionType());
          return rankIndex >= 14; // 准将(14) 이상
        },
        '쿠데타는 准将 이상의 계급에서만 가능합니다.'
      )
    );

    // 함대 보유 필수
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '쿠데타를 위해서는 함대가 필요합니다.'
      )
    );

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // Commander 문서 조회
    const commanderDoc = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: commander.no,
    });

    if (!commanderDoc) {
      return {
        success: false,
        message: '커맨더 정보를 찾을 수 없습니다.',
      };
    }

    // 함대 확인
    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId: commanderDoc.fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 쿠데타 성공률 계산
    const baseSuccessRate = 30; // 기본 30%
    const rankBonus = commanderDoc.rank * 2; // 계급 보너스
    const fleetBonus = Math.min(20, fleet.totalShips / 1000); // 함대 규모 보너스
    const achievementBonus = Math.min(15, commanderDoc.merit / 1000); // 공적 보너스
    const moraleBonus = (fleet.morale - 50) / 5; // 사기 보너스
    
    const successRate = baseSuccessRate + rankBonus + fleetBonus + achievementBonus + moraleBonus;
    const roll = Math.random() * 100;

    // CP 소모 (실패해도 소모)
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    if (roll <= successRate) {
      // 쿠데타 성공!
      
      // 같은 세력의 모든 행성을 장악
      const planets = await Planet.find({
        session_id: commander.session_id,
        owner: commanderDoc.faction,
      });

      // 행성 충성도 변경 (일부는 저항)
      let controlledPlanets = 0;
      for (const planet of planets) {
        // 충성도가 낮은 행성은 쉽게 장악
        if (planet.stats.loyalty < 70 || Math.random() * 100 < 60) {
          // 임시로 customData에 쿠데타 정보 저장
          if (!planet.description) planet.description = '';
          planet.description += ` [${commanderDoc.name} 정권]`;
          await planet.save();
          controlledPlanets++;
        }
      }

      // 계급 최고위로 승진
      commanderDoc.setRankByName('元帥');
      commanderDoc.jobPosition = '최고사령관';
      
      // 공적 대폭 증가
      commanderDoc.merit += 10000;

      await commanderDoc.save();
      await commander.save();

      return {
        success: true,
        message: `쿠데타 성공! ${commanderDoc.faction === 'empire' ? '은하제국' : '자유혹성동맹'}의 정권을 장악했습니다. (성공률: ${successRate.toFixed(1)}%, ${controlledPlanets}개 행성 장악)`,
        effects: [
          {
            type: 'coup_success',
            commanderNo: commander.no,
            faction: commanderDoc.faction,
            successRate,
            controlledPlanets,
          },
        ],
      };
    } else {
      // 쿠데타 실패!
      
      // 반역자로 낙인
      commanderDoc.status = 'executed';
      commanderDoc.isActive = false;
      
      // 함대 해산
      if (fleet) {
        fleet.status = 'idle';
        fleet.commanderId = undefined;
        fleet.commanderName = '무소속';
        await fleet.save();
      }

      commanderDoc.fleetId = null;
      
      await commanderDoc.save();
      await commander.save();

      return {
        success: false,
        message: `쿠데타 실패! 반역자로 처형되었습니다. (성공률: ${successRate.toFixed(1)}%)`,
        effects: [
          {
            type: 'coup_failure',
            commanderNo: commander.no,
            faction: commanderDoc.faction,
            successRate,
          },
        ],
      };
    }
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
