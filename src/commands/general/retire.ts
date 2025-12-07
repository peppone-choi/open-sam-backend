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
    const name = this.constructor.getName();
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


    const env = this.env;

    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');
    const sessionId = env.session_id || general.session_id || 'sangokushi_default';

    const logger = general.getLogger();

    if (env.isunited === 0) {
      try {
        const { CheckHallService } = await import('../../services/admin/CheckHall.service');
        await CheckHallService.execute(general.getID(), sessionId);
      } catch (error: any) {
        console.warn('[RetireCommand] CheckHall execution failed:', error?.message || error);
      }
    }

    await general.rebirth();
    logger.pushGeneralActionLog(`은퇴하였습니다. <1>${date}</>`);

    logger.pushGeneralHistoryLog('은퇴');

    this.setResultTurn(new LastTurn(RetireCommand.getName(), this.arg));
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

    return true;
  }
}
