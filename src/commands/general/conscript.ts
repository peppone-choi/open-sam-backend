import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { GameConst } from '../../constants/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

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
    this.defaultTrain = GameConst.defaultTrainLow || 20;
    this.defaultAtmos = GameConst.defaultAtmosLow || 20;
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

    // 병종 ID 검증
    try {
      const { GameUnitConst } = require('../../constants/GameUnitConst');
      if (GameUnitConst.byID) {
        const crewTypeData = GameUnitConst.byID(crewType);
        if (!crewTypeData && crewType !== 0) {
          // crewType 0은 기본 병종으로 허용
          return false;
        }
      }
    } catch (error) {
      // GameUnitConst 없으면 기본 검증만
    }
    
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

    const minRecruitPop = GameConst.minAvailableRecruitPop || 0;
    
    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', minRecruitPop + 100),
      ConstraintHelper.ReqCityTrust(20),
    ];
  }

  protected initWithArg(): void {
    const general = this.generalObj;

    // 징병은 통솔만 사용 (PHP 원본과 동일)
    const leadership = general.getLeadership(true);
    
    // TODO: const currCrewType = general.getCrewTypeObj();
    const currCrewType: any = null; // 임시: 병종 시스템 미구현
    let maxCrew = leadership * 100;

    // 병종 정보 가져오기 - 동기 require 사용
    let reqCrewType: any = { id: this.arg.crewType, name: '병종', armType: 0 };
    try {
      const { GameUnitConst } = require('../../constants/GameUnitConst');
      const crewTypeData = GameUnitConst.byID ? GameUnitConst.byID(this.arg.crewType) : null;
      if (crewTypeData) {
        reqCrewType = {
          id: crewTypeData.id || this.arg.crewType,
          name: crewTypeData.name || '병종',
          armType: crewTypeData.armType || 0,
          cost: crewTypeData.cost || 1,
        };
      }
    } catch (error) {
      // GameUnitConst 없으면 기본값 사용
    }

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
      ConstraintHelper.SuppliedCity(),
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
    if (!this.isArgValid) {
      return [0, 0];
    }

    // 비용 계산 (기술 레벨 반영)
    const baseCost = this.reqCrewType?.cost || 1;
    const techLevel = this.nation?.tech || 0;
    const costWithTech = baseCost * (1 - techLevel / 1000); // 기술 1당 0.1% 할인
    
    let reqGold = this.maxCrew * costWithTech;
    const costOffset = (this.constructor as typeof ConscriptCommand).costOffset;
    reqGold *= costOffset;
    
    // onCalcDomestic 보정 적용
    const general = this.generalObj;
    if (general && typeof general.onCalcDomestic === 'function') {
      reqGold = general.onCalcDomestic('징병', 'cost', reqGold);
    }
    
    // 0으로 나누기 방지
    let reqRice = Math.max(1, this.maxCrew) / 100;

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
    const currCrew = general.data.crew ?? 0;
    const currCrewType = this.currCrewType;
    const crewTypeName = reqCrewType?.name || '병종';

    const logger = general.getLogger();

    const actionName = (this.constructor as typeof ConscriptCommand).actionName;
    const defaultTrain = (this.constructor as typeof ConscriptCommand).defaultTrain;
    const defaultAtmos = (this.constructor as typeof ConscriptCommand).defaultAtmos;

    // onCalcDomestic 보정 적용
    let setTrain = defaultTrain;
    let setAtmos = defaultAtmos;
    if (typeof general.onCalcDomestic === 'function') {
      setTrain = general.onCalcDomestic('징병', 'train', setTrain);
      setAtmos = general.onCalcDomestic('징병', 'atmos', setAtmos);
    }

    const date = `${this.env.year}년 ${this.env.month}월`;
    const reqCrewText = reqCrew.toLocaleString(); // 천 단위 구분자
    
    if (reqCrewType?.id === currCrewType?.id && currCrew > 0) {
      logger.pushGeneralActionLog(`${crewTypeName} <C>${reqCrewText}</>명을 추가${actionName}했습니다. <1>${date}</>`);
      // 0으로 나누기 방지: 분모가 0이 될 수 없지만 안전장치 추가
      const totalCrew = Math.max(1, currCrew + reqCrew);
      const train = (currCrew * (general.data.train ?? 0) + reqCrew * setTrain) / totalCrew;
      const atmos = (currCrew * (general.data.atmos ?? 0) + reqCrew * setAtmos) / totalCrew;

      general.increaseVar('crew', reqCrew);
      general.data.train = train;
      general.data.atmos = atmos;
    } else {
      logger.pushGeneralActionLog(`${crewTypeName} <C>${reqCrewText}</>명을 ${actionName}했습니다. <1>${date}</>`);
      general.data.crewtype = reqCrewType?.id || 0;
      general.data.crew = reqCrew;
      general.data.train = setTrain;
      general.data.atmos = setAtmos;
    }

    // onCalcDomestic 보정 적용 (주민 감소량)
    let reqCrewDown = reqCrew;
    if (typeof general.onCalcDomestic === 'function') {
      reqCrewDown = general.onCalcDomestic('징병', 'pop_down', reqCrewDown);
    }

    const costOffset = Math.max(0.01, (this.constructor as typeof ConscriptCommand).costOffset); // 0으로 나누기 방지
    const cityPop = Math.max(1, this.city?.pop || 10000); // 0으로 나누기 방지
    const newTrust = Math.max(0, (this.city?.trust || 50) - (reqCrewDown / cityPop) / costOffset * 100);

    // 도시 정보 업데이트 (주민 감소, 신뢰도 하락)
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

    // 병종 숙련도 증가
    if (typeof general.addDex === 'function') {
      // TODO: general.addDex(reqCrewType, Math.max(1, reqCrew) / 100, false);
    }

    const [reqGold, reqRice] = this.getCost();

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    // 통무지정매 - 징병은 통솔+매력 증가
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('charm_exp', 0.5);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    // 병종 타입 설정
    if (reqCrewType?.armType !== undefined) {
      if (!general.data.aux) {
        general.data.aux = {};
      }
      general.data.aux.armType = reqCrewType.armType;
    }

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error: any) {
      console.error('StaticEventHandler failed:', error);
    }

    // tryUniqueItemLottery 처리
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env['session_id'] || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '징병');
    } catch (error: any) {
      console.error('tryUniqueItemLottery failed:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public exportJSVars(): any {
    // 병종 데이터 내보내기
    const crewTypeData: any[] = [];
    
    try {
      // units.json에서 병종 데이터 직접 로드
      const fs = require('fs');
      const path = require('path');
      const scenarioId = this.env.scenario_id || 'sangokushi';
      const unitsPath = path.join(__dirname, '../../config/scenarios', scenarioId, 'data/units.json');
      
      if (fs.existsSync(unitsPath)) {
        const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
        const units = unitsData.units || {};
        
        for (const [unitId, unitData] of Object.entries(units)) {
          const unit: any = unitData;
          
          // 제약 조건 확인하여 사용 가능 여부 판단
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
                constraintReason = `기술 ${constraint.value} 필요 (현재: ${currentTech})`;
              }
            }
            
            if (constraint.type === 'reqCities') {
              const currentCity = this.city;
              const requiredCity = constraint.value;
              
              if (!currentCity) {
                notAvailable = true;
                constraintReason = `${requiredCity}에서만 징병 가능`;
              } else if (currentCity.name !== requiredCity) {
                notAvailable = true;
                constraintReason = `${requiredCity}에서만 징병 가능`;
              }
            }
            
            if (constraint.type === 'reqRegions') {
              const requiredRegion = constraint.value;
              const currentCity = this.city;
              
              if (!currentCity) {
                notAvailable = true;
                constraintReason = `${requiredRegion} 지역에서만 징병 가능`;
              } else {
                // regions.json에서 지역 정보 확인
                try {
                  const regionsPath = path.join(__dirname, '../../config/scenarios', scenarioId, 'data/regions.json');
                  if (fs.existsSync(regionsPath)) {
                    const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf-8'));
                    const regions = regionsData.regions || [];
                    
                    // 현재 도시가 속한 지역 찾기
                    let currentRegionName = null;
                    for (const region of regions) {
                      if (region.cities && region.cities.includes(currentCity.name)) {
                        currentRegionName = region.name;
                        break;
                      }
                    }
                    
                    if (currentRegionName !== requiredRegion) {
                      notAvailable = true;
                      constraintReason = `${requiredRegion} 지역에서만 징병 가능`;
                    }
                  } else {
                    // regions.json이 없으면 무조건 불가
                    notAvailable = true;
                    constraintReason = `${requiredRegion} 지역에서만 징병 가능`;
                  }
                } catch (err) {
                  notAvailable = true;
                  constraintReason = `${requiredRegion} 지역에서만 징병 가능`;
                }
              }
            }
            
            if (constraint.type === 'country_type_unlock') {
              const requiredType = constraint.value;
              const currentNation = this.nation;
              
              // 국가의 country_type 확인
              const countryType = currentNation?.country_type || currentNation?.data?.country_type;
              
              if (countryType !== requiredType) {
                notAvailable = true;
                const typeNames: Record<string, string> = {
                  'taiping': '태평도',
                  'bandits': '도적',
                  'mohism': '묵가',
                  'militarism': '병가',
                  'taoism': '도가',
                  'taoism_religious': '오두미도',
                  'confucianism': '유가',
                  'legalism': '법가',
                  'logicians': '명가',
                  'diplomatists': '종횡가',
                  'yinyang': '음양가',
                  'buddhism': '불가',
                  'virtue': '덕가'
                };
                const typeName = typeNames[requiredType] || requiredType;
                constraintReason = `${typeName} 국가 전용`;
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
            constraints: unit.constraints || []
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
