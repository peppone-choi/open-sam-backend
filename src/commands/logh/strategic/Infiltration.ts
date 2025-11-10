/**
 * 잠입 공작 (Infiltration)
 * 적 진영에 스파이 파견 - 지속적인 정보 수집 및 방해 공작
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Planet } from '../../../models/logh/Planet.model';

export class InfiltrationCommand extends BaseLoghCommand {
  getName(): string {
    return 'infiltration';
  }

  getDisplayName(): string {
    return '잠입 공작';
  }

  getDescription(): string {
    return '적 진영에 스파이 파견';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 50;
  }

  getRequiredTurns(): number {
    return 0;
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

    // 잠입 대상 행성 지정
    const targetPlanetId = env?.targetPlanetId;
    const infiltrationType = env?.infiltrationType || 'intelligence'; // 'intelligence', 'sabotage', 'rebellion'

    if (!targetPlanetId) {
      return {
        success: false,
        message: '잠입할 행성을 지정해주세요.',
      };
    }

    // 대상 행성 조회
    const targetPlanet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: targetPlanetId,
    });

    if (!targetPlanet) {
      return {
        success: false,
        message: '대상 행성을 찾을 수 없습니다.',
      };
    }

    // 아군 행성에는 잠입 불가
    if (targetPlanet.owner === commander.getFactionType()) {
      return {
        success: false,
        message: '아군 행성에는 잠입할 수 없습니다.',
      };
    }

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

    // 자금 소비
    const cost = 50000;
    if ((commanderDoc.personalFunds || 0) < cost) {
      return {
        success: false,
        message: `개인 자금이 부족합니다. (필요: ${cost}, 보유: ${commanderDoc.personalFunds || 0})`,
      };
    }

    commanderDoc.personalFunds = (commanderDoc.personalFunds || 0) - cost;

    // 잠입 성공률 계산
    const baseSuccessRate = 50;
    const politicsBonus = (commanderDoc.stats.politics - 50) / 2; // 정치 능력 보너스
    const loyaltyPenalty = (targetPlanet.stats.loyalty - 50) / 5; // 충성도가 높으면 어려움
    const successRate = Math.max(10, Math.min(90, baseSuccessRate + politicsBonus - loyaltyPenalty));

    const roll = Math.random() * 100;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    if (roll <= successRate) {
      // 잠입 성공!
      
      let effect = '';
      let effectValue = 0;

      switch (infiltrationType) {
        case 'intelligence':
          // 정보 수집 - 행성 정보 노출
          effect = '정보 수집';
          effectValue = 1;
          
          // customData에 스파이 정보 저장
          if (!targetPlanet.customData) targetPlanet.customData = {};
          if (!targetPlanet.customData.spies) targetPlanet.customData.spies = [];
          targetPlanet.customData.spies.push({
            commanderNo: commander.no,
            faction: commander.getFactionType(),
            type: 'intelligence',
            installedAt: new Date(),
          });
          targetPlanet.markModified('customData');
          break;

        case 'sabotage':
          // 방해 공작 - 생산력 감소
          effect = '생산 방해';
          effectValue = Math.floor(Math.random() * 20) + 10; // 10-30 감소
          targetPlanet.production.ships = Math.max(0, targetPlanet.production.ships - effectValue);
          targetPlanet.markModified('production');
          break;

        case 'rebellion':
          // 반란 선동 - 충성도 감소
          effect = '반란 선동';
          effectValue = Math.floor(Math.random() * 15) + 10; // 10-25 감소
          targetPlanet.stats.loyalty = Math.max(0, targetPlanet.stats.loyalty - effectValue);
          targetPlanet.markModified('stats');
          break;
      }

      await targetPlanet.save();
      await commanderDoc.save();
      await commander.save();

      return {
        success: true,
        message: `${targetPlanet.name}에 잠입 공작 성공! (${effect}, 성공률: ${successRate.toFixed(1)}%)`,
        effects: [
          {
            type: 'infiltration_success',
            targetPlanetId,
            targetPlanetName: targetPlanet.name,
            infiltrationType,
            effect,
            effectValue,
            successRate,
          },
        ],
      };
    } else {
      // 잠입 실패 - 발각
      
      await commanderDoc.save();
      await commander.save();

      return {
        success: false,
        message: `${targetPlanet.name} 잠입 공작 실패! 발각되었습니다. (성공률: ${successRate.toFixed(1)}%)`,
        effects: [
          {
            type: 'infiltration_failure',
            targetPlanetId,
            targetPlanetName: targetPlanet.name,
            successRate,
          },
        ],
      };
    }
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
