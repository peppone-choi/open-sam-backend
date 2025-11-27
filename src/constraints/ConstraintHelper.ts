export interface IConstraint {
  test: (input: any, env: any) => string | null;
  reason?: string;
  message?: string;
}

/**
 * 한글 받침 존재 여부 확인 (조사 처리용)
 */
function hasKoreanBatchim(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
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

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NotChief.php
   * 수뇌부가 아닌 장수만 허용 (officer_level <= 4)
   */
  static NotChief(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const officerLevel = input.general?.getVar?.('officer_level') 
          ?? input.general?.officer_level 
          ?? input.general?.data?.officer_level 
          ?? 0;
        return officerLevel <= 4 ? null : '수뇌입니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NotLord.php
   * 군주가 아닌 장수만 허용 (officer_level !== 12)
   */
  static NotLord(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const officerLevel = input.general?.getVar?.('officer_level') 
          ?? input.general?.officer_level 
          ?? input.general?.data?.officer_level 
          ?? 0;
        return officerLevel !== 12 ? null : '군주입니다.';
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

  /**
   * 수도가 아닌 도시에서만 허용
   *
   * PHP ConstraintHelper::NotCapital(bool $ignoreOfficer=false) 대응
   * - 기본: 장수의 현재 도시가 자국 수도이면 실패
   * - ignoreOfficer=true인 경우, 태수/도독/대도독(2~4레벨)은 예외적으로 허용
   */
  static NotCapital(ignoreOfficer: boolean = false): IConstraint {
    return {
      test: (input: any, env: any) => {
        const general = input.general;
        const nation = input.nation;
        if (!general || !nation) {
          return '국가 또는 장수 정보가 없습니다.';
        }

        const cityId = typeof general.getVar === 'function'
          ? general.getVar('city')
          : general.city ?? general.data?.city;
        const officerLevel = typeof general.getVar === 'function'
          ? general.getVar('officer_level')
          : general.officer_level ?? general.data?.officer_level ?? 0;
        const capitalId = nation.capital ?? nation.data?.capital;

        if (cityId !== capitalId) {
          return null; // 수도가 아니면 통과
        }

        if (ignoreOfficer && officerLevel >= 2 && officerLevel <= 4) {
          return null; // 태수/도독/대도독일 때 예외 허용
        }

        return '이미 수도입니다.';
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
        const warFlag = input.nation?.war ?? 0;
        return warFlag === 0 ? null : '전쟁이 금지되어 있습니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/HasRoute.php
   * 목적 도시까지 경로가 있는지 확인 (자국 영토 통과)
   */
  static HasRoute(): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (!input.general || !input.destCity) {
          return '장수 또는 목적지 정보가 없습니다.';
        }

        const generalCity = input.general.getVar?.('city') ?? input.general.city ?? input.general.data?.city;
        const destCityId = input.destCity.city ?? input.destCity.data?.city;
        const nationId = input.general.getNationID?.() ?? input.general.nation ?? input.general.data?.nation ?? 0;

        if (!generalCity || !destCityId) {
          return '도시 정보가 없습니다.';
        }

        try {
          const { searchDistanceListToDest } = require('../func/searchDistance');
          const allowedNations = [nationId];
          const distanceList = searchDistanceListToDest(generalCity, destCityId, allowedNations);

          if (!distanceList || distanceList.length === 0) {
            return '경로에 도달할 방법이 없습니다.';
          }
          return null;
        } catch (error) {
          console.warn('[HasRoute] Error:', error);
          // 에러 시 일단 허용 (서버 안정성 우선)
          return null;
        }
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/HasRouteWithEnemy.php
   * 적국 영토를 통과하여 목적 도시까지 경로가 있는지 확인
   */
  static HasRouteWithEnemy(): IConstraint {
    return {
      test: (input: any, env: any) => {
        if (!input.general || !input.destCity) {
          return '장수 또는 목적지 정보가 없습니다.';
        }

        const generalCity = input.general.getVar?.('city') ?? input.general.city ?? input.general.data?.city;
        const destCityId = input.destCity.city ?? input.destCity.data?.city;
        const nationId = input.general.getNationID?.() ?? input.general.nation ?? input.general.data?.nation ?? 0;

        if (!generalCity || !destCityId) {
          return '도시 정보가 없습니다.';
        }

        try {
          const { searchDistanceListToDest } = require('../func/searchDistance');
          
          // 교전 중인 국가 목록 가져오기 (input.warNations에서)
          const warNations = input.warNations ?? [];
          const allowedNations = [nationId, 0, ...warNations]; // 자국, 중립, 교전국

          // 목적 도시가 교전국인지 확인
          const destCityNation = input.destCity.nation ?? input.destCity.data?.nation ?? 0;
          if (destCityNation !== 0 && destCityNation !== nationId && !warNations.includes(destCityNation)) {
            return '교전중인 국가가 아닙니다.';
          }

          const distanceList = searchDistanceListToDest(generalCity, destCityId, allowedNations);

          if (!distanceList || distanceList.length === 0) {
            return '경로에 도달할 방법이 없습니다.';
          }
          return null;
        } catch (error) {
          console.warn('[HasRouteWithEnemy] Error:', error);
          // 에러 시 일단 허용 (서버 안정성 우선)
          return null;
        }
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NotOpeningPart.php
   * 초반 제한 기간이 지났는지 확인
   * @param relYear - 현재 상대 년도 (현재년도 - 시작년도)
   */
  static NotOpeningPart(relYear?: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const openingPartYear = env?.opening_part_year ?? 3;
        const currentRelYear = relYear ?? ((env?.year ?? 0) - (env?.startyear ?? 0));
        return currentRelYear >= openingPartYear ? null : '초반 제한 중에는 불가능합니다.';
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

  /**
   * PHP 대응: core/hwe/sammo/Constraint/AllowDiplomacyStatus.php
   * 특정 외교 상태가 허용되는지 확인
   * @param nationID - 확인할 국가 ID
   * @param allowList - 허용되는 외교 상태 코드 배열
   * @param errMsg - 에러 메시지
   */
  static AllowDiplomacyStatus(nationID: number, allowList: number[], errMsg: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        // input.diplomacyList에서 해당 국가의 외교 상태를 찾음
        const diplomacyList = input.diplomacyList ?? [];
        
        // 허용된 상태가 있는지 확인
        const hasAllowedStatus = diplomacyList.some((dip: any) => 
          dip.me === nationID && allowList.includes(dip.state)
        );

        if (hasAllowedStatus) {
          return null;
        }
        return errMsg;
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/DisallowDiplomacyStatus.php
   * 특정 외교 상태가 금지되는지 확인
   * @param nationID - 확인할 국가 ID
   * @param disallowList - { 외교상태코드: 에러메시지 } 형태
   */
  static DisallowDiplomacyStatus(nationID: number, disallowList: Record<number, string>): IConstraint {
    return {
      test: (input: any, env: any) => {
        const diplomacyList = input.diplomacyList ?? [];
        const disallowCodes = Object.keys(disallowList).map(k => parseInt(k, 10));

        // 금지된 상태가 있는지 확인
        const foundDip = diplomacyList.find((dip: any) => 
          dip.me === nationID && disallowCodes.includes(dip.state)
        );

        if (!foundDip) {
          return null;
        }
        return disallowList[foundDip.state];
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

  static ReqCityCapacity(key: string, message?: string, value?: any): IConstraint {
    const actualMessage = message || key;
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        
        // value가 숫자면 절대값, 문자열이면 퍼센트
        if (typeof value === 'number') {
          const currentValue = city?.[key] || 0;
          if (currentValue >= value) {
            return null;
          }
          const josaYi = message?.endsWith('이') || message?.endsWith('가') ? '' : '이';
          return `${actualMessage}${josaYi} 부족합니다.`;
        }
        
        // 기본: max와 비교
        const maxKey = `${key}_max`;
        return city?.[key] < city?.[maxKey] ? null : `${actualMessage}이 부족합니다.`;
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

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NotOccupiedCity.php
   * 자국 도시가 아닌 경우만 허용
   */
  static NotOccupiedCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const cityNation = input.city?.nation ?? input.city?.data?.nation;
        const generalNation = input.general?.getNationID?.() ?? input.general?.nation ?? input.general?.data?.nation;
        return cityNation !== generalNation ? null : '아국입니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/ReqCityValue.php
   * 도시 값 비교 (범용)
   */
  static ReqCityValue(
    key: string, 
    keyNick: string, 
    comp: string, 
    reqVal: any, 
    errMsg?: string
  ): IConstraint {
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        if (!city) {
          return '도시 정보가 없습니다.';
        }

        const value = city[key] ?? city.data?.[key];
        let targetVal = reqVal;

        // 퍼센트 문자열 처리 (예: "50%")
        if (typeof reqVal === 'string' && reqVal.endsWith('%')) {
          const percent = parseFloat(reqVal.replace('%', '')) / 100;
          const maxKey = `${key}_max`;
          const maxValue = city[maxKey] ?? city.data?.[maxKey] ?? 100;
          targetVal = maxValue * percent;
        }

        let result = false;
        let defaultMsg = '';
        switch (comp) {
          case '<':
            result = value < targetVal;
            defaultMsg = '너무 많습니다.';
            break;
          case '<=':
            result = value <= targetVal;
            defaultMsg = '너무 많습니다.';
            break;
          case '==':
            result = value == targetVal;
            defaultMsg = `올바르지 않은 ${keyNick}입니다.`;
            break;
          case '!=':
            result = value != targetVal;
            defaultMsg = `올바르지 않은 ${keyNick}입니다.`;
            break;
          case '===':
            result = value === targetVal;
            defaultMsg = `올바르지 않은 ${keyNick}입니다.`;
            break;
          case '!==':
            result = value !== targetVal;
            defaultMsg = `올바르지 않은 ${keyNick}입니다.`;
            break;
          case '>=':
            result = value >= targetVal;
            defaultMsg = targetVal === 1 ? '없습니다.' : '부족합니다.';
            break;
          case '>':
            result = value > targetVal;
            defaultMsg = targetVal === 0 ? '없습니다.' : '부족합니다.';
            break;
          default:
            throw new Error(`Unknown comparator: ${comp}`);
        }

        if (result) return null;

        if (errMsg) return errMsg;

        // 조사 처리 (이/가)
        const lastChar = keyNick.charAt(keyNick.length - 1);
        const josa = hasKoreanBatchim(lastChar) ? '이' : '가';
        return `${keyNick}${josa} ${defaultMsg}`;
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

  static RemainCityTrust(actionName: string, minRemainTrust: number = 20, message?: string): IConstraint {
    const actualMessage = message || `${actionName} 후 도시 신뢰도가 ${minRemainTrust} 미만으로 떨어집니다.`;
    return {
      test: (input: any, env: any) => {
        // 선정 등 행동 후 신뢰도가 일정 수준 이상 남아야 함
        // 구체적인 계산은 각 커맨드에서 처리하므로 여기서는 기본 체크만
        const city = input.city;
        const currentTrust = city?.trust || 0;
        
        // 선정의 경우 신뢰도 감소량 계산 (간단 버전)
        // 실제 감소량은 커맨드에서 계산되므로 여기서는 최소 요구치만 체크
        return currentTrust >= minRemainTrust + 10 ? null : actualMessage;
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

  // ===== Phase 5: 특수 Constraint =====

  /**
   * PHP 대응: core/hwe/sammo/Constraint/AdhocCallback.php
   * 커스텀 콜백을 사용한 제약 조건 (TS에서는 Custom과 유사)
   */
  static AdhocCallback(callback: () => string | null): IConstraint {
    return {
      test: (input: any, env: any) => {
        return callback();
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/AllowRebellion.php
   * 반란 허용 조건 확인
   */
  static AllowRebellion(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const general = input.general;
        const nationId = general?.getNationID?.() ?? general?.nation ?? general?.data?.nation ?? 0;

        if (nationId === 0) {
          return '재야입니다.';
        }

        const lord = input.lord; // ExecuteEngine에서 미리 로드해야 함
        if (!lord) {
          return '군주 정보가 없습니다.';
        }

        const generalNo = general?.getVar?.('no') ?? general?.no ?? general?.data?.no ?? 0;
        if (lord.no === generalNo) {
          return '이미 군주입니다.';
        }

        // 군주 활동 여부 확인 (killturn 비교)
        const envKillturn = env?.killturn ?? 0;
        if ((lord.killturn ?? 0) >= envKillturn) {
          return '군주가 활동중입니다.';
        }

        // NPC 군주는 반란 불가
        const lordNpc = lord.npc ?? lord.data?.npc ?? 0;
        if ([2, 3, 6, 9].includes(lordNpc)) {
          return '군주가 NPC입니다.';
        }

        return null;
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/BattleGroundCity.php
   * 목적 도시가 교전 중인 국가의 도시인지 확인
   */
  static BattleGroundCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const generalNation = input.general?.getNationID?.() ?? input.general?.nation ?? input.general?.data?.nation ?? 0;
        const destCityNation = input.destCity?.nation ?? input.destCity?.data?.nation ?? 0;

        // 중립 도시면 허용
        if (destCityNation === 0) {
          return null;
        }

        // input.diplomacyList에서 교전 상태(state=0) 확인
        const diplomacyList = input.diplomacyList ?? [];
        const isAtWar = diplomacyList.some((dip: any) => 
          dip.me === generalNation && dip.you === destCityNation && dip.state === 0
        );

        if (isAtWar) {
          return null;
        }

        return '교전중인 국가의 도시가 아닙니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/ConstructableCity.php
   * 건설 가능 도시인지 확인 (공백지 + 중/소도시)
   */
  static ConstructableCity(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const city = input.city;
        const cityNation = city?.nation ?? city?.data?.nation;
        const cityLevel = city?.level ?? city?.data?.level ?? 0;

        if (cityNation !== 0) {
          return '공백지가 아닙니다.';
        }

        // level 5 = 중도시, level 6 = 소도시
        if (![5, 6].includes(cityLevel)) {
          return '중, 소 도시에만 가능합니다.';
        }

        return null;
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/DifferentNationDestGeneral.php
   * 타국 장수인지 확인
   */
  static DifferentNationDestGeneral(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const generalNation = input.general?.getNationID?.() ?? input.general?.nation ?? input.general?.data?.nation ?? 0;
        const destGeneralNation = input.destGeneral?.getNationID?.() ?? input.destGeneral?.nation ?? input.destGeneral?.data?.nation ?? 0;

        if (destGeneralNation !== generalNation) {
          return null;
        }

        return '같은 국가의 장수입니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/ExistsAllowJoinNation.php
   * 임관 가능한 국가가 존재하는지 확인
   */
  static ExistsAllowJoinNation(relYear: number, excludeNationList: number[]): IConstraint {
    return {
      test: (input: any, env: any) => {
        // input.nationList에서 임관 가능한 국가 확인
        const nationList = input.nationList ?? [];
        const initialNationGenLimit = env?.initial_nation_gen_limit ?? 10;
        const defaultMaxGeneral = env?.default_max_general ?? 50;

        const maxGen = relYear < 3 ? initialNationGenLimit : defaultMaxGeneral;

        const availableNations = nationList.filter((nation: any) => {
          const nationNo = nation.nation ?? nation.no ?? nation.data?.nation;
          if (excludeNationList.includes(nationNo)) return false;
          if ((nation.scout ?? nation.data?.scout ?? 0) !== 0) return false; // 임관 금지
          if ((nation.gennum ?? nation.data?.gennum ?? 0) >= maxGen) return false;
          return true;
        });

        if (availableNations.length > 0) {
          return null;
        }

        return '임관할 국가가 없습니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/MustBeNPC.php
   * NPC 장수인지 확인 (npc >= 2)
   */
  static MustBeNPC(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const npc = input.general?.getVar?.('npc') ?? input.general?.npc ?? input.general?.data?.npc ?? 0;
        return npc >= 2 ? null : 'NPC여야 합니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/MustBeTroopLeader.php
   * 부대장인지 확인
   */
  static MustBeTroopLeader(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const generalNo = input.general?.getVar?.('no') ?? input.general?.no ?? input.general?.data?.no ?? 0;
        const troopNo = input.general?.getVar?.('troop') ?? input.general?.troop ?? input.general?.data?.troop ?? 0;

        if (generalNo === troopNo && troopNo !== 0) {
          return null;
        }

        return '부대장이 아닙니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/ReqTroopMembers.php
   * 부대원이 있는지 확인
   */
  static ReqTroopMembers(): IConstraint {
    return {
      test: (input: any, env: any) => {
        // input.troopMembers에서 확인 (ExecuteEngine에서 미리 로드해야 함)
        const troopMembers = input.troopMembers ?? [];
        const generalNo = input.general?.getVar?.('no') ?? input.general?.no ?? input.general?.data?.no ?? 0;

        // 자기 자신을 제외한 부대원이 있는지 확인
        const hasMembers = troopMembers.some((member: any) => {
          const memberNo = member.no ?? member.data?.no ?? 0;
          return memberNo !== generalNo;
        });

        if (hasMembers) {
          return null;
        }

        return '집합 가능한 부대원이 없습니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NoPenalty.php
   * 특정 패널티가 없는지 확인
   */
  static NoPenalty(penaltyKey: string): IConstraint {
    return {
      test: (input: any, env: any) => {
        const penalty = input.general?.getVar?.('penalty') ?? input.general?.penalty ?? input.general?.data?.penalty ?? '{}';
        
        let penaltyObj: Record<string, string> = {};
        if (typeof penalty === 'string') {
          try {
            penaltyObj = JSON.parse(penalty);
          } catch {
            penaltyObj = {};
          }
        } else if (typeof penalty === 'object') {
          penaltyObj = penalty;
        }

        if (penaltyKey in penaltyObj) {
          return `징계 사유: ${penaltyObj[penaltyKey]}`;
        }

        return null;
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/NearNation.php
   * 인접 국가인지 확인
   */
  static NearNation(): IConstraint {
    return {
      test: (input: any, env: any) => {
        const srcNationId = input.nation?.nation ?? input.nation?.no ?? input.nation?.data?.nation ?? 0;
        const destNationId = input.destNation?.nation ?? input.destNation?.no ?? input.destNation?.data?.nation ?? 0;

        // input.neighborNations에서 확인 (ExecuteEngine에서 미리 로드해야 함)
        const neighborNations = input.neighborNations ?? [];

        if (neighborNations.includes(destNationId)) {
          return null;
        }

        // neighborNations가 없으면 일단 허용
        if (neighborNations.length === 0) {
          console.warn('[NearNation] neighborNations not provided, skipping check');
          return null;
        }

        return '인접 국가가 아닙니다.';
      }
    };
  }

  /**
   * PHP 대응: core/hwe/sammo/Constraint/ReqCityTrader.php
   * 도시에 상인이 있는지 확인
   */
  static ReqCityTrader(npcType: number): IConstraint {
    return {
      test: (input: any, env: any) => {
        const trade = input.city?.trade ?? input.city?.data?.trade;

        // trade가 있거나 npcType >= 2이면 허용
        if (trade !== null && trade !== undefined) {
          return null;
        }

        if (npcType >= 2) {
          return null;
        }

        return '도시에 상인이 없습니다.';
      }
    };
  }

}
