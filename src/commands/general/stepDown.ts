import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';

export class StepDownCommand extends GeneralCommand {
  protected static actionName = '하야';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // NotLord(),
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

    // TODO: Legacy DB access - const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalID = general.getID();
    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');

    const nationID = this.nation?.nation || 0;
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>에서 하야했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>에서 하야`) as any;
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>에서 <R>하야</>했습니다.`);

    general.setVar('experience', general.getVar('experience') * (1 - 0.1 * general.getVar('betray')));
    general.addExperience(0, false);
    general.setVar('dedication', general.getVar('dedication') * (1 - 0.1 * general.getVar('betray')));
    general.addDedication(0, false);
    
    // TODO: increaseVarWithLimit with GameConst.$maxBetrayCnt
    general.increaseVarWithLimit('betray', 1, null, 10);
    general.setVar('permission', 'normal');

    const newGold = Util.valueFit(general.getVar('gold'), null, GameConst.defaultGold);
    const newRice = Util.valueFit(general.getVar('rice'), null, GameConst.defaultRice);

    const lostGold = general.getVar('gold') - newGold;
    const lostRice = general.getVar('rice') - newRice;

    general.setVar('gold', newGold);
    general.setVar('rice', newRice);

    await db.update('nation', {
      gold: db.sqleval('gold + ?', [lostGold]),
      rice: db.sqleval('rice + ?', [lostRice]),
      gennum: db.sqleval('gennum - ?', [general.getNPCType() !== 5 ? 1 : 0])
    }, 'nation = ?', [nationID]);

    // TODO: refreshNationStaticInfo()

    general.setVar('nation', 0);
    general.setVar('officer_level', 0);
    general.setVar('officer_city', 0);
    general.setVar('belong', 0);
    general.setVar('makelimit', 12);

    if (general.getVar('troop') === generalID) {
      await db.update('general', {
        troop: 0
      }, 'troop = ?', [generalID]);
      await db.delete('troop', 'troop_leader = ?', [generalID]);
    }
    general.setVar('troop', 0);

    // TODO: general.increaseInheritancePoint(InheritanceKey.active_action, 1)
    // TODO: InheritanceKey.max_belong handling

    this.setResultTurn(new LastTurn(StepDownCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler.handleEvent
    
    await general.save();

    return true;
  }
}
