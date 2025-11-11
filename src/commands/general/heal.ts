import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { LastTurn } from '../../types/LastTurn';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class HealCommand extends GeneralCommand {
  protected static actionName = '요양';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;
    this.setNation();

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

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');
    const logger = general.getLogger();

    logger.pushGeneralActionLog(`건강 회복을 위해 요양합니다. <1>${date}</>`);

    const exp = 10;
    const ded = 7;

    general.setVar('injury', 0);
    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn(HealCommand.getName(), this.arg));
    general.checkStatChange();
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      HealCommand,
      this.env,
      this.arg ?? {}
    );
    
    await await this.saveGeneral();

    return true;
  }
}
