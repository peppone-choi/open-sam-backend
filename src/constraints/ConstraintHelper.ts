export interface IConstraint {
  test: (input: any, env: any) => string | null;
  reason?: string;
  message?: string;
}

export interface Constraint extends IConstraint {}

export class ConstraintHelper {
  static BeLord(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getVar('officer_level') === 12 ? null : '군주만 가능합니다.';
      }
    };
  }

  static BeChief(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getVar('officer_level') >= 5 ? null : '수뇌부만 가능합니다.';
      }
    };
  }

  static NotBeNeutral(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getNationID() !== 0 ? null : '재야는 불가능합니다.';
      }
    };
  }

  static WanderingNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.nation?.type === 1 ? null : '유랑 세력만 가능합니다.';
      }
    };
  }

  static NotWanderingNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.nation?.type !== 1 ? null : '유랑 세력은 불가능합니다.';
      }
    };
  }

  static OccupiedCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        return city?.nation === input.general?.getNationID() ? null : '아국 도시가 아닙니다.';
      }
    };
  }

  static SuppliedCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.city?.supply === 1 ? null : '보급이 끊긴 도시입니다.';
      }
    };
  }

  static ReqGeneralGold(amount: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getVar('gold') >= amount ? null : `자금이 부족합니다. (필요: ${amount})`;
      }
    };
  }

  static ReqGeneralRice(amount: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getVar('rice') >= amount ? null : `군량이 부족합니다. (필요: ${amount})`;
      }
    };
  }

  static ReqGeneralCrew(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getVar('crew') > 0 ? null : '병사가 없습니다.';
      }
    };
  }

  static ReqGeneralTrainMargin(maxValue: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const currentTrain = input.general?.getVar('train') || 0;
        return currentTrain < maxValue ? null : `훈련도가 이미 최대치입니다. (최대: ${maxValue})`;
      }
    };
  }

  static ReqGeneralAtmosMargin(maxValue: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const currentAtmos = input.general?.getVar('atmos') || 0;
        return currentAtmos < maxValue ? null : `사기가 이미 최대치입니다. (최대: ${maxValue})`;
      }
    };
  }

  static RemainCityCapacity(cityKey: string, actionName: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        return city?.[cityKey] < city?.[`${cityKey}_max`] ? null : `${actionName} 용량이 가득 찼습니다.`;
      }
    };
  }

  static NotSameDestCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destCity = input.destCity;
        return input.general?.getCityID() !== destCity?.city ? null : '현재 위치와 목적지가 같습니다.';
      }
    };
  }

  static AllowWar(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.nation?.war === 1 ? null : '전쟁이 금지되어 있습니다.';
      }
    };
  }

  static HasRouteWithEnemy(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return null;
      }
    };
  }

  static NotOpeningPart(years?: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (years === undefined) return null;
        const relYear = env?.year - env?.startyear;
        return relYear >= years ? null : `초반 제한 중입니다. (${years}년 후)`;
      }
    };
  }

  static ExistsDestNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.destNation !== null && input.destNation !== undefined ? null : '대상 세력이 존재하지 않습니다.';
      }
    };
  }

  static NearNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return null;
      }
    };
  }

  static DisallowDiplomacyBetweenStatus(statusMessages: Record<number, string>): IConstraint {
    return {
      test: (input: any, env: any) => {
        const diplomacyStatus = input.diplomacyStatus;
        if (Object.keys(statusMessages).includes(String(diplomacyStatus))) {
          return statusMessages[diplomacyStatus];
        }
        return null;
      }
    };
  }

  static ReqEnvValue(key: string, operator: string, value: any, message?: string): IConstraint {
    // Handle array value format: [value, message]
    let actualValue = value;
    let actualMessage = message;
    if (Array.isArray(value)) {
      actualValue = value[0];
      actualMessage = value[1];
    }
    
    return {
      test: (input: any, env: any) => {
        const envValue = env?.[key];
        let result = false;
        switch (operator) {
          case '>=':
            result = envValue >= actualValue;
            break;
          case '>':
            result = envValue > actualValue;
            break;
          case '<=':
            result = envValue <= actualValue;
            break;
          case '<':
            result = envValue < actualValue;
            break;
          case '===':
            result = envValue === actualValue;
            break;
          case '!==':
            result = envValue !== actualValue;
            break;
        }
        return result ? null : actualMessage;
      }
    };
  }

  static ReqNationGold(amount?: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (amount === undefined) return null;
        return input.nation?.gold >= amount ? null : `국가 자금이 부족합니다. (필요: ${amount})`;
      }
    };
  }

  static ReqNationRice(amount?: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (amount === undefined) return null;
        return input.nation?.rice >= amount ? null : `국가 군량이 부족합니다. (필요: ${amount})`;
      }
    };
  }

  static Custom(testFn: (input: any, env: any) => boolean, message: string): IConstraint {
    return {
      test: (input: any, env: any) => testFn(input, env) ? null : message
    };
  }

  static NearCity(distance: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (!input.general || !input.destCity) {
          return '장수 또는 목적지 정보가 없습니다.';
        }
        
        const generalCity = input.general.getVar?.('city') || input.general.city || input.general.data?.city;
        const destCityID = input.destCity.city || input.destCity.data?.city;
        
        if (!generalCity || !destCityID) {
          return '도시 정보가 없습니다.';
        }
        
        try {
          const { searchDistance } = require('../func/searchDistance');
          const distances = searchDistance(generalCity, distance, false);
          
          // searchDistance가 빈 객체를 반환하면 거리 체크를 스킵
          if (!distances || Object.keys(distances).length === 0) {
            console.warn(`[NearCity] searchDistance returned empty, skipping check for city ${generalCity} -> ${destCityID}`);
            return null; // 일단 허용 (거리 계산 실패 시)
          }
          
          if (distances[destCityID] !== undefined) {
            return null;
          }
          
          if (distance === 1) {
            return '인접도시가 아닙니다.';
          } else {
            return '거리가 너무 멉니다.';
          }
        } catch (error) {
          console.error('NearCity constraint error:', error);
          // 에러 시 일단 허용 (서버 안정성 우선)
          return null;
        }
      }
    };
  }

  static ExistsDestGeneral(): IConstraint {
    return {
      test: (input: any, env: any) => input.destGeneral ? null : '대상 장수가 없습니다.'
    };
  }

  static FriendlyDestGeneral(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getNationID() === input.destGeneral?.getNationID() 
          ? null : '아군 장수가 아닙니다.';
      }
    };
  }

  static ReqGeneralValue(key: string, name?: string, operator?: string, value?: any, message?: string): IConstraint {
    // Handle both old (key, operator, value, message) and new (key, name, operator, value, message) signatures
    const actualOperator = name && operator && value !== undefined && message ? operator : name;
    const actualValue = name && operator && value !== undefined && message ? value : operator;
    const actualMessage = name && operator && value !== undefined && message ? message : value;
    
    return {
      test: (input: any, env: any) => {
        const generalValue = input.general?.getVar(key);
        let result = false;
        switch (actualOperator) {
          case '>=': result = generalValue >= actualValue; break;
          case '>': result = generalValue > actualValue; break;
          case '<=': result = generalValue <= actualValue; break;
          case '<': result = generalValue < actualValue; break;
          case '===': result = generalValue === actualValue; break;
          case '!==': result = generalValue !== actualValue; break;
        }
        return result ? null : actualMessage;
      }
    };
  }

  static BeNeutral(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getNationID() === 0 ? null : '재야만 가능합니다.';
      }
    };
  }

  static AllowJoinAction(): IConstraint {
    return { test: () => null };
  }

  static AllowJoinDestNation(relYear: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destNation = input.destNation;
        if (!destNation) {
          return '대상 국가가 없습니다.';
        }

        const openingPartYear = env.opening_part_year || 3;
        const initialNationGenLimit = env.initial_nation_gen_limit || 10;
        const gennum = destNation.gennum || destNation.data?.gennum || 0;
        const scout = destNation.scout || destNation.data?.scout || 0;

        // 개막기에 장수 수 제한
        if (relYear < openingPartYear && gennum >= initialNationGenLimit) {
          return '임관이 제한되고 있습니다.';
        }

        // 임관 금지 국가
        if (scout === 1) {
          return '임관이 금지되어 있습니다.';
        }

        // 태수국 제한 (유저장)
        const general = input.general;
        const npc = general?.npc ?? general?.data?.npc ?? 2;
        const nationName = destNation.name || destNation.data?.name || '';
        if (npc < 2 && nationName.startsWith('ⓤ')) {
          return '유저장은 태수국에 임관할 수 없습니다.';
        }

        // 이민족 국가 제한
        if (npc !== 9 && nationName.startsWith('ⓞ')) {
          return '이민족 국가에 임관할 수 없습니다.';
        }

        return null;
      }
    };
  }

  static NoPenalty(...penalties: any[]): IConstraint {
    return { test: () => null };
  }

  static ReqCityTrader(...args: any[]): IConstraint {
    return { test: () => null };
  }

  static ReqCityCapacity(key: string, message?: string, value?: any): IConstraint {
    const actualMessage = message || key;
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        const maxKey = value !== undefined ? value : `${key}_max`;
        return city?.[key] < city?.[maxKey] ? null : actualMessage;
      }
    };
  }

  static AlwaysFail(message: string): IConstraint {
    return {
      test: () => message
    };
  }

  static NotOccupiedDestCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destCity = input.destCity;
        return destCity?.nation !== input.general?.getNationID() ? null : '아국 도시입니다.';
      }
    };
  }

  static ReqDestCityValue(key: string, operator: string, value: any, message: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destCity = input.destCity;
        const cityValue = destCity?.[key];
        let result = false;
        switch (operator) {
          case '>=': result = cityValue >= value; break;
          case '>': result = cityValue > value; break;
          case '<=': result = cityValue <= value; break;
          case '<': result = cityValue < value; break;
          case '===': result = cityValue === value; break;
          case '!==': result = cityValue !== value; break;
        }
        return result ? null : message;
      }
    };
  }

  static ReqNationAuxValue(key: string, operator: string, value: any, message: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const auxValue = input.nation?.aux?.[key];
        let result = false;
        switch (operator) {
          case '>=': result = auxValue >= value; break;
          case '>': result = auxValue > value; break;
          case '<=': result = auxValue <= value; break;
          case '<': result = auxValue < value; break;
          case '===': result = auxValue === value; break;
          case '!==': result = auxValue !== value; break;
        }
        return result ? null : message;
      }
    };
  }

  static ReqNationValue(key: string, name: string, operator: string, value: any, message?: string): IConstraint {
    const actualMessage = message || `국가 ${name} 조건을 만족하지 않습니다.`;
    return {
      test: (input: any, env: any) => {
        const nationValue = input.nation?.[key];
        let result = false;
        switch (operator) {
          case '>=': result = nationValue >= value; break;
          case '>': result = nationValue > value; break;
          case '<=': result = nationValue <= value; break;
          case '<': result = nationValue < value; break;
          case '===': result = nationValue === value; break;
          case '!==': result = nationValue !== value; break;
        }
        return result ? null : actualMessage;
      }
    };
  }

  static OccupiedDestCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destCity = input.destCity;
        return destCity?.nation === input.general?.getNationID() ? null : '아국 도시가 아닙니다.';
      }
    };
  }

  static SuppliedDestCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.destCity?.supply === 1 ? null : '목적지 도시의 보급이 끊겼습니다.';
      }
    };
  }

  static AvailableStrategicCommand(commandKey: string, message?: string): IConstraint {
    const actualMessage = message || '사용할 수 없는 전략 명령입니다.';
    return {
      test: (input: any, env: any) => {
        const available = input.availableCommandTypeList?.[commandKey];
        return available ? null : actualMessage;
      }
    };
  }

  static AllowDiplomacyWithTerm(minTerm: number, message?: string): IConstraint {
    const actualMessage = message || `최소 ${minTerm}개월 이상이어야 합니다.`;
    return {
      test: (input: any, env: any) => {
        const term = input.term || 0;
        return term >= minTerm ? null : actualMessage;
      }
    };
  }

  static AllowDiplomacyBetweenStatus(statuses: number[], message: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const diplomacyStatus = input.diplomacyStatus;
        return statuses.includes(diplomacyStatus) ? null : message;
      }
    };
  }

  static DifferentDestNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.general?.getNationID() !== input.destNation?.nation 
          ? null : '자국에는 사용할 수 없습니다.';
      }
    };
  }

  static ReqDestNationValue(key: string, operator: string, value: any, message: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const destNation = input.destNation;
        const nationValue = destNation?.[key];
        let result = false;
        switch (operator) {
          case '>=': result = nationValue >= value; break;
          case '>': result = nationValue > value; break;
          case '<=': result = nationValue <= value; break;
          case '<': result = nationValue < value; break;
          case '===': result = nationValue === value; break;
          case '!==': result = nationValue !== value; break;
        }
        return result ? null : message;
      }
    };
  }

  static NeutralCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.city?.nation === 0 ? null : '중립 도시가 아닙니다.';
      }
    };
  }

  static NotNeutralDestCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        return input.destCity?.nation !== 0 ? null : '중립 도시입니다.';
      }
    };
  }

  static CheckNationNameDuplicate(nationName: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        // This needs to be implemented with actual database check
        // For now, return null (pass)
        return null;
      }
    };
  }

  static BeOpeningPart(years: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const relYear = env?.year - env?.startyear;
        return relYear < years ? null : `초반 기간이 지났습니다.`;
      }
    };
  }

  static ReqCityTrust(minTrust: number, message?: string): IConstraint {
    const actualMessage = message || `도시 신뢰도가 부족합니다. (필요: ${minTrust})`;
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        return (city?.trust || 0) >= minTrust ? null : actualMessage;
      }
    };
  }

  static ReqGeneralCrewMargin(crewTypeId?: number, message?: string): IConstraint {
    const actualMessage = message || '병력이 최대치입니다.';
    return {
      test: (input: any, env: any) => {
        const general = input.general;
        if (!general) return actualMessage;
        
        const leadership = general.getLeadership?.(true) || general.getVar?.('leadership') || 0;
        const maxCrew = leadership * 100;
        const currentCrew = general.getVar?.('crew') || 0;
        
        return currentCrew < maxCrew ? null : actualMessage;
      }
    };
  }

  static AvailableRecruitCrewType(crewTypeId: number, message?: string): IConstraint {
    const actualMessage = message || '해당 병종을 징병할 수 없습니다.';
    return {
      test: (input: any, env: any) => {
        try {
          // 병종 데이터 로드
          const fs = require('fs');
          const path = require('path');
          const scenarioId = env.scenario_id || 'sangokushi';
          const unitsPath = path.join(__dirname, '../../config/scenarios', scenarioId, 'data/units.json');
          
          if (!fs.existsSync(unitsPath)) {
            // units.json이 없으면 통과 (기본 병종)
            return null;
          }
          
          const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
          const unitData = unitsData.units?.[crewTypeId.toString()];
          
          if (!unitData) {
            // 병종 데이터가 없으면 통과
            return null;
          }
          
          // constraints 확인
          const constraints = unitData.constraints || [];
          
          for (const constraint of constraints) {
            // 1. 절대 징병 불가
            if (constraint.type === 'impossible') {
              return `${unitData.name}은(는) 징병할 수 없습니다.`;
            }
            
            // 2. 기술 레벨 요구
            if (constraint.type === 'reqTech') {
              const requiredTech = constraint.value;
              const currentTech = input.nation?.tech || 0;
              
              if (currentTech < requiredTech) {
                return `${unitData.name}은(는) 기술 레벨 ${requiredTech} 이상이 필요합니다. (현재: ${currentTech})`;
              }
            }
            
            // 3. 특정 도시 소유 필요 (ANY 로직 - 국가가 소유한 도시 중 하나라도 있으면 OK)
            if (constraint.type === 'reqCities') {
              const requiredCityNames = Array.isArray(constraint.value) ? constraint.value : [constraint.value];
              const nationId = input.general?.getNationID();
              
              if (!nationId || nationId === 0) {
                return `${unitData.name}은(는) ${requiredCityNames.join(', ')} 중 하나를 소유해야 합니다.`;
              }
              
              // input.ownedCities 사용 (ExecuteEngine에서 미리 로드됨)
              const ownedCities = input.ownedCities || [];
              
              if (ownedCities.length > 0) {
                const hasRequiredCity = ownedCities.some((city: any) => 
                  requiredCityNames.includes(city.name)
                );
                
                if (!hasRequiredCity) {
                  const ownedCityNames = ownedCities.map((c: any) => c.name).join(', ');
                  return `${unitData.name}은(는) ${requiredCityNames.join(', ')} 중 하나를 소유해야 합니다. (보유 도시: ${ownedCityNames || '없음'})`;
                }
              } else {
                // ownedCities가 비어있으면 도시를 하나도 소유하지 않은 것
                return `${unitData.name}은(는) ${requiredCityNames.join(', ')} 중 하나를 소유해야 합니다.`;
              }
            }
            
            // 4. 특정 지역 소유 필요 (ANY 로직 - 국가가 해당 지역에 도시를 하나라도 소유하면 OK)
            if (constraint.type === 'reqRegions' || constraint.type === 'reqRegion') {
              const requiredRegionNames = Array.isArray(constraint.value) ? constraint.value : [constraint.value];
              const nationId = input.general?.getNationID();
              
              if (!nationId || nationId === 0) {
                return `${unitData.name}은(는) ${requiredRegionNames.join(', ')} 지역에 도시를 소유해야 합니다.`;
              }
              
              // 지역 정보 로드
              const regionsPath = path.join(__dirname, '../../config/scenarios', scenarioId, 'data/regions.json');
              if (!fs.existsSync(regionsPath)) {
                // regions.json이 없으면 통과
                return null;
              }
              
              const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf-8'));
              const regions = regionsData.regions || [];
              
              // input.ownedCities 사용
              const ownedCities = input.ownedCities || [];
              
              const hasRequiredRegion = ownedCities.some((ownedCity: any) => {
                // 소유 도시가 요구 지역에 속하는지 확인
                for (const region of regions) {
                  if (region.cities && region.cities.includes(ownedCity.name)) {
                    if (requiredRegionNames.includes(region.name) || 
                        (region.aliases && region.aliases.some((alias: string) => requiredRegionNames.includes(alias)))) {
                      return true;
                    }
                  }
                }
                return false;
              });
              
              if (!hasRequiredRegion) {
                const ownedRegionSet = new Set<string>();
                ownedCities.forEach((city: any) => {
                  for (const region of regions) {
                    if (region.cities && region.cities.includes(city.name)) {
                      ownedRegionSet.add(region.name);
                    }
                  }
                });
                const ownedRegionsText = Array.from(ownedRegionSet).join(', ') || '없음';
                return `${unitData.name}은(는) ${requiredRegionNames.join(', ')} 지역에 도시를 소유해야 합니다. (보유 지역: ${ownedRegionsText})`;
              }
            }
            
            // 5. 국가 타입 잠금 해제 요구
            if (constraint.type === 'country_type_unlock') {
              const requiredType = constraint.value;
              const currentNation = input.nation;
              
              if (!currentNation) {
                return `${unitData.name}은(는) 특정 국가 형태에서만 징병할 수 있습니다.`;
              }
              
              // 국가의 country_type 확인
              const countryType = currentNation.country_type || currentNation.data?.country_type;
              
              if (countryType !== requiredType) {
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
                return `${unitData.name}은(는) ${typeName} 국가에서만 징병할 수 있습니다.`;
              }
            }
            
            // 6. 특정 국가에서만 징병 가능 (국가 ID)
            if (constraint.type === 'reqNation') {
              const requiredNation = constraint.value;
              const currentNation = input.general?.getNationID();
              
              if (currentNation !== requiredNation) {
                return `${unitData.name}은(는) 특정 국가에서만 징병할 수 있습니다.`;
              }
            }
            
            // 7. 수뇌부 필요 (officer_level >= 5)
            if (constraint.type === 'reqChief') {
              const officerLevel = input.general?.getVar?.('officer_level') || 0;
              if (officerLevel < 5) {
                return `${unitData.name}은(는) 군주 및 수뇌부만 징병할 수 있습니다.`;
              }
            }
            
            // 8. 수뇌부 아니어야 함 (officer_level < 5)
            if (constraint.type === 'reqNotChief') {
              const officerLevel = input.general?.getVar?.('officer_level') || 0;
              if (officerLevel >= 5) {
                return `${unitData.name}은(는) 수뇌부가 아닌 장수만 징병할 수 있습니다.`;
              }
            }
            
            // 9. 특정 도시가 특정 레벨 이상 (reqCitiesWithCityLevel)
            if (constraint.type === 'reqCitiesWithCityLevel') {
              const requiredCityNames = Array.isArray(constraint.cities) ? constraint.cities : [constraint.cities];
              const requiredLevel = constraint.level || 1;
              const ownedCities = input.ownedCities || [];
              
              const hasRequiredLevelCity = ownedCities.some((city: any) => 
                requiredCityNames.includes(city.name) && (city.level || 0) >= requiredLevel
              );
              
              if (!hasRequiredLevelCity) {
                const levelNames = ['', '소', '중', '대', '거', '도'];
                const levelText = levelNames[requiredLevel] || requiredLevel;
                return `${unitData.name}은(는) ${requiredCityNames.join(', ')} 중 하나가 ${levelText}성 이상이어야 합니다.`;
              }
            }
            
            // 10. 고급 도시 N개 이상 소유 (reqHighLevelCities)
            if (constraint.type === 'reqHighLevelCities') {
              const requiredLevel = constraint.level || 3;
              const requiredCount = constraint.count || 1;
              const ownedCities = input.ownedCities || [];
              
              const highLevelCityCount = ownedCities.filter((city: any) => 
                (city.level || 0) >= requiredLevel
              ).length;
              
              if (highLevelCityCount < requiredCount) {
                const levelNames = ['', '소', '중', '대', '거', '도'];
                const levelText = levelNames[requiredLevel] || requiredLevel;
                return `${unitData.name}은(는) ${levelText}성 이상을 ${requiredCount}개 이상 소유해야 합니다. (현재: ${highLevelCityCount}개)`;
              }
            }
            
            // 11. 최소 상대 년도 (reqMinRelYear)
            if (constraint.type === 'reqMinRelYear') {
              const requiredYear = constraint.value || 0;
              const currentYear = env.year || 184;
              const startYear = env.startyear || 184;
              const relativeYear = currentYear - startYear;
              
              if (relativeYear < requiredYear) {
                return `${unitData.name}은(는) ${requiredYear}년 경과 후 사용 가능합니다. (현재: ${relativeYear}년)`;
              }
            }
            
            // 12. 국가 aux 조건 (reqNationAux)
            if (constraint.type === 'reqNationAux') {
              const auxKey = constraint.key;
              const cmp = constraint.cmp || '==';
              const value = constraint.value || 0;
              
              const nationAux = input.nation?.aux || input.nation?.data?.aux || {};
              const currentValue = nationAux[auxKey] || 0;
              
              let passed = false;
              switch (cmp) {
                case '==': passed = (currentValue == value); break;
                case '!=': passed = (currentValue != value); break;
                case '<': passed = (currentValue < value); break;
                case '>': passed = (currentValue > value); break;
                case '<=': passed = (currentValue <= value); break;
                case '>=': passed = (currentValue >= value); break;
              }
              
              if (!passed) {
                // 특수 메시지 (병종별)
                const specialMessages: Record<string, string> = {
                  'can_대검병사용': '대검병 연구 시 가능',
                  'can_극병사용': '극병 연구 시 가능',
                  'can_화시병사용': '화시병 연구 시 가능',
                  'can_원융노병사용': '원융노병 연구 시 가능',
                  'can_산저병사용': '산저병 연구 시 가능',
                  'can_상병사용': '상병 연구 시 가능',
                  'can_음귀병사용': '음귀병 연구 시 가능',
                  'can_무희사용': '무희 연구 시 가능',
                  'can_화륜차사용': '화륜차 연구 시 가능'
                };
                
                const specialMsg = specialMessages[auxKey];
                if (specialMsg && cmp === '==' && value === 1) {
                  return `${unitData.name}은(는) ${specialMsg}합니다.`;
                }
                
                return `${unitData.name}은(는) 특정 국가 조건(${auxKey} ${cmp} ${value})을 만족해야 합니다.`;
              }
            }
          }
          
          return null;
        } catch (error) {
          // 에러 발생 시 통과 (하위 호환성)
          console.error('[AvailableRecruitCrewType] Error:', error);
          return null;
        }
      }
    };
  }

}
