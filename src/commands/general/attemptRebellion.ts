import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { JosaUtil } from '../../utils/JosaUtil';
import { General } from '../../models/General';

export class AttemptRebellionCommand extends GeneralCommand {
  protected static actionName = '모반시도';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // BeChief(),
      // OccupiedCity(),
      // SuppliedCity(),
      // NotLord(),
      // AllowRebellion(),
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    const nationID = general.getNationID();

    const lordID = await db.queryFirstField(
      'SELECT no FROM general WHERE nation = ? AND officer_level = 12',
      [nationID]
    );

    // TODO: const lordGeneral = General.createObjFromDB(lordID);
    const lordGeneral: any = null; // placeholder

    const generalName = general.getName();
    const lordName = lordGeneral?.getName() || '';
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();
    const lordLogger = lordGeneral?.getLogger();

    general.setVar('officer_level', 12);
    general.setVar('officer_city', 0);
    lordGeneral?.setVar('officer_level', 1);
    lordGeneral?.setVar('officer_city', 0);
    lordGeneral?.multiplyVar('experience', 0.7);

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【모반】</b></><Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>의 군주 자리를 찬탈했습니다.`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <Y>${lordName}</>에게서 군주자리를 찬탈`);

    logger.pushGeneralActionLog(`모반에 성공했습니다. <1>${date}</>`);
    lordLogger?.pushGeneralActionLog(`<Y>${generalName}</>에게 군주의 자리를 뺏겼습니다.`);

    logger.pushGeneralHistoryLog(`모반으로 <D><b>${nationName}</b></>의 군주자리를 찬탈`) as any;
    lordLogger?.pushGeneralHistoryLog(`<D><b>${generalName}</b></>의 모반으로 인해 <D><b>${nationName}</b></>의 군주자리를 박탈당함`);

    this.setResultTurn(new LastTurn(AttemptRebellionCommand.getName(), this.arg));
    
    // TODO: general.increaseInheritancePoint(InheritanceKey.active_action, 1);
    
    general.checkStatChange();

    // TODO: StaticEventHandler.handleEvent
    
    general.applyDB(db);
    lordGeneral?.applyDB(db);

    return true;
  }
}
