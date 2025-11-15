import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { generalRepository } from '../../repositories/general.repository';

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
    
    const destCityID = this.arg.destCityID;
    if (typeof destCityID !== 'number' || destCityID <= 0) {
      return false;
    }
    
    this.arg = {
      destCityID: destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  /**
   * 인자와 함께 초기화
   */
  protected initWithArg(): void {
    const [reqGold, reqRice] = this.getCost();
    
    // setDestCity를 먼저 호출 (constraint에서 destCity 사용)
    this.setDestCity(this.arg.destCityID, true);
    
    // fullConditionConstraints 설정
    this.fullConditionConstraints = [
      ConstraintHelper.NotSameDestCity(),
      ConstraintHelper.NearCity(1),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
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

    const env = this.env;
    const general = this.generalObj;

    // 실제 도시 데이터 로드 (initWithArg에서 동기적으로 호출되므로 여기서 다시 로드)
    await this.setDestCityAsync(this.arg.destCityID, true);
    
    if (!this.destCity) {
      throw new Error('목적 도시 정보가 없습니다');
    }
    
    const destCityName = this.destCity.name;
    const destCityID = this.destCity.city;

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    // 이동 로그
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 이동했습니다. <1>${date}</>`);


    // 경험치
    const exp = 50;

    // 도시 변경
    general.data.city = destCityID;

    // 군주이고 국가 레벨이 0이면 전체 병력 이동
    if (general.data.officer_level === 12 && this.nation && this.nation.level === 0) {
      try {
        const sessionId = general.getSessionID();
        const nationID = general.getNationID();
        
        await generalRepository.updateManyByFilter(
          {
            session_id: sessionId,
            'data.nation': nationID,
            'data.no': { $ne: general.getID() }
          },
          {
            'data.city': destCityID
          }
        );
      } catch (error) {
        console.error('방랑군 전체 이동 실패:', error);
      }
    }

    // 경험치 증가
    general.addExperience(exp);
    general.increaseVar('leadership_exp', 1);

    // 비용 차감
    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);

    // 사기 감소 (최소값 20)
    general.increaseVarWithLimit('atmos', -5, 20);

    this.setResultTurn(new LastTurn(MoveCommand.getName(), this.arg));
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
        // TODO: general.genGenericUniqueRNG(MoveCommand.actionName),
        general,
        sessionId,
        '이동'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
