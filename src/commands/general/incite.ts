import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

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

  // PHP 원본: static protected $statType = 'leadership';
  protected static statType = 'leadership'; // 선동은 통솔 기반 (che_화계를 상속하며 같은 statType 사용)
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

    // PHP 원본: statType에 따라 단일 스탯만 사용
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
      genScore = general.getCharm();
    } else {
      throw new Error('Invalid stat type');
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

      // PHP 원본: statType에 따라 단일 스탯만 사용
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
        genScore = destGeneral.getCharm();
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
    // PHP 원본과 동일하게: setDestCity, setDestNation을 먼저 설정
    this.setNation();
    this.setDestCity(this.arg.destCityID);
    if (this.destCity) {
      this.setDestNation(this.destCity.nation);
    }

    const [reqGold, reqRice] = this.getCost();

    // PHP 원본 (che_화계.php initWithArg)과 동일한 조건들
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.NotOccupiedDestCity(),
      ConstraintHelper.NotNeutralDestCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({7: '불가침국입니다.'}),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof InciteCommand).statType;
    
    // PHP 원본: 통솔/무력/지력 3종만 지원
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statTypeName = statTypeBase[statType] || '경험';
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

    // 거리 계산 (PHP: $dist = searchDistance($general->getCityID(), 5, false)[$destCityID] ?? 99;)
    let dist = 1;
    try {
      const { searchDistance } = await import('../../func/searchDistance');
      const distances = searchDistance(general.getCityID(), 5, false);
      dist = distances[destCityID] ?? 99;
    } catch (error) {
      console.error('거리 계산 실패:', error);
    }

    // 목표 도시의 장수 로드 (PHP: General::createObjListFromDB)
    const destCityGeneralList: any[] = [];
    try {
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.city': destCityID,
        'data.nation': destNationID
      });
      
      for (const genDoc of generals) {
        const genObj = await General.createObjFromDB(genDoc.data?.no, sessionId);
        if (genObj) {
          genObj.setRawCity?.(destCity);
          destCityGeneralList.push(genObj);
        }
      }
    } catch (error) {
      console.error('장수 로드 실패:', error);
    }

    // PHP 원본: $prob = GameConst::$sabotageDefaultProb + $this->calcSabotageAttackProb() - $this->calcSabotageDefenceProb($destCityGeneralList);
    // $prob /= $dist;
    // $prob = Util::valueFit($prob, 0, 0.5);
    const sabotageDefaultProb = GameConst.sabotageDefaultProb || GameConstCompat.sabotageDefaultProb || 0.05;
    let prob = sabotageDefaultProb + this.calcSabotageAttackProb() - this.calcSabotageDefenceProb(destCityGeneralList);
    prob /= dist;
    prob = Util.valueFit(prob, 0, 0.5);

    // 실패 처리
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
      // PHP 원본: $general->increaseVar($statType . '_exp', 1);
      general.increaseVar(`${statType}_exp`, 1);

      this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
      general.checkStatChange();
      await this.saveGeneral();
      return false;
    }

    // 부상 처리 (PHP: SabotageInjury)
    let injuryCount = 0;
    if ((this.constructor as typeof InciteCommand).injuryGeneral) {
      try {
        const { SabotageInjury } = await import('../../func/sabotageInjury');
        injuryCount = await SabotageInjury(rng, destCityGeneralList, '계략');
      } catch (error) {
        console.error('부상 처리 실패:', error);
        injuryCount = 0;
      }
    }

    await this.affectDestCity(rng, injuryCount);

    // 아이템 소모 처리 (PHP 원본: tryConsumeNow 방식)
    try {
      const itemObj = general.getItem?.();
      if (itemObj && typeof itemObj.tryConsumeNow === 'function') {
        if (await itemObj.tryConsumeNow(general, 'GeneralCommand', '계략')) {
          const itemName = itemObj.getName?.() || '아이템';
          const itemRawName = itemObj.getRawName?.() || itemName;
          const josaUl = JosaUtil.pick(itemRawName, '을');
          logger.pushGeneralActionLog(`<C>${itemName}</>${josaUl} 사용!`, 'PLAIN' as any);
          if (typeof general.deleteItem === 'function') {
            general.deleteItem('item');
          } else if (typeof general.setVar === 'function') {
            general.setVar('item', 'None');
          }
        }
      }
    } catch (error) {
      console.error('아이템 소모 실패:', error);
    }

    const exp = rng.nextRangeInt(201, 300);
    const ded = rng.nextRangeInt(141, 210);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    // PHP 원본: $general->increaseVar($statType . '_exp', 1);
    general.increaseVar(`${statType}_exp`, 1);
    
    // 화공 횟수 증가 (랭킹) - PHP: $general->increaseRankVar(RankColumn::firenum, 1);
    try {
      if (typeof general.increaseRankVar === 'function') {
        general.increaseRankVar('firenum', 1);
      }
    } catch (error) {
      console.error('랭크 변수 증가 실패:', error);
    }
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
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
