import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { GameConst as GameConstCompat } from '../../const/GameConst';

export class InciteCommand extends GeneralCommand {
  protected static actionName = '선동';
  public static reqArg = true;

  protected static statType = 'leadership';
  protected static injuryGeneral = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    // TODO: CityConst validation
    this.arg = {
      destCityID: this.arg.destCityID
    };
    return true;
  }

  protected calcSabotageAttackProb(): number {
    const statType = (this.constructor as typeof InciteCommand).statType;
    const general = this.generalObj;

    let genScore = 0;
    if (statType === 'leadership') {
      genScore = general.getLeadership();
    } else if (statType === 'strength') {
      genScore = general.getStrength();
    } else if (statType === 'intel') {
      genScore = general.getIntel();
    }

    let prob = genScore / ((GameConst as any).sabotageProbCoefByStat || GameConstCompat.sabotageProbCoefByStat);
    // TODO: prob = general.onCalcDomestic('계략', 'success', prob);
    return prob;
  }

  protected calcSabotageDefenceProb(destCityGeneralList: any[]): number {
    const statType = (this.constructor as typeof InciteCommand).statType;
    const destCity = this.destCity;
    const destNation = this.destNation;
    const destNationID = destNation?.nation || 0;

    let maxGenScore = 0;
    let probCorrection = 0;
    let affectGeneralCount = 0;

    for (const destGeneral of destCityGeneralList) {
      if (destGeneral.getNationID() !== destNationID) {
        continue;
      }

      affectGeneralCount++;

      let genScore = 0;
      if (statType === 'leadership') {
        genScore = destGeneral.getLeadership();
      } else if (statType === 'strength') {
        genScore = destGeneral.getStrength();
      } else if (statType === 'intel') {
        genScore = destGeneral.getIntel();
      }
      maxGenScore = Math.max(maxGenScore, genScore);
      // TODO: probCorrection = destGeneral.onCalcStat(destGeneral, 'sabotageDefence', probCorrection);
    }

    let prob = maxGenScore / ((GameConst as any).sabotageProbCoefByStat || GameConstCompat.sabotageProbCoefByStat);
    prob += probCorrection;
    prob += (Math.log2(affectGeneralCount + 1) - 1.25) * ((GameConst as any).sabotageDefenceCoefByGeneralCnt || GameConstCompat.sabotageDefenceCoefByGeneralCnt);

    prob += (destCity?.secu || 0) / (destCity?.secu_max || 1) / 5;
    prob += (destCity?.supply || false) ? 0.1 : 0;
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
    // TODO: this.setDestCity(this.arg.destCityID);
    // TODO: this.setDestNation(this.destCity.nation);

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
    const statType = (this.constructor as typeof InciteCommand).statType;
    
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statTypeName = statTypeBase[statType];
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(${statTypeName}`;
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

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const destCityName = ''; // TODO: CityConst.byID(this.arg.destCityID).name;
    return `【${destCityName}】에 ${commandName}실행`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = ''; // TODO: CityConst.byID(this.arg.destCityID).name;
    return `${failReason} <G><b>${destCityName}</b></>에 ${commandName} 실패.`;
  }

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();

    const destCity = this.destCity;
    const destCityName = destCity?.name || '';
    const destCityID = destCity?.city || 0;
    const commandName = (this.constructor as typeof GeneralCommand).getName();

    const secuAmount = Util.valueFit(
      rng.nextRangeInt(GameConst.sabotageDamageMin, GameConst.sabotageDamageMax),
      null,
      destCity?.secu || 0
    );
    const trustAmount = Util.valueFit(
      rng.nextRange(GameConst.sabotageDamageMin, GameConst.sabotageDamageMax) / 50,
      null,
      destCity?.trust || 0
    );

    if (destCity) {
      destCity.secu -= secuAmount;
      destCity.trust -= trustAmount;
    }

    await (DB.db() as any).update('city', {
      state: 32,
      secu: destCity?.secu || 0,
      trust: destCity?.trust || 0
    }, 'city = ?', [destCityID]);

    const secuAmountText = secuAmount.toLocaleString();
    const trustAmountText = trustAmount.toFixed(1);

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>의 백성들이 동요하고 있습니다.`);
    const josaYi = JosaUtil.pick(commandName, '이');
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}${josaYi} 성공했습니다. <1>${date}</>`);

    logger.pushGeneralActionLog(
      `도시의 치안이 <C>${secuAmountText}</>, 민심이 <C>${trustAmountText}</>만큼 감소하고, 장수 <C>${injuryCount}</>명이 부상 당했습니다.`,
      'PLAIN' as any
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
    const destCityName = destCity?.name || '';
    const destCityID = destCity?.city || 0;
    const destNationID = destCity?.nation || 0;

    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof InciteCommand).statType;

    const logger = general.getLogger();

    // TODO: const dist = searchDistance(general.getCityID(), 5, false)[destCityID] ?? 99;
    const dist = 1;

    const destCityGeneralList: any[] = [];
    // TODO: Load generals from destCity

    const prob = Util.valueFit(
      (((GameConst as any).sabotageDefaultProb || GameConstCompat.sabotageDefaultProb) + this.calcSabotageAttackProb() - this.calcSabotageDefenceProb(destCityGeneralList)) / dist,
      0,
      0.5
    );

    if (!rng.nextBool(prob)) {
      const josaYi = JosaUtil.pick(commandName, '이');
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}${josaYi} 실패했습니다. <1>${date}</>`);

      const exp = rng.nextRangeInt(1, 100);
      const ded = rng.nextRangeInt(1, 70);

      const [reqGold, reqRice] = this.getCost();
      general.increaseVarWithLimit('gold', -reqGold, 0);
      general.increaseVarWithLimit('rice', -reqRice, 0);
      general.addExperience(exp);
      general.addDedication(ded);
      general.increaseVar(statType + '_exp', 1);

      this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
      general.checkStatChange();
      general.applyDB(db);
      return false;
    }

    let injuryCount = 0;
    if ((this.constructor as typeof InciteCommand).injuryGeneral) {
      // TODO: injuryCount = SabotageInjury(rng, destCityGeneralList, '계략');
    }

    await this.affectDestCity(rng, injuryCount);

    // TODO: Item consumption logic

    const exp = rng.nextRangeInt(201, 300);
    const ded = rng.nextRangeInt(141, 210);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(statType + '_exp', 1);
    // TODO: general.increaseRankVar(RankColumn.firenum, 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    
    // TODO: StaticEventHandler.handleEvent
    
    general.checkStatChange();
    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        // TODO: JSOptionsForCities()
        // TODO: JSCitiesBasedOnDistance(this.generalObj.getCityID(), 3)
        cities: [],
        distanceList: [],
      },
    };
  }
}
