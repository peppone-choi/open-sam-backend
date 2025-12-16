/**
 * BaseCommand - PHP sammo\Command\BaseCommand 직접 변환
 * 
 * 모든 커맨드의 기본 추상 클래스
 */

import { LastTurn as ExternalLastTurn } from '../../types/LastTurn';
import { ActionLogger } from '../../services/logger/ActionLogger';
import { CityConst } from '../../const/CityConst';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { INation } from '../../models/nation.model';
import { 
  invalidateCache, 
  saveGeneral as cacheSaveGeneral, 
  saveCity as cacheSaveCity, 
  saveNation as cacheSaveNation,
  saveTroop as cacheSaveTroop,
  saveDiplomacy as cacheSaveDiplomacy,
  saveCommand as cacheSaveCommand,
  saveUnitStack as cacheSaveUnitStack
} from '../../common/cache/model-cache.helper';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { generalRepository } from '../../repositories/general.repository';

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
  protected cachedUnitStacks: Record<string, any[]> = {};
  protected unitStacksDirty: boolean = false;
  protected dirtyGenerals = new Set<number>();
  protected dirtyCities = new Set<number>();
  protected dirtyNations = new Set<number>();
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

  private static resolveGeneralId(generalObj: any): number {
    if (typeof generalObj?.getID === 'function') {
      return generalObj.getID();
    }
    return generalObj?.no ?? generalObj?.data?.no ?? 0;
  }

  private static resolveNationId(generalObj: any): number {
    if (typeof generalObj?.getNationID === 'function') {
      return generalObj.getNationID();
    }
    return generalObj?.nation ?? generalObj?.data?.nation ?? 0;
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

    const resolvedGeneralId = BaseCommand.resolveGeneralId(generalObj);
    const resolvedNationId = BaseCommand.resolveNationId(generalObj);
    
    // ActionLogger 생성 (env에 year, month가 있을 때만)
    if (env?.year && env?.month) {
      this.logger = new ActionLogger(
        resolvedGeneralId,
        resolvedNationId,
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
      // CQRS: 캐시 우선 조회 (findByCityNum 사용)
      const cityDoc = await cityRepository.findByCityNum(sessionId, cityId);
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

    await this.ensureUnitStacksCache();
  }

  protected async ensureUnitStacksCache(): Promise<void> {
    const sessionId = this.env?.session_id;
    if (!sessionId) return;
    const generalNo = this.generalObj?.getID?.() ?? this.generalObj?.no ?? this.generalObj?.data?.no;
    if (!generalNo) return;
    const cacheKey = `${sessionId}:${generalNo}`;
    if (this.cachedUnitStacks[cacheKey]) {
      return;
    }
    this.cachedUnitStacks[cacheKey] = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
  }

  protected getCachedUnitStacks(): any[] {
    const sessionId = this.env?.session_id;
    if (!sessionId) return [];
    const generalNo = this.generalObj?.getID?.() ?? this.generalObj?.no ?? this.generalObj?.data?.no;
    if (!generalNo) return [];
    const cacheKey = `${sessionId}:${generalNo}`;
    return this.cachedUnitStacks[cacheKey] || [];
  }

  protected getUnitStackCacheKey(): string | null {
    const sessionId = this.env?.session_id;
    if (!sessionId) return null;
    const generalNo = this.generalObj?.getID?.() ?? this.generalObj?.no ?? this.generalObj?.data?.no;
    if (!generalNo) return null;
    return `${sessionId}:${generalNo}`;
  }

  protected invalidateUnitStackCache(): void {
    const cacheKey = this.getUnitStackCacheKey();
    if (cacheKey && this.cachedUnitStacks[cacheKey]) {
      delete this.cachedUnitStacks[cacheKey];
    }
  }
 
  protected markUnitStacksDirty(): void {
    this.unitStacksDirty = true;
    this.invalidateUnitStackCache();
  }
 
  protected markGeneralDirty(generalId?: number): void {
    const targetId = generalId ?? this.generalObj?.getID?.() ?? this.generalObj?.no ?? this.generalObj?.data?.no;
    if (typeof targetId === 'number' && targetId > 0) {
      this.dirtyGenerals.add(targetId);
    }
  }
 
  protected markCityDirty(cityId?: number): void {
    const resolvedId = cityId ?? this.city?.city ?? (this.city as any)?.data?.city;
    if (typeof resolvedId === 'number' && resolvedId > 0) {
      this.dirtyCities.add(resolvedId);
    }
  }
 
  protected markNationDirty(nationId?: number): void {
    const resolvedId = nationId ?? this.nation?.nation ?? (this.nation as any)?.data?.nation;
    if (typeof resolvedId === 'number' && resolvedId > 0) {
      this.dirtyNations.add(resolvedId);
    }
  }
 
  protected markDefaultDirtyEntities(): void {
    this.markGeneralDirty();
 
    const destGeneralId = this.destGeneralObj?.getID?.() ?? this.destGeneralObj?.no ?? this.destGeneralObj?.data?.no;
    if (typeof destGeneralId === 'number' && destGeneralId > 0) {
      this.dirtyGenerals.add(destGeneralId);
    }
 
    const currentCityId = this.city?.city ?? (this.city as any)?.data?.city;
    if (typeof currentCityId === 'number' && currentCityId > 0) {
      this.dirtyCities.add(currentCityId);
    }
    const destCityId = this.destCity?.city ?? (this.destCity as any)?.data?.city;
    if (typeof destCityId === 'number' && destCityId > 0) {
      this.dirtyCities.add(destCityId);
    }
 
    const nationId = this.nation?.nation ?? (this.nation as any)?.data?.nation;
    if (typeof nationId === 'number' && nationId > 0) {
      this.dirtyNations.add(nationId);
    }
    const destNationId = this.destNation?.nation ?? (this.destNation as any)?.data?.nation;
    if (typeof destNationId === 'number' && destNationId > 0) {
      this.dirtyNations.add(destNationId);
    }
  }
 
  protected async flushDirtyCaches(): Promise<void> {
    const sessionId = this.env?.session_id || this.generalObj?.getSessionID?.();
    if (!sessionId) {
      this.dirtyGenerals.clear();
      this.dirtyCities.clear();
      this.dirtyNations.clear();
      return;
    }
 
    const tasks: Array<Promise<unknown>> = [];
 
    if (this.dirtyGenerals.size > 0) {
      // 장수 정보는 saveGeneral 단계에서 캐시/큐를 갱신하므로 별도 무효화가 필요 없다.
      this.dirtyGenerals.clear();
    }
 
    if (this.dirtyCities.size > 0) {
      // 도시 정보는 saveCity에서 캐시를 갱신하므로 entity는 무효화하지 않음
      // lists만 무효화하여 목록 캐시 갱신
      for (const cityId of this.dirtyCities) {
        tasks.push(invalidateCache('city', sessionId, cityId, { targets: ['lists'] }));
      }
    }
 
    if (this.dirtyNations.size > 0) {
      // 국가 정보는 saveNation에서 캐시를 갱신하므로 entity는 무효화하지 않음
      // lists만 무효화하여 목록 캐시 갱신
      for (const nationId of this.dirtyNations) {
        tasks.push(invalidateCache('nation', sessionId, nationId, { targets: ['lists'] }));
      }
    }
 
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
 
    this.dirtyGenerals.clear();
    this.dirtyCities.clear();
    this.dirtyNations.clear();
  }
 
  protected async syncGeneralTroopData(sessionId?: string, generalNo?: number): Promise<void> {
    const effectiveSessionId = sessionId || this.env?.session_id || this.generalObj?.getSessionID?.() || 'sangokushi_default';
    const effectiveGeneralNo = generalNo || this.generalObj?.getID?.() || this.generalObj?.no || this.generalObj?.data?.no;
    if (!effectiveGeneralNo) {
      return;
    }
 
    const stacks = await unitStackRepository.findByOwner(effectiveSessionId, 'general', effectiveGeneralNo);
    const totalTroops = stacks.reduce((sum, stack) => sum + (stack.hp ?? (stack.unit_size ?? 100) * (stack.stack_count ?? 0)), 0);
    this.generalObj.data.crew = totalTroops;
    if (stacks.length > 0) {
      const primary = stacks[0];
      this.generalObj.data.crewtype = primary.crew_type_id ?? 0;
      this.generalObj.data.train = primary.train ?? 0;
      this.generalObj.data.atmos = primary.morale ?? 0;
    } else {
      this.generalObj.data.crewtype = 0;
      this.generalObj.data.train = 0;
      this.generalObj.data.atmos = 0;
    }
 
    if (typeof this.generalObj.markModified === 'function') {
      this.generalObj.markModified('data');
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

    const nationID = BaseCommand.resolveNationId(this.generalObj);
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
      // CQRS: 캐시 우선 조회 (findByNationNum 사용)
      const nationDoc = await nationRepository.findByNationNum(sessionId, nationID);
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
    const fallbackCityMeta = CityConst.byID(cityNo, this.env?.scenario_id);
    this.destCity = {
      city: fallbackCityMeta?.city ?? cityNo,
      name: fallbackCityMeta?.name ?? `City_${cityNo}`,
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
        
        // CQRS: 캐시 우선 조회
        const cityDoc: any = await cityRepository.findByCityNum(sessionId, cityNo);
        
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
      
      // CQRS: 캐시 우선 조회
      const cityDoc: any = await cityRepository.findByCityNum(sessionId, cityNo);
      
      if (!cityDoc) {
        console.error(`setDestCityAsync: City ${cityNo} not found in session ${sessionId}`);
        const fallbackCityMeta = CityConst.byID(cityNo, this.env?.scenario_id);
        this.destCity = {
          city: fallbackCityMeta?.city ?? cityNo,
          name: fallbackCityMeta?.name ?? `City_${cityNo}`,
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
      const fallbackCityMeta = CityConst.byID(cityNo, this.env?.scenario_id);
      this.destCity = {
        city: fallbackCityMeta?.city ?? cityNo,
        name: fallbackCityMeta?.name ?? `City_${cityNo}`,
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
    return BaseCommand.resolveNationId(this.generalObj);
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
   * 아이템 즉시 소비 시도
   *
   * - PHP의 BaseItem::tryConsumeNow() 패턴을 TS로 옮긴 구현
   * - GeneralAdapter + ItemAction을 사용해 슬롯별 아이템을 안전하게 소비
   * - 실제 DB 저장은 `saveGeneral()`에서 한 번에 처리되어 커맨드 단위로 원자성 보장
   *
   * @param itemSlot 아이템 슬롯 (item, weapon, book, horse 등)
   * @param actionType 액션 타입 (예: 'GeneralTrigger', '장비매매', 'GeneralCommand')
   * @param command 커맨드 이름 또는 트리거 이름
   * @returns true면 아이템이 소비되어 인벤토리에서 제거됨
   */
  protected async tryConsumeNow(
    itemSlot: string,
    actionType: string,
    command: string
  ): Promise<boolean> {
    try {
      const { GeneralAdapter } = await import('../../adapters/GeneralAdapter');
      const adapter = new GeneralAdapter(this.generalObj);

      // 장비 코드가 비어 있으면 아무 것도 하지 않음
      const item = adapter.getItem(itemSlot as any);
      if (!item || typeof item.tryConsumeNow !== 'function') {
        return false;
      }

      // 아이템 내부 로직에 위임 (치료/계략/소모품 등)
      const result = item.tryConsumeNow(this.generalObj, actionType, command);
      const shouldConsume =
        result instanceof Promise ? await result : Boolean(result);

      if (!shouldConsume) {
        return false;
      }

      // 실제 인벤토리 삭제는 General 헬퍼를 통해 수행
      // - Mongoose Document: GeneralSchema.methods.deleteItem()
      // - Plain Object: GeneralAdapter가 data[slot] = 'None'으로 처리
      if (typeof (this.generalObj as any).deleteItem === 'function') {
        (this.generalObj as any).deleteItem(itemSlot);
      } else {
        adapter.deleteItem(itemSlot as any);
      }

      // 커맨드 종료 시 saveGeneral() 한 번으로 DB 반영
      this.markGeneralDirty();
      return true;
    } catch (error) {
      console.error('tryConsumeNow 실패:', error);
      return false;
    }
  }

  /**
   * 장수 정보를 레포지토리를 통해 저장
   * generalObj.save() 대신 사용
   */
  protected async saveGeneral(): Promise<void> {
    const sessionId = this.env.session_id || this.generalObj.getSessionID?.();
    const generalNo = this.generalObj.getID?.() ?? this.generalObj.no ?? this.generalObj.data?.no;
 
    if (!sessionId || !generalNo) {
      console.warn('[BaseCommand.saveGeneral] 세션 또는 장수 번호를 확인할 수 없습니다. 저장 생략');
      return;
    }
 
    console.log(`[BaseCommand.saveGeneral] 장수 저장 시작: session=${sessionId}, no=${generalNo}`);
 
    // GeneralAdapter 여부 및 실제 raw 객체 분리
    const isAdapter = typeof (this.generalObj as any).getRaw === 'function';
    const rawGeneral: any = isAdapter
      ? (this.generalObj as any).getRaw()
      : this.generalObj;
 
    this.markDefaultDirtyEntities();
 
    // ✅ PHP와 동일한 검증: nation > 0이면 officer_level은 최소 1이어야 함
    const generalData = rawGeneral.data || rawGeneral;
    const nation = generalData.nation || 0;
    let officerLevel = generalData.officer_level;
 
    if (nation > 0 && (!officerLevel || officerLevel === 0)) {
      console.warn(`[BaseCommand.saveGeneral] ⚠️ 데이터 정합성 수정: nation=${nation}인데 officer_level=${officerLevel} → 1로 수정`);
      generalData.officer_level = 1;
      if (rawGeneral.data) {
        rawGeneral.data.officer_level = 1;
      }
    } else if (nation === 0 && officerLevel && officerLevel > 0) {
      console.warn(`[BaseCommand.saveGeneral] ⚠️ 데이터 정합성 수정: nation=0인데 officer_level=${officerLevel} → 0으로 수정`);
      generalData.officer_level = 0;
      if (rawGeneral.data) {
        rawGeneral.data.officer_level = 0;
      }
    }
 
    // Plain object로 직렬화 (Mongoose Document면 toObject 사용)
    const serialized = rawGeneral.toObject
      ? rawGeneral.toObject({ depopulate: true, flattenMaps: true, versionKey: false })
      : {
          ...rawGeneral,
          data: { ...(rawGeneral.data || {}) }
        };
 
    serialized.session_id = serialized.session_id || sessionId;
    serialized.no = serialized.no ?? serialized.data?.no ?? generalNo;
    if (!serialized.data) {
      serialized.data = { no: serialized.no ?? generalNo };
    } else if (serialized.data && serialized.data.no == null) {
      serialized.data.no = serialized.no ?? generalNo;
    }
 
    await cacheSaveGeneral(sessionId, generalNo, serialized);
 
    if (this.unitStacksDirty) {
      this.invalidateUnitStackCache();
      this.unitStacksDirty = false;
    }
 
    this.dirtyGenerals.clear();
    await this.flushDirtyCaches();
 
    console.log(`[BaseCommand.saveGeneral] 장수 저장 완료`);
  }

  /**
   * 도시 정보를 캐시 우선으로 업데이트 (CQRS 패턴)
   * L1 (메모리) → L2 (Redis) → sync-queue → DB
   * 
   * @param cityId 도시 ID
   * @param update 업데이트할 데이터
   */
  protected async updateCity(cityId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    if (!cityId) {
      console.warn('[BaseCommand.updateCity] cityId가 없습니다');
      return;
    }

    try {
      // 1. 로컬 city 객체 업데이트 (가장 최신 = 메모리)
      if (this.city && (this.city.city === cityId || this.city.data?.city === cityId)) {
        Object.assign(this.city, update);
        if (this.city.data) {
          Object.assign(this.city.data, update);
        }
      }
      
      // 2. 캐시에서 현재 데이터 가져와서 병합
      const currentCity = await cityRepository.findByCityNum(sessionId, cityId) as any;
      if (currentCity) {
        const mergedData = { ...currentCity, ...update };
        if (mergedData.data) {
          Object.assign(mergedData.data, update);
        }
        
        // 3. saveCity로 L1 → L2 → sync-queue 저장
        await cacheSaveCity(sessionId, cityId, mergedData);
      }
      
      this.markCityDirty(cityId);
      console.log(`[BaseCommand.updateCity] 도시 업데이트: city=${cityId}, fields=${Object.keys(update).join(',')}`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateCity] 도시 업데이트 실패: city=${cityId}`, error);
      throw error;
    }
  }

  /**
   * 국가 정보를 캐시 우선으로 업데이트 (CQRS 패턴)
   * L1 (메모리) → L2 (Redis) → sync-queue → DB
   * 
   * @param nationId 국가 ID
   * @param update 업데이트할 데이터
   */
  protected async updateNation(nationId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    if (!nationId) {
      console.warn('[BaseCommand.updateNation] nationId가 없습니다');
      return;
    }

    try {
      // 1. 로컬 nation 객체 업데이트 (가장 최신 = 메모리)
      if (this.nation && (this.nation.nation === nationId || this.nation.data?.nation === nationId)) {
        Object.assign(this.nation, update);
        if (this.nation.data) {
          Object.assign(this.nation.data, update);
        }
      }
      
      // 2. 캐시에서 현재 데이터 가져와서 병합
      const currentNation = await nationRepository.findByNationNum(sessionId, nationId);
      if (currentNation) {
        const mergedData = { ...currentNation, ...update };
        if (mergedData.data) {
          Object.assign(mergedData.data, update);
        }
        
        // 3. saveNation으로 L1 → L2 → sync-queue 저장
        await cacheSaveNation(sessionId, nationId, mergedData);
      }
      
      this.markNationDirty(nationId);
      console.log(`[BaseCommand.updateNation] 국가 업데이트: nation=${nationId}, fields=${Object.keys(update).join(',')}`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateNation] 국가 업데이트 실패: nation=${nationId}`, error);
      throw error;
    }
  }

  /**
   * 장수 정보를 레포지토리를 통해 업데이트 (다른 장수)
   * db.update('general', ...) 대신 사용
   * 
   * @param generalId 장수 ID
   * @param update 업데이트할 데이터
   */
  protected async updateGeneral(generalId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    if (!generalId) {
      console.warn('[BaseCommand.updateGeneral] generalId가 없습니다');
      return;
    }

    try {
      // data 필드와 최상위 필드 모두 업데이트
      const fullUpdate: Record<string, any> = { ...update };
      for (const [key, value] of Object.entries(update)) {
        if (!key.startsWith('data.')) {
          fullUpdate[`data.${key}`] = value;
        }
      }

      await cacheSaveGeneral(sessionId, generalId, fullUpdate);
      this.markGeneralDirty(generalId);
      
      console.log(`[BaseCommand.updateGeneral] 장수 업데이트: general=${generalId}, fields=${Object.keys(update).join(',')}`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateGeneral] 장수 업데이트 실패: general=${generalId}`, error);
      throw error;
    }
  }

  /**
   * 국가 필드 증가/감소 (CQRS 패턴)
   * L1 (메모리) → L2 (Redis) → sync-queue → DB
   * 
   * @param nationId 국가 ID
   * @param increments 증가할 필드들 { fieldName: amount }
   */
  protected async incrementNation(nationId: number, increments: Record<string, number>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    if (!nationId) {
      console.warn('[BaseCommand.incrementNation] nationId가 없습니다');
      return;
    }

    try {
      // 1. 로컬 nation 객체 증가 (가장 최신 = 메모리)
      if (this.nation && (this.nation.nation === nationId || this.nation.data?.nation === nationId)) {
        for (const [key, amount] of Object.entries(increments)) {
          if (this.nation[key] !== undefined) {
            this.nation[key] += amount;
          }
          if (this.nation.data?.[key] !== undefined) {
            this.nation.data[key] += amount;
          }
        }
      }
      
      // 2. 캐시에서 현재 데이터 가져와서 증가
      const currentNation = await nationRepository.findByNationNum(sessionId, nationId);
      if (currentNation) {
        for (const [key, amount] of Object.entries(increments)) {
          if (currentNation[key] !== undefined) {
            currentNation[key] += amount;
          }
          if (currentNation.data?.[key] !== undefined) {
            currentNation.data[key] += amount;
          }
        }
        
        // 3. saveNation으로 L1 → L2 → sync-queue 저장
        await cacheSaveNation(sessionId, nationId, currentNation);
      }
      
      this.markNationDirty(nationId);
      console.log(`[BaseCommand.incrementNation] 국가 필드 증가: nation=${nationId}, fields=${Object.keys(increments).join(',')}`);
    } catch (error: any) {
      console.error(`[BaseCommand.incrementNation] 국가 필드 증가 실패: nation=${nationId}`, error);
      throw error;
    }
  }

  /**
   * 도시 필드 증가/감소 (CQRS 패턴)
   * L1 (메모리) → L2 (Redis) → sync-queue → DB
   * 
   * @param cityId 도시 ID
   * @param increments 증가할 필드들 { fieldName: amount }
   */
  protected async incrementCity(cityId: number, increments: Record<string, number>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    if (!cityId) {
      console.warn('[BaseCommand.incrementCity] cityId가 없습니다');
      return;
    }

    try {
      // 1. 로컬 city 객체 증가 (가장 최신 = 메모리)
      if (this.city && (this.city.city === cityId || this.city.data?.city === cityId)) {
        for (const [key, amount] of Object.entries(increments)) {
          if (this.city[key] !== undefined) {
            this.city[key] += amount;
          }
          if (this.city.data?.[key] !== undefined) {
            this.city.data[key] += amount;
          }
        }
      }
      
      // 2. 캐시에서 현재 데이터 가져와서 증가
      const currentCity = await cityRepository.findByCityNum(sessionId, cityId) as any;
      if (currentCity) {
        for (const [key, amount] of Object.entries(increments)) {
          if (currentCity[key] !== undefined) {
            currentCity[key] += amount;
          }
          if (currentCity.data?.[key] !== undefined) {
            currentCity.data[key] += amount;
          }
        }
        
        // 3. saveCity로 L1 → L2 → sync-queue 저장
        await cacheSaveCity(sessionId, cityId, currentCity);
      }
      
      this.markCityDirty(cityId);
      console.log(`[BaseCommand.incrementCity] 도시 필드 증가: city=${cityId}, fields=${Object.keys(increments).join(',')}`);
    } catch (error: any) {
      console.error(`[BaseCommand.incrementCity] 도시 필드 증가 실패: city=${cityId}`, error);
      throw error;
    }
  }

  /**
   * 부대 정보를 캐시 우선으로 업데이트 (CQRS 패턴)
   */
  protected async updateTroop(troopId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    if (!troopId) return;

    try {
      const currentTroop = await troopRepository.findByTroopId(sessionId, troopId) as any;
      if (currentTroop) {
        const mergedData = { ...currentTroop, ...update };
        if (mergedData.data) Object.assign(mergedData.data, update);
        await cacheSaveTroop(sessionId, troopId, mergedData);
      }
      console.log(`[BaseCommand.updateTroop] 부대 업데이트: troop=${troopId}`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateTroop] 부대 업데이트 실패: troop=${troopId}`, error);
      throw error;
    }
  }

  /**
   * 외교 정보를 캐시 우선으로 업데이트 (CQRS 패턴)
   */
  protected async updateDiplomacy(nationA: number, nationB: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const diplomacyId = `${Math.min(nationA, nationB)}_${Math.max(nationA, nationB)}`;

    try {
      const currentDiplomacy = await diplomacyRepository.findByNations(sessionId, nationA, nationB) as any;
      if (currentDiplomacy) {
        const mergedData = { ...currentDiplomacy, ...update };
        if (mergedData.data) Object.assign(mergedData.data, update);
        await cacheSaveDiplomacy(sessionId, diplomacyId, mergedData);
      }
      console.log(`[BaseCommand.updateDiplomacy] 외교 업데이트: ${nationA} <-> ${nationB}`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateDiplomacy] 외교 업데이트 실패`, error);
      throw error;
    }
  }

  /**
   * 다른 장수들의 도시를 일괄 업데이트 (CQRS 패턴)
   */
  protected async updateGeneralsByFilter(
    filter: { nationId?: number; cityId?: number; troopId?: number },
    update: Record<string, any>
  ): Promise<number[]> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const updatedGenerals: number[] = [];

    try {
      let generals: any[] = [];
      
      if (filter.nationId !== undefined && filter.cityId !== undefined) {
        generals = await generalRepository.findByCityAndNation(sessionId, filter.cityId, filter.nationId);
      } else if (filter.nationId !== undefined) {
        generals = await generalRepository.findByNation(sessionId, filter.nationId);
      } else if (filter.cityId !== undefined) {
        generals = await generalRepository.findByCity(sessionId, filter.cityId);
      } else if (filter.troopId !== undefined) {
        generals = await generalRepository.findTroopMembers(sessionId, filter.nationId || 0, filter.troopId, -1);
      }

      for (const general of generals) {
        const generalNo = general.no ?? general.data?.no;
        if (generalNo) {
          const mergedData = { ...general, ...update };
          if (mergedData.data) Object.assign(mergedData.data, update);
          await cacheSaveGeneral(sessionId, generalNo, mergedData);
          updatedGenerals.push(generalNo);
          this.markGeneralDirty(generalNo);
        }
      }

      console.log(`[BaseCommand.updateGeneralsByFilter] ${updatedGenerals.length}명 업데이트`);
      return updatedGenerals;
    } catch (error: any) {
      console.error(`[BaseCommand.updateGeneralsByFilter] 실패`, error);
      throw error;
    }
  }

  /**
   * 도시들을 일괄 업데이트 (CQRS 패턴)
   */
  protected async updateCitiesByFilter(
    filter: { nationId?: number; cityIds?: number[] },
    update: Record<string, any>
  ): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';

    try {
      let cities: any[] = [];
      
      if (filter.cityIds && filter.cityIds.length > 0) {
        for (const cityId of filter.cityIds) {
          const city = await cityRepository.findByCityNum(sessionId, cityId);
          if (city) cities.push(city);
        }
      } else if (filter.nationId !== undefined) {
        cities = await cityRepository.findByNation(sessionId, filter.nationId);
      }

      for (const city of cities) {
        const cityId = (city as any).city ?? (city as any).data?.city;
        if (cityId) {
          const mergedData = { ...city, ...update };
          if ((mergedData as any).data) Object.assign((mergedData as any).data, update);
          await cacheSaveCity(sessionId, cityId, mergedData);
          this.markCityDirty(cityId);
        }
      }

      console.log(`[BaseCommand.updateCitiesByFilter] ${cities.length}개 도시 업데이트`);
    } catch (error: any) {
      console.error(`[BaseCommand.updateCitiesByFilter] 실패`, error);
      throw error;
    }
  }

  /**
   * 장수 명령 저장 (CQRS 패턴)
   */
  protected async saveCommandSlot(generalId: number, turnIdx: number, commandData: any): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    await cacheSaveCommand(sessionId, generalId, turnIdx, commandData);
  }
}
