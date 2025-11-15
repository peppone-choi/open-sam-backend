import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { GameConst as GameConstCompat } from '../../const/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';

export class InciteCommand extends GeneralCommand {
  protected static actionName = '선동';
  public static reqArg = true;

  protected static statType = 'charm'; // 선동은 매력 주력 (+ 지력 보조)
  protected static injuryGeneral = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    
    const destCityID = this.arg.destCityID;
    if (typeof destCityID !== 'number' || destCityID <= 0) {
      return false;
    }
    
    this.arg = {
      destCityID: destCityID
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
    } else if (statType === 'politics') {
      genScore = general.getPolitics();
    } else if (statType === 'charm') {
      // 선동은 매력 70% + 지력 30% 복합
      const charm = general.getCharm();
      const intel = general.getIntel();
      genScore = charm * 0.7 + intel * 0.3;
    }

    // 0으로 나누기 방지
    const coef = Math.max(1, GameConst.sabotageProbCoefByStat || GameConstCompat.sabotageProbCoefByStat || 400);
    let prob = genScore / coef;
    
    if (typeof general.onCalcDomestic === 'function') {
      prob = general.onCalcDomestic('계략', 'success', prob);
    }
    
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
      } else if (statType === 'politics') {
        genScore = destGeneral.getPolitics();
      } else if (statType === 'charm') {
        // 선동 방어도 매력 70% + 지력 30%
        const charm = destGeneral.getCharm();
        const intel = destGeneral.getIntel();
        genScore = charm * 0.7 + intel * 0.3;
      }
      maxGenScore = Math.max(maxGenScore, genScore);
      
      if (typeof destGeneral.onCalcStat === 'function') {
        probCorrection = destGeneral.onCalcStat(destGeneral, 'sabotageDefence', probCorrection);
      }
    }

    // 0으로 나누기 방지
    const coef = Math.max(1, GameConst.sabotageProbCoefByStat || GameConstCompat.sabotageProbCoefByStat || 400);
    let prob = maxGenScore / coef;
    prob += probCorrection;
    prob += (Math.log2(affectGeneralCount + 1) - 1.25) * (GameConst.sabotageDefenceCoefByGeneralCnt || GameConstCompat.sabotageDefenceCoefByGeneralCnt);

    const secuMax = Math.max(1, destCity?.secu_max || 1);
    prob += (destCity?.secu || 0) / secuMax / 5;
    prob += (destCity?.supply || false) ? 0.1 : 0;
    return prob;
  }

  protected init(): void {
    this.setCity();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  protected initWithArg(): void {
    this.setNation();
    const [reqGold, reqRice] = this.getCost();

    // fullConditionConstraints를 먼저 설정
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.NotSameDestCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralValue('leadership', '통솔', '>=', 80),
      ConstraintHelper.ReqGeneralValue('intel', '지력', '>=', 80),
    ];
    
    // setDestCity, setDestNation은 비동기 작업이므로 나중에 처리
    this.setDestCity(this.arg.destCityID);
    if (this.destCity) {
      this.setDestNation(this.destCity.nation);
    }
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof InciteCommand).statType;
    
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
      'politics': '정치경험',
      'charm': '매력경험',
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
    const destCityName = this.destCity?.name || '도시';
    return `【${destCityName}】에 ${commandName}실행`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity?.name || '도시';
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

    const sessionId = general.getSessionID();
    await cityRepository.updateByCityNum(sessionId, destCityID, {
      state: 32,
      secu: destCity?.secu || 0,
      trust: destCity?.trust || 0
    });

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

    // dest 보장 로딩
    if (this.arg?.destCityID && !this.destCity) {
      await this.setDestCityAsync(this.arg.destCityID, true);
    }
    if (this.destCity && !this.destNation) {
      await this.setDestNation(this.destCity.nation);
    }

    const env = this.env;
    const general = this.generalObj;
    const sessionId = general.getSessionID();
    const date = general.getTurnTime('HM');

    const destCity = this.destCity;
    const destCityName = destCity?.name || '';
    const destCityID = destCity?.city || 0;
    const destNationID = destCity?.nation || 0;

    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof InciteCommand).statType;

    const logger = general.getLogger();

    // 거리 계산
    let dist = 1;
    try {
      const { searchDistance } = await import('../../func/searchDistance');
      const distances = searchDistance(general.getCityID(), 5, false);
      dist = distances[destCityID] ?? 99;
    } catch (error) {
      console.error('거리 계산 실패:', error);
    }

    // 목표 도시의 장수 로드
    const destCityGeneralList: any[] = [];
    try {
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.city': destCityID
      });
      
      for (const genDoc of generals) {
        const { General } = await import('../../models/general.model');
        const genObj = await General.createObjFromDB(genDoc.data?.no, sessionId);
        if (genObj) {
          destCityGeneralList.push(genObj);
        }
      }
    } catch (error) {
      console.error('장수 로드 실패:', error);
    }

    const prob = Util.valueFit(
      ((GameConst.sabotageDefaultProb || GameConstCompat.sabotageDefaultProb) + this.calcSabotageAttackProb() - this.calcSabotageDefenceProb(destCityGeneralList)) / dist,
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
      // 선동은 매력 70% + 지력 30%
      general.increaseVar('charm_exp', 1);
      general.increaseVar('intel_exp', 0.5);

      this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
      general.checkStatChange();
      await this.saveGeneral();
      return false;
    }

    let injuryCount = 0;
    if ((this.constructor as typeof InciteCommand).injuryGeneral) {
      try {
        const { SabotageService } = await import('../../common/services/sabotage.service');
        // 간단한 부상 처리: 20% 확률로 장수 1명 부상
        if (rng.nextFloat1() < 0.2 && destCityGeneralList.length > 0) {
          injuryCount = 1;
        }
      } catch (error) {
        console.error('부상 처리 실패:', error);
        injuryCount = 0;
      }
    }

    await this.affectDestCity(rng, injuryCount);

    // 아이템 소모 처리
    // TODO: general.consumeSabotageItem() 구현 필요
    // try {
    //   if (typeof general.consumeSabotageItem === 'function') {
    //     await general.consumeSabotageItem();
    //   }
    // } catch (error) {
    //   console.error('아이템 소모 실패:', error);
    // }

    const exp = rng.nextRangeInt(201, 300);
    const ded = rng.nextRangeInt(141, 210);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    // 선동은 매력 70% + 지력 30%
    general.increaseVar('charm_exp', 1);
    general.increaseVar('intel_exp', 0.5);
    
    try {
      if (typeof general.increaseRankVar === 'function') {
        // TODO: general.increaseRankVar('firenum', 1);
      }
    } catch (error) {
      console.error('랭크 변수 증가 실패:', error);
    }
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }
    
    general.checkStatChange();
    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const cities: any[] = [];
    const distanceList: any[] = [];
    
    try {
      const sessionId = this.env.session_id || 'sangokushi_default';
      const allCities = await cityRepository.findBySession(sessionId);
      
      for (const city of allCities) {
        cities.push({
          city: city.city,
          name: city.name,
          nation: city.nation
        });
      }
      
      const { searchDistance } = await import('../../func/searchDistance');
      const currentCityID = this.generalObj.getCityID();
      const distances = searchDistance(currentCityID, 3, false);
      
      for (const [cityID, dist] of Object.entries(distances)) {
        const cityNum = Number(cityID);
        if (!isNaN(cityNum)) {
          distanceList.push({
            city: cityNum,
            distance: dist
          });
        }
      }
    } catch (error) {
      console.error('exportJSVars 실패:', error);
    }
    
    return {
      procRes: {
        cities,
        distanceList
      },
    };
  }
}
