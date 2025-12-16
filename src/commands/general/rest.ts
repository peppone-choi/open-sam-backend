import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';


/**
 * 휴식 커맨드 (General)
 * 
 * 아무 행동도 하지 않고 턴을 넘깁니다.
 */
export class RestCommand extends GeneralCommand {
  protected static actionName = '휴식';

  protected argTest(): boolean {
    return true;
  }

  protected init(): void {
    this.minConditionConstraints = [];
    this.fullConditionConstraints = [];
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
   * 휴식 실행
   * 
   * 아무 행동도 하지 않습니다.
   */
  public async run(rng: any): Promise<boolean> {
    const general = this.generalObj;
    const logger = general.getLogger();
    const date = general.getTurnTime('HM');
    
    // PHP 원본: "아무것도 실행하지 않았습니다."
    logger.pushGeneralActionLog(`아무것도 실행하지 않았습니다. <1>${date}</>`);
    console.log(`[휴식] 장수 ${general.data.name || general.name} (ID: ${general.getID()}) 실행 완료`);

    this.setResultTurn(new LastTurn());
    
    // 공통 후처리 (휴식은 아이템 추첨/유산포인트 제외)
    await this.postRunHooks(rng, { skipItemLottery: true, skipInheritancePoint: true });
    
    await this.saveGeneral();
    
    return true;
  }
}
