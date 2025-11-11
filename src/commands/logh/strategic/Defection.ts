/**
 * 망명 (Defection)
 * 타 세력에 망명. 망명 후 망명처 수도에 구금되어 처단 대기
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class DefectionCommand extends BaseLoghCommand {
  getName(): string {
    return 'defection';
  }

  getDisplayName(): string {
    return '망명';
  }

  getDescription(): string {
    return '타 세력에 망명. 망명 후 망명처 수도에 구금되어 처단 대기';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 320;
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

    // 망명할 세력 지정
    const targetFaction = env?.targetFaction as 'empire' | 'alliance';
    
    if (!targetFaction || targetFaction === commander.getFactionType()) {
      return {
        success: false,
        message: '망명할 세력을 지정해주세요. (현재와 다른 세력)',
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

    const originalFaction = commanderDoc.faction;

    // 보유 함대가 있으면 함대도 같이 망명
    let fleetDefected = false;
    if (commanderDoc.fleetId) {
      const fleet = await Fleet.findOne({
        session_id: commander.session_id,
        fleetId: commanderDoc.fleetId,
      });

      if (fleet) {
        fleet.faction = targetFaction;
        fleet.commanderName = `${commanderDoc.name} (망명)`;
        await fleet.save();
        fleetDefected = true;
      }
    }

    // 세력 변경
    commanderDoc.originalFaction = originalFaction;
    commanderDoc.faction = targetFaction;
    commanderDoc.status = 'imprisoned'; // 망명 후 구금 상태
    
    // 망명처 수도 찾기
    const targetCapital = await Planet.findOne({
      session_id: commander.session_id,
      owner: targetFaction,
      isCapital: true,
    });

    // 수도가 없으면 해당 세력의 첫 번째 행성
    const targetPlanet = targetCapital || await Planet.findOne({
      session_id: commander.session_id,
      owner: targetFaction,
    });

    if (targetPlanet) {
      commanderDoc.position.x = targetPlanet.gridCoordinates.x;
      commanderDoc.position.y = targetPlanet.gridCoordinates.y;
      commanderDoc.position.z = 0;
    }

    // 계급 강등 (망명자는 최하위 계급으로)
    commanderDoc.setRankByName('이등병');
    
    // 개인 자금 몰수
    commanderDoc.personalFunds = 0;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await commanderDoc.save();
    await commander.save();

    const factionName = targetFaction === 'empire' ? '은하제국' : '자유혹성동맹';
    
    return {
      success: true,
      message: `${factionName}에 망명했습니다. 현재 구금 상태이며 처단을 기다리고 있습니다.${fleetDefected ? ' (함대도 함께 망명)' : ''}`,
      effects: [
        {
          type: 'defection',
          commanderNo: commander.no,
          originalFaction,
          newFaction: targetFaction,
          fleetDefected,
          status: 'imprisoned',
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
