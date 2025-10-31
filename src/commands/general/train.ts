import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 단련 커맨드
 * 
 * 병종 숙련도를 향상시킵니다.
 * 자금과 군량을 소모하며, 병사 수, 훈련도, 사기에 따라 성공률이 달라집니다.
 */
export class TrainCommand extends GeneralCommand {
  protected static actionName = '단련';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // ReqGeneralCrew(),
      // ReqGeneralValue('train', '훈련', '>=', 20),
      // ReqGeneralValue('atmos', '사기', '>=', 20),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(병종숙련`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ')';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    return [env.develcost, env.develcost];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  /**
   * 단련 실행
   * 
   * - 병종 숙련도 향상
   * - 확률적 성공/보통/실패
   * - 경험치 및 능력치 증가
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;

    // 성공률 계산 (성공 34%, 보통 33%, 실패 33%)
    const [pick, multiplier] = rng.choiceUsingWeightPair([
      [['success', 3], 0.34],
      [['normal', 2], 0.33],
      [['fail', 1], 0.33]
    ]);

    // 숙련도 증가량 계산
    const score = Math.round(
      general.getVar('crew') * general.getVar('train') * general.getVar('atmos') / 20 / 10000 * multiplier
    );

    const logger = general.getLogger();
    const armTypeText = '병종'; // TODO: GameUnitConst.allType

    // 결과 로그
    if (pick === 'fail') {
      logger.pushGeneralActionLog(`단련이 <span class='ev_failed'>지지부진</span>하여 ${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다.`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`단련이 <S>일취월장</>하여 ${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다.`);
    } else {
      logger.pushGeneralActionLog(`${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다.`);
    }

    // 경험치
    const exp = general.getVar('crew') / 400;

    // 병종 숙련도 증가
    general.addDex(general.getCrewTypeObj(), score, false);

    // 능력치 증가 (확률적으로 통솔/무력/지력 중 하나)
    const incStat = rng.choiceUsingWeight({
      'leadership_exp': general.getLeadership(false, false, false, false),
      'strength_exp': general.getStrength(false, false, false, false),
      'intel_exp': general.getIntel(false, false, false, false)
    });

    const [reqGold, reqRice] = this.getCost();

    // 자금/군량 차감
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    
    // 경험치/능력치 증가
    general.addExperience(exp);
    general.increaseVar(incStat, 1);

    this.setResultTurn(new LastTurn(TrainCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery

    general.applyDB(db);

    return true;
  }
}
