import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { JosaUtil } from '../../utils/JosaUtil';
import { General } from '../../models/General';

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
      // TODO: ConstraintHelper.BeLord()
    ];
  }

  protected initWithArg(): void {
    // TODO: const destGeneral = General.createObjFromDB(this.arg.destGeneralID);
    // this.setDestGeneral(destGeneral);

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
    const destGeneralName = this.destGeneralObj?.getName() || '';
    const name = (this.constructor as typeof GeneralCommand).getName();
    return `【${destGeneralName}】에게 ${name}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    const destGeneral = this.destGeneralObj;
    const destGeneralPenaltyList = JSON.parse(destGeneral.getVar('penalty') || '{}');
    
    const penaltyKeyList = ['NoChief', 'NoFoundNation', 'NoAmbassador'];
    
    for (const penaltyKey of penaltyKeyList) {
      if (penaltyKey in destGeneralPenaltyList) {
        general.getLogger().pushGeneralActionLog("선양할 수 없는 장수입니다.");
        return false;
      }
    }

    const generalName = general.getName();
    const destGeneralName = destGeneral.getName();
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();
    const destLogger = destGeneral.getLogger();

    destGeneral.setVar('officer_level', 12);
    destGeneral.setVar('officer_city', 0);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.multiplyVar('experience', 0.7);

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【선양】</b></><Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>의 군주 자리를 <Y>${destGeneralName}</>에게 선양했습니다.`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <Y>${destGeneralName}</>에게 선양`);

    logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 군주의 자리를 물려줍니다. <1>${date}</>`);
    destLogger.pushGeneralActionLog(`<Y>${generalName}</>에게서 군주의 자리를 물려받습니다.`);

    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 <Y>${destGeneralName}</>에게 선양`) as any;
    destLogger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>의 군주자리를 물려 받음`);

    // TODO: general.increaseInheritancePoint(InheritanceKey.active_action, 1);
    
    this.setResultTurn(new LastTurn(AbdicateCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler.handleEvent
    
    general.applyDB(db);
    destGeneral.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const db = DB.db();
    const destRawGenerals = await db.queryAllLists(
      'SELECT no,name,officer_level,npc,leadership,strength,intel FROM general WHERE nation != 0 AND nation = ? AND no != ? ORDER BY npc,binary(name)',
      [this.generalObj.getNationID(), this.generalObj.getID()]
    );

    return {
      procRes: {
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}
