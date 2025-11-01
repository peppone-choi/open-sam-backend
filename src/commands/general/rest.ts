import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

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
    
    logger.pushGeneralActionLog(`아무것도 실행하지 않았습니다. <1>${date}</>`);

    this.setResultTurn(new LastTurn());
    
    // TODO: StaticEventHandler.handleEvent
    
    general.applyDB(DB.db());
    
    return true;
  }
}
