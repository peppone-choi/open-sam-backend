// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { LastTurn } from '../../types/LastTurn';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

/**
 * 소집해제 커맨드
 * 
 * 병사들을 전원 해산하고 도시 인구로 되돌립니다.
 */
export class DismissCommand extends GeneralCommand {
  protected static actionName = '소집해제';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;

    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralCrew(),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof DismissCommand).getName();
    return `${name}(병사↓, 인구↑)`;
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

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();

    logger.pushGeneralActionLog(`병사들을 <R>소집해제</>하였습니다. <1>${date}</>`);

    const exp = 70;
    const ded = 100;

    const crewUp = general.onCalcDomestic('징집인구',  'score', general.data.crew);

    await db.update('city', {
      pop: db.sqleval('pop + %i', crewUp)
    },  'city=%i', [general.getCityID()]);

    general.data.crew = 0;
    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn((this.constructor as typeof DismissCommand).getName(), this.arg));
    general.checkStatChange();
    await StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, DismissCommand, this.env, this.arg ?? {});
    await this.saveGeneral();

    return true;
  }
}
