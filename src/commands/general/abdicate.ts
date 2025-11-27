import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { JosaUtil } from '../../utils/JosaUtil';
import { General } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

export class AbdicateCommand extends GeneralCommand {
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
      ConstraintHelper.BeLord()
    ];
  }

  protected initWithArg(): void {
    // fullConditionConstraints를 먼저 설정 (비동기 작업은 run()에서 처리)
    this.fullConditionConstraints = [
      ConstraintHelper.BeLord(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral(),
    ];
    
    // destGeneral은 run() 메서드에서 로드됨
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
    const destGeneralName = this.destGeneralObj?.getName() || '';
    const name = (this.constructor as typeof GeneralCommand).getName();
    return `【${destGeneralName}】에게 ${name}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    // destGeneral 로드 (initWithArg에서 비동기 작업을 할 수 없으므로 여기서 처리)
    const sessionId = this.env.session_id || 'sangokushi_default';
    const destGeneralDoc = await generalRepository.findOneByFilter({
      session_id: sessionId,
      'data.no': this.arg.destGeneralID
    });
    
    if (destGeneralDoc) {
      const destGeneral = await General.createObjFromDB(this.arg.destGeneralID, sessionId);
      this.setDestGeneral(destGeneral);
    }
    
    if (!this.destGeneralObj) {
      general.getLogger().pushGeneralActionLog("선양할 장수를 찾을 수 없습니다.");
      return false;
    }

    const destGeneral = this.destGeneralObj;
    const destGeneralPenaltyList = JSON.parse(destGeneral.data.penalty || '{}');
    
    const penaltyKeyList = ['NoChief', 'NoFoundNation', 'NoAmbassador'];
    
    for (const penaltyKey of penaltyKeyList) {
      if (penaltyKey in destGeneralPenaltyList) {
        general.getLogger().pushGeneralActionLog("선양할 수 없는 장수입니다.");
        return false;
      }
    }

    const generalName = general.data.name || general.name;
    const destGeneralName = destGeneral.getName();
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();
    const destLogger = destGeneral.getLogger();

    destGeneral.data.officer_level = 12;
    destGeneral.data.officer_city = 0;
    general.data.officer_level = 1;
    general.data.officer_city = 0;
    // multiplyVar: experience *= 0.7
    general.data.experience = (general.data.experience || 0) * 0.7;
    general.markModified('data');

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【선양】</b></><Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>의 군주 자리를 <Y>${destGeneralName}</>에게 선양했습니다.`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <Y>${destGeneralName}</>에게 선양`);

    logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 군주의 자리를 물려줍니다. <1>${date}</>`);
    destLogger.pushGeneralActionLog(`<Y>${generalName}</>에게서 군주의 자리를 물려받습니다.`);

    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 <Y>${destGeneralName}</>에게 선양`);
    destLogger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 물려 받음`);

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
    
    this.setResultTurn(new LastTurn(AbdicateCommand.getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, destGeneral, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    // PHP: tryUniqueItemLottery 호출 안 함
    
    // 장수 데이터 저장
    await this.saveGeneral();
    await destGeneral.save();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    // 같은 국가의 다른 장수들 조회 (선양 대상 후보)
    const generals = await generalRepository.findByFilter({
      session_id: this.generalObj.getSessionID(),
      'data.nation': { $eq: this.generalObj.getNationID(), $ne: 0 },
      'data.no': { $ne: this.generalObj.getID() }
    });

    const destRawGenerals = generals.map(g => ({
      no: g.data?.no || 0,
      name: g.data?.name || '',
      officerLevel: g.data?.officer_level || 0,
      npc: g.data?.npc || 0,
      leadership: g.data?.leadership || 0,
      strength: g.data?.strength || 0,
      intel: g.data?.intel || 0
    }));

    return {
      procRes: {
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}
