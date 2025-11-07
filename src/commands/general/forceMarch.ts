import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 강행 커맨드
 * 
 * 빠르게 이동하되 병력, 훈련, 사기가 감소합니다.
 */
export class ForceMarchCommand extends GeneralCommand {
  protected static actionName = '강행';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    this.arg = {
      destCityID: this.arg.destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [];
  }

  protected initWithArg(): void {
    this.setDestCity(this.arg.destCityID, true);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotSameDestCity(),
      // NearCity(3),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(통솔경험`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ', 병력,훈련,사기↓)';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    return [env.develcost * 5, 0];
  }

  public getBrief(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const destCityName = this.destCity.name;
    return `【${destCityName}】로 ${commandName}`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity.name;
    return `${failReason} <G><b>${destCityName}</b></>로 ${commandName} 실패.`;
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

    // TODO: Legacy DB access - const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    const destCityName = this.destCity.name;
    const destCityID = this.destCity.city;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 강행했습니다. <1>${date}</>`);

    const exp = 100;
    general.setVar('city', destCityID);

    if (general.getVar('officer_level') === 12 && this.nation.level === 0) {
      const generalList = await db.queryFirstColumn(
        'SELECT no FROM general WHERE nation=? AND no!=?',
        [general.getNationID(), general.getID()]
      );
      
      if (generalList && generalList.length > 0) {
        await db.update('general', {
          city: destCityID
        }, 'no IN (?) and nation=?', [generalList, general.getNationID()]);
      }

      for (const targetGeneralID of generalList || []) {
        const targetLogger = general.createLogger(targetGeneralID, general.getNationID(), env.year, env.month);
        targetLogger.pushGeneralActionLog(`방랑군 세력이 <G><b>${destCityName}</b></>로 강행했습니다.`, 'PLAIN');
        await targetLogger.flush();
      }
    }

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('train', -5, 20);
    general.increaseVarWithLimit('atmos', -5, 20);
    general.addExperience(exp);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(ForceMarchCommand.getName(), this.arg));
    general.checkStatChange();

    await general.save();

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        cities: [], // TODO: JSOptionsForCities()
        distanceList: [], // TODO: JSCitiesBasedOnDistance(this.generalObj.getCityID(), 3)
      },
    };
  }
}
