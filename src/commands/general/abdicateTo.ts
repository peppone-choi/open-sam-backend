import { GeneralCommand } from '../base/GeneralCommand';
import { generalRepository } from '../../repositories/general.repository';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { General } from '../../models/general.model';
import { PenaltyKey, InheritanceKey } from '../../types/Enums';

/**
 * 선양 커맨드
 * 
 * 군주가 다른 장수에게 군주 자리를 물려줍니다.
 */
export class AbdicateToCommand extends GeneralCommand {
  protected static actionName = '선양';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destGeneralID' in this.arg)) {
      return false;
    }
    const destGeneralID = this.arg.destGeneralID;
    if (typeof destGeneralID !== 'number') {
      return false;
    }
    if (destGeneralID <= 0) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }
    this.arg = {
      destGeneralID: destGeneralID
    };
    return true;
  }

  protected init(): void {
    this.setNation();

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // BeLord()
    ];
  }

  protected async initWithArg(): Promise<void> {
    const destGeneralID = this.arg.destGeneralID;
    const sessionId = this.env['session_id'] || 'sangokushi_default';
    const destGeneral = await generalRepository.findOneByFilter({ 
      session_id: sessionId,
      'data.no': destGeneralID 
    });
    if (!destGeneral) {
      throw new Error('대상 장수를 찾을 수 없습니다');
    }
    this.setDestGeneral(destGeneral);

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // BeLord(),
      // ExistsDestGeneral(),
      // FriendlyDestGeneral(),
    ];
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const destGeneralName = this.destGeneralObj?.getName() || '알 수 없는 장수';
    const name = AbdicateToCommand.getName();
    return `【${destGeneralName}】에게 ${name}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime(general.TURNTIME_HM);

    const destGeneral = this.destGeneralObj;
    const destGeneralPenaltyList = JSON.parse(destGeneral.getVar('penalty') || '{}');
    const penaltyKeyList = [PenaltyKey.NoChief, PenaltyKey.NoFoundNation, PenaltyKey.NoAmbassador];
    for (const penaltyKey of penaltyKeyList) {
      if (penaltyKey in destGeneralPenaltyList) {
        general.getLogger().pushGeneralActionLog('선양할 수 없는 장수입니다.');
        return false;
      }
    }

    const generalName = general.getName();
    const destGeneralName = destGeneral.getName();
    const nationName = this.nation.name;

    const logger = general.getLogger();
    const destLogger = destGeneral.getLogger();

    destGeneral.setVar('officer_level', 12);
    destGeneral.setVar('officer_city', 0);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.multiplyVar('experience', 0.7);

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【선양】</b></><Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>의 군주 자리를 <Y>${destGeneralName}</>에게 선양했습니다.`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <Y>${destGeneralName}</>에게 선양`);

    logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 군주의 자리를 물려줍니다. <1>${date}</>`);
    destLogger.pushGeneralActionLog(`<Y>${generalName}</>에게서 군주의 자리를 물려받습니다.`);

    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 <Y>${destGeneralName}</>에게 선양`);
    destLogger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 물려 받음`);

    general.increaseInheritancePoint(InheritanceKey.active_action, 1);
    this.setResultTurn(new LastTurn(AbdicateToCommand.getName(), this.arg));
    general.checkStatChange();

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(
        general,
        destGeneral,
        this,
        this.env,
        this.arg
      );
    } catch (error: any) {
      console.error('StaticEventHandler failed:', error);
    }

    // 장수 데이터 저장
    await general.save();
    await destGeneral.save();

    return true;
  }

  public async exportJSVars(): Promise<Record<string, any>> {
    const sessionId = this.env['session_id'] || 'sangokushi_default';
    const nationID = this.generalObj.getNationID();
    const generalID = this.generalObj.getID();
    
    const destRawGenerals = (await generalRepository.findByFilter({
      session_id: sessionId,
      nation: nationID,
      'data.no': { $ne: generalID }
    }))
      .map((g: any) => ({
        data: {
          no: g.data?.no,
          name: g.data?.name,
          officer_level: g.data?.officer_level,
          npc: g.data?.npc,
          leadership: g.data?.leadership,
          strength: g.data?.strength,
          intel: g.data?.intel
        }
      }))
      .sort((a, b) => {
        if (a.data?.npc !== b.data?.npc) return (a.data?.npc || 0) - (b.data?.npc || 0);
        return (a.data?.name || '').localeCompare(b.data?.name || '');
      });

    return {
      procRes: {
        generals: destRawGenerals.map(g => ({
          no: g.data?.no,
          name: g.data?.name,
          officerLevel: g.data?.officer_level,
          npc: g.data?.npc,
          leadership: g.data?.leadership,
          strength: g.data?.strength,
          intel: g.data?.intel
        })),
        generalsKey: ['no', 'name', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}

