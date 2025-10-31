import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class RetireCommand extends GeneralCommand {
  protected static actionName = '은퇴';
  protected static reqAge = 60;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation();
    const reqAge = (this.constructor as typeof RetireCommand).reqAge;

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralValue('age', '나이', '>=', reqAge, `나이가 ${reqAge}세 이상이어야 합니다.`)
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as any).getName();
    const reqAge = (this.constructor as typeof RetireCommand).reqAge;
    return `${name}(${reqAge}세 이상, 2턴)`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 1;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const logger = general.getLogger();

    if (env.isunited === 0) {
      // await (window as any).CheckHall?.(general.getID());
    }

    await general.rebirth();
    logger.pushGeneralActionLog(`은퇴하였습니다. <1>${date}</>`);

    this.setResultTurn(new LastTurn(RetireCommand.getName(), this.arg));
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      RetireCommand,
      this.env,
      this.arg ?? {}
    );
    
    await general.applyDB(db);

    return true;
  }
}
