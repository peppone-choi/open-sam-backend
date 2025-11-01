import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';

/**
 * 등용 커맨드
 * 
 * 다른 장수를 등용합니다.
 * 대상 장수에게 등용 제안을 보내고, 수락하면 아군이 됩니다.
 */
export class RecruitCommand extends GeneralCommand {
  protected static actionName = '등용';
  public static reqArg = true;

  /**
   * 인자 검증: destGeneralID가 필요
   */
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
      destGeneralID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
    ];

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // NotBeNeutral(),
      // OccupiedCity(),
      // SuppliedCity(),
    ];
  }

  /**
   * 인자와 함께 초기화
   */
  protected async initWithArg(): Promise<void> {
    // TODO: General.createObjFromDB 구현 필요
    // const destGeneral = await General.findById(this.arg.destGeneralID);
    // this.setDestGeneral(destGeneral);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // NotBeNeutral(),
      // OccupiedCity(),
      // SuppliedCity(),
      // ExistsDestGeneral(),
      // DifferentNationDestGeneral(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];

    // 군주에게는 등용 불가
    if (this.destGeneralObj && this.destGeneralObj.getVar('officer_level') === 12) {
      // TODO: AlwaysFail constraint
    }
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  public getCost(): [number, number] {
    const env = this.env;
    if (!this.isArgValid) {
      return [env.develcost, 0];
    }
    
    const destGeneral = this.destGeneralObj;
    const reqGold = Math.round(
      env.develcost +
      (destGeneral.getVar('experience') + destGeneral.getVar('dedication')) / 1000
    ) * 10;
    
    return [reqGold, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const destGeneralName = this.destGeneralObj.getName();
    const name = RecruitCommand.getName();
    // TODO: JosaUtil.pick
    return `【${destGeneralName}】을(를) ${name}`;
  }

  /**
   * 등용 실행
   * 
   * - 등용 메시지 발송
   * - 대상 장수의 승낙률 계산
   * - 성공 시 아군으로 영입
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const destGeneral = this.destGeneralObj;
    const destGeneralName = destGeneral.getName();
    const destGeneralID = destGeneral.getID();

    const logger = general.getLogger();

    // 등용 성공률 계산
    const scoutPower = this.nation.scout * 3 + general.getStat('intel');
    const destScoutPower = destGeneral.getNation().scout * 3 + destGeneral.getStat('intel');
    
    let recruitProb = 0.3; // 기본 30%
    
    if (scoutPower > destScoutPower * 2) {
      recruitProb = 0.7; // 70%
    } else if (scoutPower > destScoutPower) {
      recruitProb = 0.5; // 50%
    }

    const success = rng.nextBool(recruitProb);

    const [reqGold, reqRice] = this.getCost();

    // 비용 차감
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);

    if (success) {
      // 등용 성공
      logger.pushGeneralActionLog(`<Y><b>${destGeneralName}</b></>을(를) 등용하였습니다!`);
      
      // 대상 장수를 아군으로
      destGeneral.setVar('nation', general.getNationID());
      destGeneral.setVar('city', general.getVar('city'));
      destGeneral.setVar('belongs', general.getNationID());
      
      destGeneral.applyDB(db);
    } else {
      // 등용 실패
      logger.pushGeneralActionLog(`<Y><b>${destGeneralName}</b></>이(가) 등용을 거절했습니다.`);
      
      // TODO: ScoutMessage 발송
    }

    // 경험치 증가
    const exp = 50;
    general.addExperience(exp);
    general.increaseVar('intel_exp', 1);

    this.setResultTurn(new LastTurn(RecruitCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery

    general.applyDB(db);

    return true;
  }
}
