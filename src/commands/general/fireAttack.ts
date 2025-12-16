// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

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
    } else if (statType === 'politics') {
      genScore = general.getPolitics();
    } else if (statType === 'charm') {
      genScore = general.getCharm();
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
    
    if (!this.destNation) {
      throw new Error('목적 국가 정보가 없습니다');
    }
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
      } else if (statType === 'politics') {
        genScore = destGeneral.getPolitics();
      } else if (statType === 'charm') {
        genScore = destGeneral.getCharm();
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
    
    // 0으로 나누기 방지: secu_max가 0일 수 있음
    const secuMax = Math.max(1, destCity?.secu_max ?? 1);
    prob += ((destCity?.secu ?? 0) / secuMax) / 5;
    prob += destCity.supply ? 0.1 : 0;

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
    this.setDestCity(this.arg.destCityID);
    
    // destCity가 설정된 후 destNation 설정
    if (this.destCity) {
      this.setDestNation(this.destCity.nation);
    }
    
    const [reqGold, reqRice] = this.getCost();

    // fullConditionConstraints 설정 (PHP와 동일)
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
    const destCityName = this.destCity?.name ?? '알 수 없음';
    return `【${destCityName}】에 ${commandName}실행`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity?.name ?? '알 수 없음';
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
    
    if (!destCity) {
      throw new Error('목적 도시 정보가 없습니다');
    }
    
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const commandName = (this.constructor as typeof GeneralCommand).getName();

    const sabotageDamageMin = 800;
    const sabotageDamageMax = 6400;

    const agriAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.agri);
    const commAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.comm);
    
    destCity.agri -= agriAmount;
    destCity.comm -= commAmount;

    try {
      // 도시 업데이트 (CQRS 패턴)
      await this.updateCity(destCityID, {
        state: 32,
        agri: destCity.agri,
        comm: destCity.comm
      });
    } catch (error: any) {
      console.error(`도시 ${destCityID} 업데이트 실패:`, error);
      throw new Error(`도시 업데이트 실패: ${error.message}`);
    }

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

    // dest 보장 로딩
    if (this.arg?.destCityID && !this.destCity) {
      await this.setDestCityAsync(this.arg.destCityID, true);
    }
    if (this.destCity && !this.destNation) {
      await this.setDestNation(this.destCity.nation);
    }

    const env = this.env;
    const sessionId = env.session_id || 'sangokushi_default';
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const destNationID = destCity.nation;
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const statType = (this.constructor as typeof FireAttackCommand).statType;
    const logger = general.getLogger();

    // 거리 계산
    const { searchDistance } = await import('../../func/searchDistance');
    const distances = searchDistance(general.getCityID(), 5, false);
    const dist = distances[destCityID] ?? 99;

    // 목적지 도시의 장수 목록 로드 (MongoDB)
    const { generalRepository } = await import('../../repositories/general.repository');
    const destCityGenerals = await generalRepository.findByCityAndNation(sessionId, destCityID, destNationID);
    const cityGeneralID = destCityGenerals.map((g: any) => g.no ?? g.data?.no);

    const { General } = await import('../../models/general.model');
    const destCityGeneralList: any[] = [];
    
    if (cityGeneralID && cityGeneralID.length > 0) {
      const { generalRepository } = await import('../../repositories/general.repository');
      for (const genID of cityGeneralID) {
        try {
          const destGeneral = await generalRepository.findById(genID);
          if (destGeneral) {
            destGeneral.setRawCity?.(destCity);
            destCityGeneralList.push(destGeneral);
          }
        } catch (error) {
          console.error(`장수 ${genID} 로드 실패:`, error);
        }
      }
    }

    // 확률 계산 (거리 패널티 포함)
    const sabotageDefaultProb = 0.05;
    let prob = sabotageDefaultProb + this.calcSabotageAttackProb() - this.calcSabotageDefenceProb(destCityGeneralList);
    prob /= dist; // 거리에 따른 패널티
    prob = Math.max(0, Math.min(0.5, prob));

    if (!rng.nextBool(prob)) {
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 실패했습니다. <1>${date}</>`);

      const exp = rng.nextRangeInt(1, 100);
      const ded = rng.nextRangeInt(1, 70);

      const [reqGold, reqRice] = this.getCost();
      general.increaseVarWithLimit('gold', -reqGold, 0);
      general.increaseVarWithLimit('rice', -reqRice, 0);
      general.addExperience(exp);
      general.addDedication(ded);
      // PHP: increaseVar($statType . '_exp', 1)
      // TS 확장: statType에 따라 해당 경험치 증가
      general.increaseVar(`${statType}_exp`, 1);

      this.setResultTurn(new LastTurn(FireAttackCommand.getName(), this.arg));
      general.checkStatChange();
      await this.saveGeneral();
      return false;
    }

    // 부상 처리
    const injuryGeneral = (this.constructor as typeof FireAttackCommand).injuryGeneral;
    let injuryCount = 0;
    
    if (injuryGeneral) {
      const { SabotageInjury } = await import('../../func/sabotageInjury');
      injuryCount = await SabotageInjury(rng, destCityGeneralList, '계략');
    }

    await this.affectDestCity(rng, injuryCount);

    // 아이템 소비 처리
    try {
      const itemObj = general.getItem?.();
      if (itemObj && itemObj.tryConsumeNow) {
        if (await itemObj.tryConsumeNow(general, 'GeneralCommand', '계략')) {
          const itemName = itemObj.getName?.() || '아이템';
          logger.pushGeneralActionLog(`<C>${itemName}</>을(를) 사용!`, 'PLAIN');
          if (typeof general.deleteItem === 'function') {
            general.deleteItem('item');
          } else if (typeof general.setVar === 'function') {
            general.setVar('item', 'None');
          }
        }
      }
    } catch (error) {
      console.error('아이템 소비 실패:', error);
    }

    const exp = rng.nextRangeInt(201, 300);
    const ded = rng.nextRangeInt(141, 210);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    // PHP: increaseVar($statType . '_exp', 1)
    // TS 확장: statType에 따라 해당 경험치 증가
    general.increaseVar(`${statType}_exp`, 1);
    
    // 화공 횟수 증가 (랭킹)
    try {
      general.increaseRankVar?.('firenum', 1);
    } catch (error) {
      console.error('firenum 랭킹 증가 실패:', error);
    }

    this.setResultTurn(new LastTurn(FireAttackCommand.getName(), this.arg));
    general.checkStatChange();
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

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
