import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { GameConst } from '../../constants/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { IUnitStack, IUnitStackDocument } from '../../models/unit_stack.model';

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
  protected targetType: 'general' | 'city' = 'general';
  protected targetStackId?: string;

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
       const { GameUnitConst } = require('../../const/GameUnitConst');
       const crewTypeData = GameUnitConst.byID(crewType);
       if (!crewTypeData && crewType !== 0) {
         // crewType 0은 기본 병종으로 허용
         return false;
       }
     } catch (error) {
       // GameUnitConst 로드 실패 시 기본 검증만 수행
     }

    
    if (amount < 0) {
      return false;
    }

    let targetType: 'general' | 'city' = 'general';
    if (typeof (this.arg as any).targetType === 'string') {
      const rawTarget = String((this.arg as any).targetType).toLowerCase();
      if (rawTarget === 'city') {
        targetType = 'city';
      }
    }

    let targetStackId: string | undefined;
    if (typeof (this.arg as any).targetStackId === 'string') {
      const trimmed = (this.arg as any).targetStackId.trim();
      if (trimmed.length > 0 && trimmed !== 'new') {
        targetStackId = trimmed;
      }
    }

    this.arg = {
      crewType,
      amount,
      targetType,
      ...(targetStackId ? { targetStackId } : {})
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
    this.targetType = (this.arg?.targetType === 'city') ? 'city' : 'general';
    this.targetStackId = typeof this.arg?.targetStackId === 'string' ? this.arg.targetStackId : undefined;
    
    // 현재 병종 정보 (기존 병종 유지 여부 판단용)
    const currCrewType: any = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0, name: '병종', armType: Math.floor((general.data?.crewtype ?? 0) / 1000) };
    let maxCrew = leadership * 100;

    // 병종 정보 가져오기 - units.json 기반
    let reqCrewType: any = { id: this.arg.crewType, name: '병종', armType: 0, cost: 1, rice: 1 };
    try {
      const { GameUnitConst } = require('../../const/GameUnitConst');
      const scenarioId = this.env?.scenario_id || this.env?.scenario || 'sangokushi';
      const crewTypeData = GameUnitConst.byID(this.arg.crewType, scenarioId);
      if (crewTypeData) {
        reqCrewType = {
          id: crewTypeData.id || this.arg.crewType,
          name: crewTypeData.name || '병종',
          armType: crewTypeData.armType || 0,
          cost: crewTypeData.cost || 1,
          rice: crewTypeData.rice || 1,
        };
      }
    } catch (error) {
      // GameUnitConst 로드 실패 시 기본값 사용
    }

    if (this.targetType === 'general') {
      if (reqCrewType?.id === currCrewType?.id) {
        maxCrew -= general.data.crew ?? 0;
      }
      this.maxCrew = Math.max(100, Math.min(this.arg.amount, maxCrew));
    } else {
      this.maxCrew = Math.max(100, this.arg.amount);
    }

    this.reqCrew = Math.max(100, this.arg.amount);
    this.reqCrewType = reqCrewType;
    this.currCrewType = currCrewType;

    const [reqGold, reqRice] = this.getCost();
    const minRecruitPop = GameConst.minAvailableRecruitPop || 0;

    const baseFullConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', minRecruitPop + this.reqCrew),
      ConstraintHelper.ReqCityTrust(20),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];

    if (this.targetType === 'general') {
      baseFullConstraints.push(
        ConstraintHelper.ReqGeneralCrewMargin(this.reqCrewType?.id),
        ConstraintHelper.AvailableRecruitCrewType(this.reqCrewType?.id)
      );
    }

    this.fullConditionConstraints = baseFullConstraints;
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
    // PHP GameUnitDetail::costWithTech(tech, crew)와 동일한 개념:
    //   costWithTech = cost * getTechCost(tech) * crew / 100
    // 여기서 crew는 실제 병력 수(this.maxCrew)이며,
    // getTechCost(tech) = 1 + getTechLevel(tech) * 0.15 (TS: techRaw/1000 기준)
    const baseCost = this.reqCrewType?.cost || 1; // units.json 기준 gold 비용
    const baseRice = this.reqCrewType?.rice || 1; // units.json 기준 군량 비용
    const techRaw = this.nation?.tech || 0;
    const techLevel = Math.floor(techRaw / 1000);
    const techCostMultiplier = 1 + techLevel * 0.15;

    const crew = Math.max(100, this.maxCrew || 0);

    let reqGold = (baseCost * techCostMultiplier * crew) / 100;
    const costOffset = (this.constructor as typeof ConscriptCommand).costOffset;
    reqGold *= costOffset;

    let reqRice = (baseRice * techCostMultiplier * crew) / 100;

    // onCalcDomestic 보정 적용 (PHP: onCalcDomestic('징병','cost',...))
    const general = this.generalObj;
    if (general && typeof general.onCalcDomestic === 'function') {
      reqGold = general.onCalcDomestic('징병', 'cost', reqGold, {
        armType: this.reqCrewType?.armType ?? 0,
      });
      reqRice = general.onCalcDomestic('징병', 'rice', reqRice, {
        armType: this.reqCrewType?.armType ?? 0,
      });
    }

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

    // 징병 수가 0이 되는 이상 상황을 방어하기 위해
    // 여기서 한 번 더 징병 수를 재계산한다.
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

    const reqCrewType = this.reqCrewType;
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
    const reqCrewText = Math.max(1, reqCrew).toLocaleString(); // 천 단위 구분자, 최소 1명 보장

    const sessionId = this.env.session_id || 'sangokushi_default';
    const generalNo = general.getID?.() ?? general.no ?? general.data?.no;
    if (!generalNo) {
      throw new Error('장수 번호를 확인할 수 없습니다.');
    }
    if (this.targetType === 'city') {
      const cityId = this.city?.city;
      if (!cityId) {
        throw new Error('현 위치한 도시를 확인할 수 없습니다.');
      }
      const cityName = this.city?.name || `도시 ${cityId}`;
      if (this.targetStackId) {
        const stackDoc = await unitStackRepository.findById(this.targetStackId);
        if (!stackDoc || stackDoc.owner_type !== 'city' || Number(stackDoc.owner_id) !== Number(cityId)) {
          throw new Error('선택한 도시 수비대를 찾을 수 없습니다.');
        }
        if ((stackDoc.crew_type_id ?? 0) !== (reqCrewType?.id ?? 0)) {
          throw new Error('선택한 수비대의 병종이 일치하지 않습니다.');
        }
        logger.pushGeneralActionLog(`${cityName} 수비대에 ${crewTypeName} <C>${reqCrewText}</>명을 추가${actionName}했습니다. <1>${date}</>`);
        await this.addTroopsToStack(this.targetStackId, reqCrew, setTrain, setAtmos, reqCrewType);
      } else {
        logger.pushGeneralActionLog(`${cityName} 수비대에 ${crewTypeName} <C>${reqCrewText}</>명을 ${actionName}했습니다. <1>${date}</>`);
        const unitSize = 100;
        const stackCount = Math.max(1, Math.ceil(reqCrew / unitSize));
        await unitStackRepository.create({
          session_id: sessionId,
          owner_type: 'city',
          owner_id: cityId,
          commander_no: cityId,
          commander_name: `${cityName} 수비대`,
          crew_type_id: reqCrewType?.id || 0,
          crew_type_name: crewTypeName,
          unit_size: unitSize,
          stack_count: stackCount,
          hp: reqCrew,
          train: setTrain,
          morale: setAtmos,
          city_id: cityId,
        });
      }
    } else {
      const generalStacks = this.getCachedUnitStacks();
      await this.ensureGeneralUnitStacks(sessionId, generalNo, currCrewType, generalStacks);
      let targetStack: any = null;
      if (this.targetStackId) {
        targetStack = generalStacks.find((stack: any) => {
          const stackId = this.extractStackId(stack);
          return stackId === this.targetStackId;
        });
        if (!targetStack) {
          throw new Error('선택한 부대를 찾을 수 없습니다.');
        }
        if ((targetStack.crew_type_id ?? 0) !== (reqCrewType?.id ?? 0)) {
          throw new Error('선택한 부대의 병종이 일치하지 않습니다.');
        }
      } else {
        targetStack = generalStacks.find((stack: any) => stack.crew_type_id === reqCrewType?.id);
      }

      const sameTypeTroops = targetStack ? this.getStackTroopCount(targetStack) : 0;

      if (targetStack && sameTypeTroops > 0) {
        logger.pushGeneralActionLog(`${crewTypeName} <C>${reqCrewText}</>명을 추가${actionName}했습니다. <1>${date}</>`);
        const stackId = this.extractStackId(targetStack) ?? '';
        const updated = await this.addTroopsToStack(stackId, reqCrew, setTrain, setAtmos, reqCrewType);
        const cache = this.getCachedUnitStacks();
        const idx = cache.findIndex((s: any) => this.extractStackId(s) === stackId);
        if (idx >= 0) {
          cache[idx] = updated.toObject?.() || updated;
        }
      } else {
        logger.pushGeneralActionLog(`${crewTypeName} <C>${reqCrewText}</>명을 ${actionName}했습니다. <1>${date}</>`);
        await unitStackRepository.deleteByOwner(sessionId, 'general', generalNo);
        const unitSize = 100;
        const stackCount = Math.max(1, Math.ceil(reqCrew / unitSize));
        const stackDoc = await unitStackRepository.create({
          session_id: sessionId,
          owner_type: 'general',
          owner_id: generalNo,
          commander_no: generalNo,
          commander_name: general.name,
          crew_type_id: reqCrewType?.id || 0,
          crew_type_name: crewTypeName,
          unit_size: unitSize,
          stack_count: stackCount,
          hp: reqCrew,
          train: setTrain,
          morale: setAtmos,
        });
        this.markUnitStacksDirty();
        const cache = this.getCachedUnitStacks();
        cache.length = 0;
        cache.push(stackDoc.toObject());
      }
 
      await this.syncGeneralTroopData(sessionId, generalNo);

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
      general.addDex(reqCrewType, Math.max(1, reqCrew) / 100, false);
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

  private async ensureGeneralUnitStacks(sessionId: string, generalNo: number, currCrewType: any, cache: any[]): Promise<void> {
    if (cache.length > 0) return;
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
    if (stacks.length === 0) {
      const legacyCrew = this.generalObj?.data?.crew ?? 0;
      if (legacyCrew > 0) {
        const unitSize = 100;
        const stackCount = Math.max(1, Math.ceil(legacyCrew / unitSize));
        const stackDoc = await unitStackRepository.create({
          session_id: sessionId,
          owner_type: 'general',
          owner_id: generalNo,
          commander_no: generalNo,
          commander_name: this.generalObj?.name,
          crew_type_id: currCrewType?.id || this.generalObj?.data?.crewtype || 0,
          crew_type_name: currCrewType?.name || '병종',
          unit_size: unitSize,
          stack_count: stackCount,
          hp: legacyCrew,
          train: this.generalObj?.data?.train ?? 70,
          morale: this.generalObj?.data?.atmos ?? 70,
        });
        cache.push(stackDoc.toObject());
        this.markUnitStacksDirty();
      }
    } else {
      stacks.forEach((stack) => cache.push(stack));
    }
  }

  private async addTroopsToStack(stackId: string, addCrew: number, train: number, atmos: number, reqCrewType: any): Promise<IUnitStackDocument> {
    if (!stackId) {
      throw new Error('유닛 스택 ID를 확인할 수 없습니다.');
    }
    const stackDoc = await unitStackRepository.findById(stackId);
    if (!stackDoc) {
      throw new Error('유닛 스택을 찾을 수 없습니다.');
    }
    const unitSize = stackDoc.unit_size ?? 100;
    const prevTroops = stackDoc.hp ?? unitSize * stackDoc.stack_count;
    const addedStacks = Math.max(1, Math.ceil(addCrew / unitSize));
    stackDoc.stack_count += addedStacks;
    const maxTroops = stackDoc.unit_size * stackDoc.stack_count;
    stackDoc.hp = Math.min(maxTroops, prevTroops + addCrew);
    const totalTroops = Math.max(1, prevTroops + addCrew);
    const prevTrain = stackDoc.train ?? train;
    const prevMorale = stackDoc.morale ?? atmos;
    stackDoc.train = (prevTroops * prevTrain + addCrew * train) / totalTroops;
    stackDoc.morale = (prevTroops * prevMorale + addCrew * atmos) / totalTroops;
    if (reqCrewType?.id && stackDoc.crew_type_id !== reqCrewType.id) {
      stackDoc.crew_type_id = reqCrewType.id;
    }
    if (reqCrewType?.name) {
      stackDoc.crew_type_name = reqCrewType.name;
    }
    await stackDoc.save();
    this.markUnitStacksDirty();
    return stackDoc;
  }


  private getStackTroopCount(stack: Partial<IUnitStack>): number {
    const hp = (stack as any)?.hp;
    if (typeof hp === 'number') {
      return hp;
    }
    const unitSize = stack.unit_size ?? 100;
    const stackCount = stack.stack_count ?? 0;
    return unitSize * stackCount;
  }

  private extractStackId(stack: any): string | undefined {
    if (!stack) {
      return undefined;
    }
    const rawId = stack._id ?? stack.id;
    if (typeof rawId === 'string') {
      return rawId;
    }
    if (rawId && typeof rawId.toString === 'function') {
      return rawId.toString();
    }
    return undefined;
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
