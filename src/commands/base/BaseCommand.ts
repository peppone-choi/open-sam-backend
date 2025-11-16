/**
 * BaseCommand - PHP sammo\Command\BaseCommand 직접 변환
 * 
 * 모든 커맨드의 기본 추상 클래스
 */

import { IGeneral } from '../../models/general.model';
import { DB } from '../../config/db';
import { LastTurn as ExternalLastTurn } from '../../types/LastTurn';
import { ActionLogger } from '../../services/logger/ActionLogger';

export interface ICity {
  city: number;
  name: string;
  nation: number;
  pop: number;
  agri: number;
  comm: number;
  secu: number;
  def: number;
  wall: number;
  trust: number;
  front?: number;
  region?: string;
  [key: string]: any;
}

export interface INation {
  nation: number;
  name: string;
  color: string;
  type: number;
  level: number;
  capital: number;
  gold?: number;
  rice?: number;
  tech?: number;
  gennum?: number;
  aux?: any;
  [key: string]: any;
}

export interface IConstraint {
  test: (input: IConstraintInput, env: any) => string | null;
  reason?: string;
  message?: string;
}

export interface IConstraintInput {
  general: any;
  city: ICity | null;
  nation: INation | null;
  cmd_arg: any;
  destGeneral?: any;
  destCity?: ICity | null;
  destNation?: INation | null;
  ownedCities?: ICity[];
  ownedRegions?: number[];
}

export interface ILastTurn {
  command: string;
  arg: any;
  term: number;
}

export class LastTurn implements ILastTurn {
  command: string;
  arg: any;
  term: number;
  seq: number;

  constructor(command: string = '휴식', arg: any = null, term: number = 0, seq: number = 0) {
    this.command = command;
    this.arg = arg;
    this.term = term;
    this.seq = seq;
  }

  duplicate(): LastTurn {
    return new LastTurn(this.command, this.arg, this.term, this.seq);
  }

  getTerm(): number {
    return this.term;
  }

  getCommand(): string {
    return this.command;
  }

  getArg(): any {
    return this.arg;
  }

  getSeq(): number {
    return this.seq;
  }

  setArg(arg: any): void {
    this.arg = arg;
  }
}

export abstract class BaseCommand {
  protected static actionName: string = 'CommandName';
  public static reqArg: boolean = false;
  protected static isLazyCalcReqTurn: boolean = false;
  
  public reason: string | null = null;

  protected generalObj: any;
  protected city: ICity | null = null;
  protected nation: INation | null = null;
  protected arg: any = null;
  protected env: any = null;

  protected destGeneralObj: any = null;
  protected destCity: ICity | null = null;
  protected destNation: INation | null = null;

  protected cachedPermissionToReserve: boolean = false;
  protected cachedMinConditionMet: boolean = false;
  protected cachedFullConditionMet: boolean = false;

  protected isArgValid: boolean = false;

  protected reasonNotFullConditionMet: string | null = null;
  protected reasonNotMinConditionMet: string | null = null;
  protected reasonNoPermissionToReserve: string | null = null;

  protected fullConditionConstraints: IConstraint[] | null = null;
  protected minConditionConstraints: IConstraint[] | null = null;
  protected permissionConstraints: IConstraint[] | null = null;
  protected reasonConstraint: IConstraint | null = null;

  protected logger: any = null;
  protected alternative: BaseCommand | null = null;

  protected static isInitStatic: boolean = false;

  protected static initStatic(): void {
    // Override in subclasses if needed
  }

  constructor(generalObj: any, env: any, arg: any = null) {
    const constructor = this.constructor as typeof BaseCommand;
    if (!constructor.isInitStatic) {
      constructor.initStatic();
      constructor.isInitStatic = true;
    }

    this.generalObj = generalObj;
    this.env = env;
    this.arg = arg;
    
    // ActionLogger 생성 (env에 year, month가 있을 때만)
    if (env?.year && env?.month) {
      this.logger = new ActionLogger(
        generalObj.getID(),
        generalObj.getNationID(),
        env.year,
        env.month,
        env.session_id || 'sangokushi_default',
        true  // autoFlush 명시적으로 true
      );
      generalObj.__currentLogger = this.logger;
    } else {
      // fallback: General의 간단한 로거 사용
      this.logger = generalObj.getLogger?.() || null;
      if (this.logger) {
        generalObj.__currentLogger = this.logger;
      }
    }

    this.init();
    if (this.argTest()) {
      this.isArgValid = true;
      if (constructor.reqArg) {
        this.initWithArg();
      }
    } else {
      this.isArgValid = false;
    }
  }

  protected resetTestCache(): void {
    this.cachedFullConditionMet = false;
    this.cachedMinConditionMet = false;
    this.cachedPermissionToReserve = false;

    this.reasonNotFullConditionMet = null;
    this.reasonNotMinConditionMet = null;
    this.reasonNoPermissionToReserve = null;
  }

  protected async setCity(): Promise<void> {
    this.resetTestCache();
    this.city = this.generalObj.getRawCity?.() || null;
      if (this.city) {
        // generalObj가 plain object일 수 있으므로 직접 할당
        if (typeof this.generalObj.setRawCity === 'function') {
          this.generalObj.setRawCity(this.city);
        } else {
          this.generalObj._cached_city = this.city;
        }
      }
    
    const { cityRepository } = require('../../repositories/city.repository');
    const cityId = this.generalObj.data.city;
    const sessionId = this.env.session_id;
    
    if (cityId && sessionId) {
      const cityDoc = await cityRepository.findOneByFilter({
        session_id: sessionId,
        $or: [
          { 'data.city': cityId },
          { city: cityId }
        ]
      });
      if (cityDoc) {
        // City 모델은 최상위 필드 우선 사용
        const cityObj = cityDoc.toObject?.() || cityDoc;
        this.city = {
          ...cityObj.data, // data 필드를 먼저 spread (기본값)
          // 최상위 필드로 덮어쓰기 (우선순위 높음)
          city: cityObj.city ?? cityObj.data?.city,
          name: cityObj.name ?? cityObj.data?.name,
          nation: cityObj.nation ?? cityObj.data?.nation,
          level: cityObj.level ?? cityObj.data?.level,
          pop: cityObj.pop ?? cityObj.data?.pop,
          pop_max: cityObj.pop_max ?? cityObj.data?.pop_max,
          agri: cityObj.agri ?? cityObj.data?.agri,
          agri_max: cityObj.agri_max ?? cityObj.data?.agri_max,
          comm: cityObj.comm ?? cityObj.data?.comm,
          comm_max: cityObj.comm_max ?? cityObj.data?.comm_max,
          secu: cityObj.secu ?? cityObj.data?.secu,
          secu_max: cityObj.secu_max ?? cityObj.data?.secu_max,
          def: cityObj.def ?? cityObj.data?.def,
          def_max: cityObj.def_max ?? cityObj.data?.def_max,
          wall: cityObj.wall ?? cityObj.data?.wall,
          wall_max: cityObj.wall_max ?? cityObj.data?.wall_max,
          supply: cityObj.supply ?? cityObj.data?.supply,
          front: cityObj.front ?? cityObj.data?.front,
          trust: cityObj.trust ?? cityObj.data?.trust,
          trade: cityObj.trade ?? cityObj.data?.trade,
          occupied: cityObj.occupied ?? cityObj.data?.occupied
        };
        this.generalObj.setRawCity?.(this.city);
      }
    }
  }

  protected async setNation(args: string[] | null = null): Promise<void> {
    this.resetTestCache();
    if (args === null) {
      if (!this!.nation) {
        this!.nation = this.generalObj.getStaticNation?.() || null;
      }
      return;
    }

    const nationID = this.generalObj.getNationID();
    if (nationID === 0) {
      this!.nation = this.generalObj.getStaticNation?.() || {
        nation: 0,
        name: '재야',
        color: '#000000',
        type: 0,
        level: 0,
        capital: 0,
        aux: {}
      };
      return;
    }

    const { nationRepository } = require('../../repositories/nation.repository');
    const sessionId = this.env.session_id;
    
    if (sessionId) {
      const nationDoc = await nationRepository.findOneByFilter({
        session_id: sessionId,
        $or: [
          { 'data.nation': nationID },
          { nation: nationID }
        ]
      });
      if (nationDoc) {
        this.nation = nationDoc.data || nationDoc.toObject?.() || nationDoc;
      }
    }
  }

  protected setDestGeneral(destGeneralObj: any): void {
    this.resetTestCache();
    this.destGeneralObj = destGeneralObj;
  }

  protected setDestCity(cityNo: number, onlyName: boolean = false): void {
    this.resetTestCache();
    
    // 즉시 fallback 값으로 설정하여 동기적으로 사용 가능하게 함
    this.destCity = {
      city: cityNo,
      name: `City_${cityNo}`,
      nation: 0,
      pop: 0,
      agri: 0,
      comm: 0,
      secu: 0,
      def: 0,
      wall: 0,
      trust: 0,
      level: 0
    };
    
    // 백그라운드에서 실제 데이터 로드
    (async () => {
      try {
        const { cityRepository } = await import('../../repositories/city.repository');
        const sessionId = this.env.session_id || 'sangokushi_default';
        
        const cityDoc = await cityRepository.findOneByFilter({
          session_id: sessionId,
          city: cityNo
        });
        
        if (!cityDoc) {
          console.error(`setDestCity: City ${cityNo} not found in session ${sessionId}`);
          return;
        }
        
        // City 모델은 최상위 필드를 우선 사용, 없으면 data 필드 사용
        this.destCity = {
          city: cityDoc.city ?? cityDoc.data?.city ?? cityNo,
          name: cityDoc.name ?? cityDoc.data?.name ?? `City_${cityNo}`,
          nation: cityDoc.nation ?? cityDoc.data?.nation ?? 0,
          pop: cityDoc.pop ?? cityDoc.data?.pop ?? 0,
          agri: cityDoc.agri ?? cityDoc.data?.agri ?? 0,
          comm: cityDoc.comm ?? cityDoc.data?.comm ?? 0,
          secu: cityDoc.secu ?? cityDoc.data?.secu ?? 0,
          def: cityDoc.def ?? cityDoc.data?.def ?? 0,
          wall: cityDoc.wall ?? cityDoc.data?.wall ?? 0,
          trust: cityDoc.trust ?? cityDoc.data?.trust ?? 0,
          level: cityDoc.level ?? cityDoc.data?.level ?? 0
        };
      } catch (error) {
        console.error('setDestCity 실패:', error);
      }
    })();
  }
  
  // async 버전도 필요한 경우를 위해 별도로 제공
  protected async setDestCityAsync(cityNo: number, onlyName: boolean = false): Promise<void> {
    this.resetTestCache();
    
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      
      const cityDoc = await cityRepository.findOneByFilter({
        session_id: sessionId,
        city: cityNo
      });
      
      if (!cityDoc) {
        console.error(`setDestCityAsync: City ${cityNo} not found in session ${sessionId}`);
        this.destCity = {
          city: cityNo,
          name: `City_${cityNo}`,
          nation: 0,
          pop: 0,
          agri: 0,
          comm: 0,
          secu: 0,
          def: 0,
          wall: 0,
          trust: 0
        };
        return;
      }
      
      // City 모델은 최상위 필드를 우선 사용, 없으면 data 필드 사용
      this.destCity = {
        city: cityDoc.city ?? cityDoc.data?.city ?? cityNo,
        name: cityDoc.name ?? cityDoc.data?.name ?? `City_${cityNo}`,
        nation: cityDoc.nation ?? cityDoc.data?.nation ?? 0,
        pop: cityDoc.pop ?? cityDoc.data?.pop ?? 0,
        agri: cityDoc.agri ?? cityDoc.data?.agri ?? 0,
        comm: cityDoc.comm ?? cityDoc.data?.comm ?? 0,
        secu: cityDoc.secu ?? cityDoc.data?.secu ?? 0,
        def: cityDoc.def ?? cityDoc.data?.def ?? 0,
        wall: cityDoc.wall ?? cityDoc.data?.wall ?? 0,
        trust: cityDoc.trust ?? cityDoc.data?.trust ?? 0,
        level: cityDoc.level ?? cityDoc.data?.level ?? 0
      };
    } catch (error) {
      console.error('setDestCityAsync 실패:', error);
      this.destCity = {
        city: cityNo,
        name: `City_${cityNo}`,
        nation: 0,
        pop: 0,
        agri: 0,
        comm: 0,
        secu: 0,
        def: 0,
        wall: 0,
        trust: 0
      };
    }
  }

  protected async setDestNation(nationID: number, args: string[] | null = null): Promise<void> {
    this.resetTestCache();
    
    try {
      const { nationRepository } = await import('../../repositories/nation.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      
      const nationDoc = await nationRepository.findByNationNum(sessionId, nationID);
      
      if (nationDoc && nationDoc.data) {
        this.destNation = nationDoc.data;
      } else {
        this.destNation = null;
      }
    } catch (error) {
      console.error('setDestNation 실패:', error);
      this.destNation = null;
    }
  }

  protected abstract init(): void;
  
  protected initWithArg(): void {
    // 자식 클래스에서 오버라이드해야 함
    // reqArg가 true인 경우 반드시 오버라이드 필요
    const constructor = this.constructor as typeof BaseCommand;
    if (constructor.reqArg) {
      console.warn(`[Warning] ${constructor.name}: initWithArg() not overridden but reqArg=true`);
    }
  }

  protected abstract argTest(): boolean;

  public getArg(): any {
    return this.arg;
  }

  public getGeneral(): any {
    return this.generalObj;
  }

  public getNationID(): number {
    return this.generalObj.getNationID();
  }

  public getOfficerLevel(): number {
    return this.generalObj.data.officer_level;
  }

  public getBrief(): string {
    const constructor = this.constructor as typeof BaseCommand;
    return constructor.getName();
  }

  public getRawClassName(shortName: boolean = true): string {
    if (shortName) {
      return this.constructor!.name;
    }
    return this.constructor!.name;
  }

  public getCompensationStyle(): number | null {
    return 0;
  }

  public static getName(): string {
    return this.actionName;
  }

  public getLogger(): any {
    return this.logger;
  }

  public abstract getNextExecuteKey(): string;
  public abstract getNextAvailableTurn(): Promise<number | null>;
  public abstract setNextAvailable(yearMonth?: number | null): Promise<void>;

  protected async testPostReqTurn(): Promise<[string, string] | null> {
    if (!this.getPostReqTurn()) {
      return null;
    }

    const nextAvailableTurn = await this.getNextAvailableTurn();
    if (nextAvailableTurn === null) {
      return null;
    }

    const yearMonth = this.joinYearMonth(this.env.year, this.env.month);
    
    if (nextAvailableTurn > yearMonth) {
      const remainingMonths = nextAvailableTurn - yearMonth;
      return ['대기 기간이 남았습니다', `${remainingMonths}개월 후 사용 가능`];
    }
    
    return null;
  }

  protected joinYearMonth(year: number, month: number): number {
    return year * 12 + month;
  }

  public testPermissionToReserve(): string | null {
    if (this.cachedPermissionToReserve) {
      return this.reasonNoPermissionToReserve;
    }

    if (!this.permissionConstraints) {
      return null;
    }

    if (this.reasonNoPermissionToReserve) {
      return this.reasonNoPermissionToReserve;
    }

    // Constraint input 객체 생성
    const input: IConstraintInput = {
      general: this.generalObj,
      city: this.city,
      nation: this.nation,
      cmd_arg: this.arg,
      destGeneral: this.destGeneralObj,
      destCity: this.destCity,
      destNation: this.destNation
    };

    // Constraint testing 구현
    for (const constraint of this.permissionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(input, this.env);
        if (result !== null) {
          this.reasonNoPermissionToReserve = result || constraint.reason || constraint.message || '권한이 없습니다';
          this.cachedPermissionToReserve = true;
          return this.reasonNoPermissionToReserve;
        }
      }
    }
    
    this.cachedPermissionToReserve = true;
    return null;
  }

  public canDisplay(): boolean {
    return true;
  }

  public testMinConditionMet(): string | null {
    const constructor = this.constructor as typeof BaseCommand;
    if (!constructor.reqArg && !this.minConditionConstraints) {
      return this.testFullConditionMet();
    }

    if (this.minConditionConstraints === null) {
      throw new Error('minConditionConstraints가 제대로 설정되지 않았습니다');
    }

    if (this.cachedMinConditionMet) {
      return this.reasonNotMinConditionMet;
    }

    // Constraint input 객체 생성
    const input: IConstraintInput = {
      general: this.generalObj,
      city: this.city,
      nation: this.nation,
      cmd_arg: this.arg,
      destGeneral: this.destGeneralObj,
      destCity: this.destCity,
      destNation: this.destNation
    };

    // Constraint testing 구현
    for (const constraint of this.minConditionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(input, this.env);
        if (result !== null) {
          this.reasonNotMinConditionMet = result || constraint.reason || constraint.message || '조건을 만족하지 않습니다';
          this.cachedMinConditionMet = true;
          return this.reasonNotMinConditionMet;
        }
      }
    }
    
    this.cachedMinConditionMet = true;
    return null;
  }

  public testFullConditionMet(): string | null {
    if (!this.isArgValid) {
      this.reasonNotFullConditionMet = '인자가 올바르지 않습니다.';
      this.cachedFullConditionMet = true;
      return this.reasonNotFullConditionMet;
    }

    if (this.fullConditionConstraints === null) {
      throw new Error('fullConditionConstraints가 제대로 설정되지 않았습니다');
    }

    if (this.cachedFullConditionMet) {
      return this.reasonNotFullConditionMet;
    }

    // Constraint input 객체 생성
    // ownedCities는 env에서 전달받음 (ExecuteEngine에서 미리 로드)
    const input: IConstraintInput = {
      general: this.generalObj,
      city: this.city,
      nation: this.nation,
      cmd_arg: this.arg,
      destGeneral: this.destGeneralObj,
      destCity: this.destCity,
      destNation: this.destNation,
      ownedCities: this.env?.ownedCities || []
    };

    // Constraint testing 구현
    for (const constraint of this.fullConditionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(input, this.env);
        // result가 null이면 성공, 문자열이면 실패 (에러 메시지)
        if (result !== null) {
          this.reasonNotFullConditionMet = result || constraint.reason || constraint.message || '조건을 만족하지 않습니다';
          this.cachedFullConditionMet = true;
          return this.reasonNotFullConditionMet;
        }
      }
    }
    
    this.cachedFullConditionMet = true;
    return null;
  }

  public getTermString(): string {
    const commandName = (this.constructor as typeof BaseCommand).getName();
    const resultTurn = this.getResultTurn() as any;
    const term = resultTurn.getTerm ? resultTurn.getTerm() : resultTurn.term;
    const termMax = this.getPreReqTurn() + 1;
    return `${commandName} 수행중... (${term}/${termMax})`;
  }

  public addTermStack(): boolean {
    if (this.getPreReqTurn() === 0) {
      return true;
    }

    const lastTurn = this.getLastTurn() as any;
    const commandName = (this.constructor as typeof BaseCommand).getName();
    
    const ltCommand = lastTurn.getCommand ? lastTurn.getCommand() : lastTurn.command;
    const ltArg = lastTurn.getArg ? lastTurn.getArg() : lastTurn.arg;
    
    if (ltCommand !== commandName || ltArg !== this.arg) {
      this.setResultTurn(new LastTurn(commandName, this.arg, 1));
      return false;
    }

    const ltTerm = lastTurn.getTerm ? lastTurn.getTerm() : lastTurn.term;
    if (ltTerm < this.getPreReqTurn()) {
      this.setResultTurn(new LastTurn(commandName, this.arg, ltTerm + 1));
      return false;
    }

    return true;
  }

  public hasPermissionToReserve(): boolean {
    return this.testPermissionToReserve() === null;
  }

  public isArgumentValid(): boolean {
    return this.isArgValid;
  }

  public hasMinConditionMet(): boolean {
    return this.testMinConditionMet() === null;
  }

  public hasFullConditionMet(): boolean {
    return this.testFullConditionMet() === null;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof BaseCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    return `${failReason} ${commandName} 실패.`;
  }

  public getAlternativeCommand(): BaseCommand | null {
    return this.alternative;
  }

  public getCommandDetailTitle(): string | Promise<string> {
    return (this.constructor as typeof BaseCommand).getName();
  }

  public abstract getCost(): [number, number];
  public abstract getPreReqTurn(): number;
  public abstract getPostReqTurn(): number;
  public abstract run(rng: any): Promise<boolean>;

  public exportJSVars(): any {
    return {};
  }

  public getLastTurn(): LastTurn | ExternalLastTurn {
    return this.generalObj.getLastTurn();
  }

  public setResultTurn(lastTurn: LastTurn | ExternalLastTurn): void {
    this.generalObj._setResultTurn(lastTurn);
  }

  public getResultTurn(): LastTurn | ExternalLastTurn {
    return this.generalObj.getResultTurn();
  }

  /**
   * 장수 정보를 레포지토리를 통해 저장
   * generalObj.save() 대신 사용
   */
  protected async saveGeneral(): Promise<void> {
    const { generalRepository } = require('../../repositories/general.repository');
    const sessionId = this.env.session_id;
    const generalNo = this.generalObj.getID();
    
    console.log(`[BaseCommand.saveGeneral] 장수 저장 시작: session=${sessionId}, no=${generalNo}`);
    
    // GeneralAdapter 여부 및 실제 raw 객체 분리
    const isAdapter = typeof (this.generalObj as any).getRaw === 'function';
    const rawGeneral: any = isAdapter
      ? (this.generalObj as any).getRaw()
      : this.generalObj;

    // ✅ PHP와 동일한 검증: nation > 0이면 officer_level은 최소 1이어야 함
    const generalData = rawGeneral.data || rawGeneral;
    const nation = generalData.nation || 0;
    let officerLevel = generalData.officer_level;
    
    // nation이 있는데 officer_level이 0이거나 없으면 1로 설정
    if (nation > 0 && (!officerLevel || officerLevel === 0)) {
      console.warn(`[BaseCommand.saveGeneral] ⚠️ 데이터 정합성 수정: nation=${nation}인데 officer_level=${officerLevel} → 1로 수정`);
      generalData.officer_level = 1;
      if (rawGeneral.data) {
        rawGeneral.data.officer_level = 1;
      }
    }
    // nation이 0인데 officer_level이 1 이상이면 0으로 설정
    else if (nation === 0 && officerLevel && officerLevel > 0) {
      console.warn(`[BaseCommand.saveGeneral] ⚠️ 데이터 정합성 수정: nation=0인데 officer_level=${officerLevel} → 0으로 수정`);
      generalData.officer_level = 0;
      if (rawGeneral.data) {
        rawGeneral.data.officer_level = 0;
      }
    }
    
    // Mongoose 문서인 경우에만 save() 경로 사용
    if (!isAdapter && rawGeneral.save && typeof rawGeneral.save === 'function') {
      console.log(`[BaseCommand.saveGeneral] GeneralRepository.save() 호출 (Mongoose 문서)`);
      await generalRepository.save(rawGeneral);
    } else {
      // GeneralAdapter 또는 Plain Object인 경우: 캐시 기반 업데이트 사용
      // - rawGeneral.data 안에 실제 게임 필드가 들어있으므로
      //   updateBySessionAndNo에는 { data: ... } 형식으로 전달한다.
      const dataPayload = (rawGeneral as any).data;
      const updateData = dataPayload ? { data: dataPayload } : (rawGeneral.toObject?.() || rawGeneral);
      console.log(
        `[BaseCommand.saveGeneral] Repository 사용 (cache update), hasData=${!!dataPayload}`
      );
      await generalRepository.updateBySessionAndNo(sessionId, generalNo, updateData);
    }
    
    console.log(`[BaseCommand.saveGeneral] 장수 저장 완료`);
  }
}
