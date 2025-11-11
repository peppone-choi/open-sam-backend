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
        env.session_id || generalObj.getSessionID(),
        true // autoFlush
      );
    } else {
      // fallback: General의 간단한 로거 사용
      this.logger = generalObj.getLogger?.() || null;
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
      return;
    }
    
    const { cityRepository } = require('../../repositories/city.repository');
    const cityId = this.generalObj.getVar('city');
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
        this.city = cityDoc.data || cityDoc.toObject?.() || cityDoc;
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

  protected async setDestCity(cityNo: number, onlyName: boolean = false): Promise<void> {
    this.resetTestCache();
    
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      
      const cityDoc = await cityRepository.findOneByFilter({
        session_id: sessionId,
        city: cityNo
      });
      
      if (cityDoc && cityDoc.data) {
        this.destCity = cityDoc.data;
      } else {
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
    } catch (error) {
      console.error('setDestCity 실패:', error);
      this.destCity = null;
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
    const constructor = this.constructor as typeof BaseCommand;
    if (constructor.reqArg) {
      throw new Error('NotInheritedMethodException');
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
    return this.generalObj.getVar('officer_level');
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

    // Constraint testing 구현
    for (const constraint of this.permissionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(this.generalObj?.data || {}, this.env);
        if (!result) {
          this.reasonNoPermissionToReserve = constraint.reason || constraint.message || '권한이 없습니다';
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

    // Constraint testing 구현
    for (const constraint of this.minConditionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(this.generalObj?.data || {}, this.env);
        if (!result) {
          this.reasonNotMinConditionMet = constraint.reason || constraint.message || '조건을 만족하지 않습니다';
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

    // Constraint testing 구현
    for (const constraint of this.fullConditionConstraints) {
      if (constraint && typeof constraint.test === 'function') {
        const result = constraint.test(this.generalObj?.data || {}, this.env);
        if (!result) {
          this.reasonNotFullConditionMet = constraint.reason || constraint.message || '조건을 만족하지 않습니다';
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
    
    // generalObj가 Mongoose 문서인 경우
    if (this.generalObj.save && typeof this.generalObj.save === 'function') {
      await this.generalObj.save();
    } else {
      // 일반 객체인 경우 레포지토리 사용
      const updateData = this.generalObj.data || this.generalObj.toObject?.() || this.generalObj;
      await generalRepository.updateBySessionAndNo(sessionId, generalNo, updateData);
    }
  }
}
