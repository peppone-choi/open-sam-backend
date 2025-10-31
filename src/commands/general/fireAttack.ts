import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 화계 커맨드
 * 
 * 적 도시에 불을 질러 농업/상업을 감소시키고 적 장수를 부상시킵니다.
 */
export class FireAttackCommand extends GeneralCommand {
  protected static actionName = '화계';
  public static reqArg = true;
  protected static statType = 'intel';
  protected static injuryGeneral = true;

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

  protected calcSabotageAttackProb(): number {
    const statType = (this.constructor as typeof FireAttackCommand).statType;
    const general = this.generalObj;

    let genScore: number;
    if (statType === 'leadership') {
      genScore = general.getLeadership();
    } else if (statType === 'strength') {
      genScore = general.getStrength();
    } else if (statType === 'intel') {
      genScore = general.getIntel();
    } else {
      throw new Error('Invalid stat type');
    }

    const sabotageProbCoefByStat = 400;
    let prob = genScore / sabotageProbCoefByStat;
    return prob;
  }

  protected calcSabotageDefenceProb(destCityGeneralList: any[]): number {
    const statType = (this.constructor as typeof FireAttackCommand).statType;
    const destCity = this.destCity;
    const destNationID = this.destNation.nation;

    let maxGenScore = 0;
    let probCorrection = 0;
    let affectGeneralCount = 0;

    for (const destGeneral of destCityGeneralList) {
      if (destGeneral.getNationID() !== destNationID) {
        continue;
      }

      affectGeneralCount++;

      let genScore: number;
      if (statType === 'leadership') {
        genScore = destGeneral.getLeadership();
      } else if (statType === 'strength') {
        genScore = destGeneral.getStrength();
      } else if (statType === 'intel') {
        genScore = destGeneral.getIntel();
      } else {
        throw new Error('Invalid stat type');
      }
      maxGenScore = Math.max(maxGenScore, genScore);
    }

    const sabotageProbCoefByStat = 400;
    const sabotageDefenceCoefByGeneralCnt = 0.05;
    
    let prob = maxGenScore / sabotageProbCoefByStat;
    prob += probCorrection;
    prob += (Math.log2(affectGeneralCount + 1) - 1.25) * sabotageDefenceCoefByGeneralCnt;
    prob += (destCity.secu / destCity.secu_max) / 5;
    prob += destCity.supply ? 0.1 : 0;

    return prob;
  }

  protected init(): void {
    this.setCity();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // OccupiedCity(),
      // SuppliedCity(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  protected initWithArg(): void {
    this.setNation();
    this.setDestCity(this.arg.destCityID);
    this.setDestNation(this.destCity.nation);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // OccupiedCity(),
      // SuppliedCity(),
      // NotOccupiedDestCity(),
      // NotNeutralDestCity(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
      // DisallowDiplomacyBetweenStatus([7 => '불가침국입니다.']),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof FireAttackCommand).statType;
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statTypeText = statTypeBase[statType];
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(${statTypeText}`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ')';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    const cost = env.develcost * 5;
    return [cost, cost];
  }

  public getBrief(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const destCityName = this.destCity.name;
    return `【${destCityName}】에 ${commandName}실행`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity.name;
    return `${failReason} <G><b>${destCityName}</b></>에 ${commandName} 실패.`;
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const commandName = (this.constructor as typeof GeneralCommand).getName();

    const sabotageDamageMin = 800;
    const sabotageDamageMax = 6400;

    const agriAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.agri);
    const commAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.comm);
    
    destCity.agri -= agriAmount;
    destCity.comm -= commAmount;

    await DB.db().update('city', {
      state: 32,
      agri: destCity.agri,
      comm: destCity.comm
    }, 'city=?', [destCityID]);

    const agriAmountText = agriAmount.toLocaleString();
    const commAmountText = commAmount.toLocaleString();

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>이(가) 불타고 있습니다.`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(
      `도시의 농업이 <C>${agriAmountText}</>, 상업이 <C>${commAmountText}</>만큼 감소하고, 장수 <C>${injuryCount}</>명이 부상 당했습니다.`,
      'PLAIN'
    );
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const destNationID = destCity.nation;
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof FireAttackCommand).statType;
    const logger = general.getLogger();

    const cityGeneralID = await db.queryFirstColumn(
      'SELECT no FROM general WHERE city = ? AND nation = ?',
      [destCityID, destNationID]
    );

    const destCityGeneralList: any[] = [];

    const sabotageDefaultProb = 0.05;
    const prob = Math.max(0, Math.min(0.5, 
      sabotageDefaultProb + this.calcSabotageAttackProb() - this.calcSabotageDefenceProb(destCityGeneralList)
    ));

    if (!rng.nextBool(prob)) {
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 실패했습니다. <1>${date}</>`);

      const exp = rng.nextRangeInt(1, 100);
      const ded = rng.nextRangeInt(1, 70);

      const [reqGold, reqRice] = this.getCost();
      general.increaseVarWithLimit('gold', -reqGold, 0);
      general.increaseVarWithLimit('rice', -reqRice, 0);
      general.addExperience(exp);
      general.addDedication(ded);
      general.increaseVar(statType + '_exp', 1);

      this.setResultTurn(new LastTurn(FireAttackCommand.getName(), this.arg));
      general.checkStatChange();
      general.applyDB(db);
      return false;
    }

    const injuryCount = 0;

    await this.affectDestCity(rng, injuryCount);

    const exp = rng.nextRangeInt(201, 300);
    const ded = rng.nextRangeInt(141, 210);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(statType + '_exp', 1);

    this.setResultTurn(new LastTurn(FireAttackCommand.getName(), this.arg));
    general.checkStatChange();
    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        cities: [],
        distanceList: [],
      },
    };
  }
}
