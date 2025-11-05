import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';

/**
 * 소집해제 커맨드
 * PHP che_소집해제와 동일한 구조
 */
export class DismissTroopsCommand extends GeneralCommand {
  protected static actionName = '소집해제';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      // ConstraintHelper.ReqGeneralCrew() - TODO: 구현 필요
    ];
  }

  public getCommandDetailTitle(): string {
    return '소집해제(병사↓, 인구↑)';
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

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime();

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`병사들을 <R>소집해제</>하였습니다. <1>${date}</>`);

    const exp = 70;
    const ded = 100;

    const crew = general.getVar('crew') || 0;
    const crewUp = general.onCalcDomestic('징집인구', 'score', crew);

    // MongoDB에서는 $inc를 사용하여 증가시킵니다
    const { City } = await import('../../models/city.model');
    await (City as any).updateOne(
      { 
        session_id: general.getSessionID(),
        city: general.getCityID()
      },
      {
        $inc: { 'data.pop': crewUp }
      }
    );

    general.setVar('crew', 0);
    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn(DismissTroopsCommand.getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler 처리

    general.applyDB(db);

    return true;
  }
}

