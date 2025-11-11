import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { CityConst } from '../../const/CityConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 귀환 커맨드
 * 
 * 관직이 있으면 관직 도시로, 없으면 수도로 귀환합니다.
 * 비용이 들지 않으며, 통솔 경험치와 공헌도를 획득합니다.
 */
export class ReturnCommand extends GeneralCommand {
  protected static actionName = '귀환';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation()
    ];
  }

  public getCommandDetailTitle(): string {
    const name = ReturnCommand.getName();
    return `${name}(통솔경험)`;
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

  /**
   * 귀환 실행
   * 
   * - 관직이 있으면 관직 도시로, 없으면 수도로 귀환
   * - 경험치 및 공헌도 획득
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;

    const officerLevel = general.getVar('officer_level');
    let destCityID: number;

    // 관직이 태수/도독/대도독이면 관직 도시로
    if (officerLevel >= 2 && officerLevel <= 4) {
      destCityID = general.getVar('officer_city');
    } else {
      // 그 외에는 수도로
      destCityID = this.nation.capital;
    }

    const destCityName = CityConst.byID(destCityID).name;
    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 귀환했습니다.`);

    const exp = 70;
    const ded = 100;

    general.setVar('city', destCityID);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(ReturnCommand.getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(
        general.genGenericUniqueRNG(ReturnCommand.actionName),
        general,
        sessionId,
        '귀환'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
