/**
 * PHP AST 인터프리터
 * 
 * php-parsed.json의 AST를 실행 가능한 TypeScript 코드로 변환
 * 
 * CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
 */

import { saveGeneral, saveCity, saveNation } from '../common/cache/model-cache.helper';

interface Statement {
  kind: string;
  call?: {
    object?: string;
    method: string;
    args: any[];
  };
  assign?: {
    target: string;
    value: any;
  };
  condition?: {
    test: string;
    then: Statement[];
    else: Statement[];
  };
}

export class PhpInterpreter {
  private context: any;
  private sessionId: string;
  
  constructor(context: {
    general?: any;
    city?: any;
    nation?: any;
    arg?: any;
    sessionId?: string;
  }) {
    this.context = context;
    this.sessionId = context.sessionId || context.general?.session_id || context.city?.session_id || 'sangokushi_default';
  }
  
  /**
   * Statement 실행
   */
  async executeStatements(statements: Statement[]) {
    for (const stmt of statements) {
      await this.executeStatement(stmt);
    }
  }
  
  /**
   * 단일 Statement 실행
   */
  private async executeStatement(stmt: Statement) {
    // 메서드 호출
    if (stmt.call) {
      await this.executeCall(stmt.call);
    }
    
    // 할당
    if (stmt.assign) {
      // 나중에 구현
    }
    
    // 조건문
    if (stmt.condition) {
      // 조건 평가 (간단한 경우만)
      if (stmt.condition.then) {
        await this.executeStatements(stmt.condition.then);
      }
    }
  }
  
  /**
   * 메서드 호출 실행
   */
  private async executeCall(call: { object?: string; method: string; args: any[] }) {
    const { object, method, args } = call;
    
    // $general->increaseVar('crew', 100)
    if (object === 'general' && this.context.general) {
      switch (method) {
        case 'increaseVar':
          const field = args[0];
          const amount = args[1];
          if (field && amount !== undefined) {
            this.context.general.data[field] = (this.context.general.data[field] || 0) + amount;
          }
          break;
          
        case 'setVar':
          const setField = args[0];
          const setValue = args[1];
          if (setField && setValue !== undefined) {
            this.context.general.data[setField] = setValue;
          }
          break;
          
        case 'increaseVarWithLimit':
          const limitField = args[0];
          const limitAmount = args[1];
          const limit = args[2];
          if (limitField && limitAmount !== undefined) {
            const newValue = (this.context.general.data[limitField] || 0) + limitAmount;
            this.context.general.data[limitField] = Math.max(newValue, limit || 0);
          }
          break;
          
        case 'addExperience':
          const exp = args[0];
          if (exp !== undefined) {
            this.context.general.data.experience = (this.context.general.data.experience || 0) + exp;
          }
          break;
          
        case 'addDedication':
          const ded = args[0];
          if (ded !== undefined) {
            this.context.general.data.dedication = (this.context.general.data.dedication || 0) + ded;
          }
          break;
      }
      
      // CQRS 패턴: 캐시에 쓰기
      const generalId = this.context.general.data?.no || this.context.general.no;
      const generalData = this.context.general.toObject 
        ? this.context.general.toObject() 
        : { ...this.context.general.data, session_id: this.sessionId, no: generalId };
      await saveGeneral(this.sessionId, generalId, generalData);
    }
    
    // $db->update('city', [...])
    if (method === 'update' && args[0] === 'city' && this.context.city) {
      const updates = args[1];
      if (typeof updates === 'object') {
        for (const [key, value] of Object.entries(updates)) {
          this.context.city.data[key] = value;
        }
        // CQRS 패턴: 캐시에 쓰기
        const cityId = this.context.city.city || this.context.city.data?.city;
        const cityData = this.context.city.toObject 
          ? this.context.city.toObject() 
          : { ...this.context.city.data, session_id: this.sessionId, city: cityId };
        await saveCity(this.sessionId, cityId, cityData);
      }
    }
    
    // $db->update('nation', [...])
    if (method === 'update' && args[0] === 'nation' && this.context.nation) {
      const updates = args[1];
      if (typeof updates === 'object') {
        for (const [key, value] of Object.entries(updates)) {
          this.context.nation.data[key] = value;
        }
        // CQRS 패턴: 캐시에 쓰기
        const nationId = this.context.nation.nation || this.context.nation.data?.nation;
        const nationData = this.context.nation.toObject 
          ? this.context.nation.toObject() 
          : { ...this.context.nation.data, session_id: this.sessionId, nation: nationId };
        await saveNation(this.sessionId, nationId, nationData);
      }
    }
  }
}

/**
 * 커맨드 클래스의 run() 메서드 실행
 */
export async function executePhpMethod(
  className: string,
  methodName: string,
  context: any,
  phpParsed: any
) {
  const classData = phpParsed.classes[className];
  if (!classData) {
    throw new Error(`클래스를 찾을 수 없습니다: ${className}`);
  }
  
  const method = classData.methods[methodName];
  if (!method) {
    throw new Error(`메서드를 찾을 수 없습니다: ${className}.${methodName}`);
  }
  
  const interpreter = new PhpInterpreter(context);
  await interpreter.executeStatements(method.statements || []);
}
