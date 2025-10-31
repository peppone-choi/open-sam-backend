export interface IConstraint {
  test: (input: any, env: any) => string | null;
  reason?: string;
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
    const actualOperator = name && operator && value !== undefined && message ? operator : (name as any);
    const actualValue = name && operator && value !== undefined && message ? value : (operator as any);
    const actualMessage = name && operator && value !== undefined && message ? message : (value as any);
    
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

  static AllowJoinDestNation(...args: any[]): IConstraint {
    return { test: () => null };
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

  static NotOccupiedDestCity(): IConstraint { return { test: () => null }; }
  static ReqDestCityValue(...args: any[]): IConstraint { return { test: () => null }; }
  static ReqNationAuxValue(...args: any[]): IConstraint { return { test: () => null }; }
  static ReqNationValue(...args: any[]): IConstraint { return { test: () => null }; }
  static OccupiedDestCity(): IConstraint { return { test: () => null }; }
  static SuppliedDestCity(): IConstraint { return { test: () => null }; }
  static AvailableStrategicCommand(...args: any[]): IConstraint { return { test: () => null }; }
  static AllowDiplomacyWithTerm(...args: any[]): IConstraint { return { test: () => null }; }
  static AllowDiplomacyBetweenStatus(statuses: number[], message: string): IConstraint { return { test: () => null }; }
  static DifferentDestNation(): IConstraint { return { test: () => null }; }
  static ReqDestNationValue(...args: any[]): IConstraint { return { test: () => null }; }

}
