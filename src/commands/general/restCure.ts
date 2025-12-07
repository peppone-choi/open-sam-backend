import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';

/**
 * 요양 커맨드
 * PHP che_요양과 동일한 구조
 */
export class RestCureCommand extends GeneralCommand {
  protected static actionName = '요양';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation();
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


    const general = this.generalObj;
    const date = general.getTurnTime();

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`건강 회복을 위해 요양합니다. <1>${date}</>`);

    const exp = 10;
    const ded = 7;

    general.data.injury = 0;
    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn(RestCureCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (요양은 아이템 추첨 제외)
    await this.postRunHooks(rng, { skipItemLottery: true });

    await this.saveGeneral();

    return true;
  }
}

