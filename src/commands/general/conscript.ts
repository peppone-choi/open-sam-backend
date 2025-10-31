import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { GameConst } from '../../constants/GameConst';

/**
 * 징병 커맨드
 * 
 * 병사를 징집합니다. 주민 감소, 신뢰도 하락을 동반합니다.
 */
export class ConscriptCommand extends GeneralCommand {
  protected static actionName = '징병';
  protected static costOffset = 1;
  public static reqArg = true;

  protected static defaultTrain: number;
  protected static defaultAtmos: number;

  protected maxCrew = 0;
  protected reqCrew = 0;
  protected reqCrewType: any = null;
  protected currCrewType: any = null;

  protected static initStatic(): void {
    this.defaultTrain = (GameConst as any).defaultTrainLow || 20;
    this.defaultAtmos = (GameConst as any).defaultAtmosLow || 20;
  }

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('crewType' in this.arg)) {
      return false;
    }
    if (!('amount' in this.arg)) {
      return false;
    }
    const crewType = this.arg.crewType;
    let amount = this.arg.amount;

    if (typeof crewType !== 'number') {
      return false;
    }
    if (typeof amount !== 'number') {
      return false;
    }

    // TODO: GameUnitConst.byID validation
    if (amount < 0) {
      return false;
    }

    this.arg = {
      crewType,
      amount
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['tech', 'aux']);

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // OccupiedCity(),
      // ReqCityCapacity('pop',  '주민', [100]),
      // ReqCityTrust(20),
    ];
  }

  protected initWithArg(): void {
    const general = this.generalObj;

    const leadership = general.getLeadership(true);
    const currCrewType = general.getCrewTypeObj();
    let maxCrew = leadership * 100;

    // TODO: GameUnitConst.byID
    const reqCrewType = { id: this.arg.crewType, name: '병종' }; // placeholder

    if (reqCrewType.id === currCrewType?.id) {
      maxCrew -= general.getVar('crew');
    }

    this.maxCrew = Math.max(100, Math.min(this.arg.amount, maxCrew));
    this.reqCrew = Math.max(100, this.arg.amount);
    this.reqCrewType = reqCrewType;
    this.currCrewType = currCrewType;

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // OccupiedCity(),
      // ReqCityCapacity('pop',  '주민', [100 + reqCrew]),
      // ReqCityTrust(20),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
      // ReqGeneralCrewMargin(reqCrewType.id),
      // AvailableRecruitCrewType(reqCrewType.id)
    ];
  }

  public getBrief(): string {
    const crewTypeName = this.reqCrewType?.name || '병종';
    const amount = this.reqCrew;
    const commandName = (this.constructor as typeof ConscriptCommand).getName();
    return `【${crewTypeName}】 ${amount}명 ${commandName}`;
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof GeneralCommand).getName()}(통솔경험)`;
  }

  public getCost(): [number, number] {
    if (!this.isArgValid) {
      return [0, 0];
    }

    // TODO: reqCrewType.costWithTech, onCalcDomestic
    let reqGold = this.maxCrew; // placeholder
    const costOffset = (this.constructor as typeof ConscriptCommand).costOffset;
    reqGold *= costOffset;
    let reqRice = this.maxCrew / 100;

    reqGold = Math.round(reqGold);
    reqRice = Math.round(reqRice);
    return [reqGold, reqRice];
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

    const reqCrew = this.maxCrew;
    const reqCrewType = this.reqCrewType;
    const currCrew = general.getVar('crew');
    const currCrewType = this.currCrewType;
    const crewTypeName = reqCrewType?.name || '병종';

    const logger = general.getLogger();

    const actionName = (this.constructor as typeof ConscriptCommand).actionName;
    const defaultTrain = (this.constructor as typeof ConscriptCommand).defaultTrain;
    const defaultAtmos = (this.constructor as typeof ConscriptCommand).defaultAtmos;

    // TODO: onCalcDomestic
    const setTrain = defaultTrain;
    const setAtmos = defaultAtmos;

    if (reqCrewType?.id === currCrewType?.id && currCrew > 0) {
      logger.pushGeneralActionLog(`${crewTypeName} ${reqCrew}명을 추가${actionName}했습니다.`);
      const train = (currCrew * general.getVar('train') + reqCrew * setTrain) / (currCrew + reqCrew);
      const atmos = (currCrew * general.getVar('atmos') + reqCrew * setAtmos) / (currCrew + reqCrew);

      general.increaseVar('crew', reqCrew);
      general.setVar('train', train);
      general.setVar('atmos', atmos);
    } else {
      logger.pushGeneralActionLog(`${crewTypeName} ${reqCrew}명을 ${actionName}했습니다.`);
      general.setVar('crewtype', reqCrewType?.id || 0);
      general.setVar('crew', reqCrew);
      general.setVar('train', setTrain);
      general.setVar('atmos', setAtmos);
    }

    // TODO: onCalcDomestic for reqCrewDown
    const reqCrewDown = reqCrew;

    const costOffset = (this.constructor as typeof ConscriptCommand).costOffset;
    const newTrust = Math.max(0, (this.city?.trust || 50) - (reqCrewDown / (this.city?.pop || 10000)) / costOffset * 100);

    // TODO: Update city in DB
    // trust: newTrust
    // pop: city.pop - reqCrewDown

    const exp = Math.round(reqCrew / 100);
    const ded = Math.round(reqCrew / 100);

    // TODO: general.addDex

    const [reqGold, reqRice] = this.getCost();

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.increaseVar('leadership_exp', 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler, tryUniqueItemLottery
    // TODO: general.setAuxVar('armType', reqCrewType.armType)
    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        // TODO: crewType data
      }
    };
  }
}
