import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 이동 커맨드
 * 
 * 인접한 도시로 이동합니다.
 * 자금을 소모하며, 통솔 경험치를 획득합니다.
 */
export class MoveCommand extends GeneralCommand {
  protected static actionName = '이동';
  public static reqArg = true;

  /**
   * 인자 검증: destCityID가 필요
   */
  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    // TODO: CityConst.all() 검증
    this.arg = {
      destCityID: this.arg.destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  /**
   * 인자와 함께 초기화
   */
  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg.destCityID, true);

    const [reqGold, reqRice] = this.getCost();
    
    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotSameDestCity(),
      // NearCity(1),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = MoveCommand.getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(통솔경험`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ', 사기↓)';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    return [env.develcost, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const commandName = MoveCommand.getName();
    const destCityName = this.destCity?.name || '목적지';
    return `【${destCityName}】로 ${commandName}`;
  }

  /**
   * 이동 실행
   * 
   * - 목적지 도시로 이동
   * - 군주라면 전체 병력 이동
   * - 경험치 획득
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
    const env = this.env;
    const general = this.generalObj;

    const destCityName = this.destCity.name;
    const destCityID = this.destCity.city;

    const logger = general.getLogger();

    // 이동 로그
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 이동했습니다.`);

    // 경험치
    const exp = 50;

    // 도시 변경
    general.setVar('city', destCityID);

    // 군주이고 국가 레벨이 0이면 전체 병력 이동
    if (general.getVar('officer_level') === 12 && this.nation.level === 0) {
      // TODO: 전체 장수 이동 로직
      // const generalList = await General.find({ nation: general.getNationID(), no: { $ne: general.getID() } });
      // generalList.forEach(g => g.city = destCityID);
    }

    // 경험치 증가
    general.addExperience(exp);
    general.increaseVar('leadership_exp', 1);

    // 비용 차감
    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);

    // 사기 감소
    general.increaseVarWithLimit('atmos', -5, 0);

    this.setResultTurn(new LastTurn(MoveCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery

    await general.save();

    return true;
  }
}
