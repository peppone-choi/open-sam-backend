import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

import { GameConst } from '../../constants/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 징병 커맨드
 * 
 * 병사를 징집합니다. 주민 감소, 신뢰도 하락을 동반합니다.
 * 스택 시스템 제거됨 - 장수의 crew만 사용
 */
export class ConscriptCommand extends GeneralCommand {
  protected static actionName = '징병';
  protected static costOffset = 1;
  public static reqArg = true;

  protected static defaultTrain = GameConst.defaultTrainLow || 20;
  protected static defaultAtmos = GameConst.defaultAtmosLow || 20;

  protected maxCrew = 0;
  protected reqCrew = 0;
  protected reqCrewType: any = null;
  protected currCrewType: any = null;

  protected argTest(): boolean {
    if (this.arg === null) return false;
    if (!('crewType' in this.arg)) return false;
    if (!('amount' in this.arg)) return false;
    
    const crewType = this.arg.crewType;
    const amount = this.arg.amount;

    if (typeof crewType !== 'number') return false;
    if (typeof amount !== 'number') return false;
    if (crewType < 0 || (crewType !== 0 && crewType < 1000)) return false;
    if (amount < 0) return false;

    this.arg = { crewType, amount };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['tech', 'aux']);

    const minRecruitPop = GameConst.minAvailableRecruitPop || 0;
    
    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', minRecruitPop + 100),
      ConstraintHelper.ReqCityTrust(20),
    ];
  }

  protected initWithArg(): void {
    const general = this.generalObj;

    const leadership = general.getLeadership(true);
    
    // 현재 병종 정보
    const currCrewType: any = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0, name: '병종', armType: Math.floor((general.data?.crewtype ?? 0) / 1000) };
    
    let maxCrew = leadership * 100;

    // 병종 정보 가져오기
    let reqCrewType: any = { id: this.arg.crewType, name: '병종', armType: 0, cost: 1, rice: 1 };
    try {
      const { GameUnitConst } = require('../../const/GameUnitConst');
      const crewTypeData = GameUnitConst.byID(this.arg.crewType);
      if (crewTypeData) {
        const costObj = crewTypeData.cost;
        const goldCost = typeof costObj === 'object' ? (costObj?.gold ?? 1) : (costObj ?? 1);
        const riceCost = typeof costObj === 'object' ? (costObj?.rice ?? 1) : (crewTypeData.rice ?? 1);
        
        reqCrewType = {
          id: crewTypeData.id || this.arg.crewType,
          name: crewTypeData.name || '병종',
          armType: crewTypeData.armType || 0,
          cost: goldCost,
          rice: riceCost,
        };
      }
    } catch (error: any) {
      console.error('[징병] GameUnitConst 로드 실패:', error?.message || error);
    }

    // 같은 병종이면 현재 병력 제외
    if (reqCrewType?.id === currCrewType?.id) {
      maxCrew -= general.data.crew ?? 0;
    }
    this.maxCrew = Math.max(100, Math.min(this.arg.amount, maxCrew));
    this.reqCrew = Math.max(100, this.arg.amount);
    this.reqCrewType = reqCrewType;
    this.currCrewType = currCrewType;

    const [reqGold, reqRice] = this.getCost();
    const minRecruitPop = GameConst.minAvailableRecruitPop || 0;

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', minRecruitPop + this.reqCrew),
      ConstraintHelper.ReqCityTrust(20),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralCrewMargin(this.reqCrewType?.id),
      ConstraintHelper.AvailableRecruitCrewType(this.reqCrewType?.id),
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
    if (!this.isArgValid) return [0, 0];

    const baseGoldCost = this.reqCrewType?.cost || 1;
    const baseRiceCost = this.reqCrewType?.rice || 1;
    const techRaw = this.nation?.tech || 0;
    const techLevel = Math.floor(techRaw / 1000);
    const techCostMultiplier = 1 + techLevel * 0.15;

    const crew = Math.max(100, this.maxCrew || 0);

    let reqGold = (baseGoldCost * techCostMultiplier * crew) / 100;
    const costOffset = (this.constructor as typeof ConscriptCommand).costOffset;
    reqGold *= costOffset;

    let reqRice = (baseRiceCost * crew) / 100;

    const general = this.generalObj;
    if (general && typeof general.onCalcDomestic === 'function') {
      reqGold = general.onCalcDomestic('징병', 'cost', reqGold, {
        armType: this.reqCrewType?.armType ?? 0,
      });
      reqRice = general.onCalcDomestic('징병', 'rice', reqRice, {
        armType: this.reqCrewType?.armType ?? 0,
      });
    }

    return [Math.round(reqGold), Math.round(reqRice)];
  }

  public getPreReqTurn(): number { return 0; }
  public getPostReqTurn(): number { return 0; }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    let reqCrew = this.maxCrew;
    
    if (!reqCrew || reqCrew <= 0) {
      const leadership = typeof general.getLeadership === 'function'
        ? general.getLeadership(true)
        : (general.getVar?.('leadership') ?? 0);
      const fallbackMax = Math.max(100, leadership * 100);
      const requested = typeof this.arg?.amount === 'number' ? this.arg.amount : fallbackMax;
      reqCrew = Math.max(100, Math.min(requested, fallbackMax));
      this.maxCrew = reqCrew;
    }

    // reqCrewType 재설정
    if (!this.reqCrewType && this.arg?.crewType) {
      try {
        const { GameUnitConst } = require('../../const/GameUnitConst');
        const unitType = GameUnitConst.byID(this.arg.crewType);
        if (unitType) {
          const costObj = unitType.cost;
          const goldCost = typeof costObj === 'object' ? (costObj?.gold ?? 1) : (costObj ?? 1);
          const riceCost = typeof costObj === 'object' ? (costObj?.rice ?? 1) : (unitType.rice ?? 1);
          this.reqCrewType = {
            id: unitType.id,
            name: unitType.name,
            armType: unitType.armType,
            cost: goldCost,
            rice: riceCost
          };
        }
      } catch (error: any) {
        console.error('[징병 run] GameUnitConst 로드 실패:', error?.message);
      }
    }
    
    const reqCrewType = this.reqCrewType;
    const crewTypeName = reqCrewType?.name || '병종';
    const logger = general.getLogger();

    const actionName = (this.constructor as typeof ConscriptCommand).actionName;
    const defaultTrain = (this.constructor as typeof ConscriptCommand).defaultTrain;
    const defaultAtmos = (this.constructor as typeof ConscriptCommand).defaultAtmos;

    let setTrain = defaultTrain;
    let setAtmos = defaultAtmos;
    if (typeof general.onCalcDomestic === 'function') {
      setTrain = general.onCalcDomestic('징병', 'train', setTrain);
      setAtmos = general.onCalcDomestic('징병', 'atmos', setAtmos);
    }

    const date = `${this.env.year}년 ${this.env.month}월`;
    const reqCrewText = Math.max(1, reqCrew).toLocaleString();

    // 장수 병력 직접 증가
    const currentCrew = general.data.crew ?? 0;
    const newCrew = currentCrew + reqCrew;
    general.setVar('crew', newCrew);
    
    // 병종 변경
    if (reqCrewType?.id) {
      general.setVar('crewtype', reqCrewType.id);
    }
    
    // 훈련도/사기 가중 평균 계산
    const currentTrain = general.data.train ?? 70;
    const currentAtmos = general.data.atmos ?? 70;
    if (currentCrew > 0) {
      const newTrain = (currentCrew * currentTrain + reqCrew * setTrain) / newCrew;
      const newAtmos = (currentCrew * currentAtmos + reqCrew * setAtmos) / newCrew;
      general.setVar('train', Math.round(newTrain));
      general.setVar('atmos', Math.round(newAtmos));
    } else {
      general.setVar('train', setTrain);
      general.setVar('atmos', setAtmos);
    }

    logger.pushGeneralActionLog(`${crewTypeName} <C>${reqCrewText}</>명을 ${actionName}했습니다. <1>${date}</>`);

    // 주민 감소량 계산
    let reqCrewDown = reqCrew;
    if (typeof general.onCalcDomestic === 'function') {
      reqCrewDown = general.onCalcDomestic('징병', 'pop_down', reqCrewDown);
    }

    const costOffset = Math.max(0.01, (this.constructor as typeof ConscriptCommand).costOffset);
    const cityPop = Math.max(1, this.city?.pop || 10000);
    const newTrust = Math.max(0, (this.city?.trust || 50) - (reqCrewDown / cityPop) / costOffset * 100);

    // 도시 정보 업데이트
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const newPop = Math.max(0, (this.city?.pop || 10000) - reqCrewDown);
      
      await cityRepository.updateByCityNum(sessionId, this.city?.city, {
        trust: newTrust,
        pop: newPop
      });
      
      if (this.city) {
        this.city.trust = newTrust;
        this.city.pop = newPop;
      }
    } catch (error) {
      console.error('도시 업데이트 실패:', error);
      throw new Error('징병 처리 중 도시 업데이트 실패');
    }

    const exp = Math.round(Math.max(1, reqCrew) / 100);
    const ded = Math.round(Math.max(1, reqCrew) / 100);

    if (typeof general.addDex === 'function') {
      general.addDex(reqCrewType, Math.max(1, reqCrew) / 100, false);
    }

    this.maxCrew = reqCrew;
    const [reqGold, reqRice] = this.getCost();

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('charm_exp', 0.5);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    if (reqCrewType?.armType !== undefined) {
      if (!general.data.aux) general.data.aux = {};
      general.data.aux.armType = reqCrewType.armType;
    }

    await this.postRunHooks(rng);
    await this.saveGeneral();

    return true;
  }

  public exportJSVars(): any {
    const crewTypeData: any[] = [];
    
    try {
      const fs = require('fs');
      const path = require('path');
      const scenarioId = this.env.scenario_id || 'sangokushi';
      const unitsPath = path.join(__dirname, '../../../config/scenarios', scenarioId, 'data/units.json');
      
      if (fs.existsSync(unitsPath)) {
        const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
        const units = unitsData.units || {};
        
        for (const [unitId, unitData] of Object.entries(units)) {
          const unit: any = unitData;
          const constraints = unit.constraints || [];
          let notAvailable = false;
          let constraintReason = '';
          
          for (const constraint of constraints) {
            if (constraint.type === 'impossible') {
              notAvailable = true;
              constraintReason = '징병 불가';
              break;
            }
            if (constraint.type === 'reqTech') {
              const currentTech = this.nation?.tech || 0;
              if (currentTech < constraint.value) {
                notAvailable = true;
                constraintReason = `기술 ${constraint.value} 필요`;
              }
            }
          }
          
          crewTypeData.push({
            id: unit.id,
            name: unit.name,
            armType: unit.type || 'FOOTMAN',
            cost: unit.cost?.gold || 0,
            rice: unit.cost?.rice || 0,
            notAvailable,
            constraintReason,
          });
        }
      }
    } catch (error) {
      console.error('병종 데이터 조회 실패:', error);
    }
    
    return {
      procRes: {
        crewTypes: crewTypeData,
        selectedCrewType: this.reqCrewType,
        currentCrewType: this.currCrewType,
        maxCrew: this.maxCrew,
        reqCrew: this.reqCrew,
      }
    };
  }
}
