/**
 * NationCommand - PHP sammo\Command\NationCommand 직접 변환
 * 
 * 국가 커맨드의 기본 클래스
 */

import { BaseCommand, LastTurn } from './BaseCommand';

export abstract class NationCommand extends BaseCommand {
  protected lastTurn: LastTurn;
  protected resultTurn: LastTurn;

  constructor(generalObj: any, env: any, lastTurn: LastTurn, arg: any = null) {
    // NationCommand는 lastTurn을 받아서 처리
    // super 호출 전에 설정
    const tempLastTurn = lastTurn;
    const tempResultTurn = lastTurn.duplicate();
    
    super(generalObj, env, arg);
    
    this.lastTurn = tempLastTurn;
    this.resultTurn = tempResultTurn;
  }

  public getLastTurn(): LastTurn {
    return this.lastTurn;
  }

  public setResultTurn(lastTurn: LastTurn): void {
    this.resultTurn = lastTurn;
  }

  public getResultTurn(): LastTurn {
    return this.resultTurn;
  }

  public getNextExecuteKey(): string {
    const constructor = this.constructor as typeof BaseCommand;
    const turnKey = constructor.getName();
    const executeKey = `next_execute_${turnKey}`;
    return executeKey;
  }

  public async getNextAvailableTurn(): Promise<number | null> {
    const constructor = this.constructor as typeof BaseCommand;
    if (this.isArgValid && !this.getPostReqTurn()) {
      return null;
    }
    
    // KVStorage 대신 nation.aux에 저장
    try {
      const key = this.getNextExecuteKey();
      const value = this.nation?.aux?._next_execute?.[key];
      return value || null;
    } catch (error) {
      return null;
    }
  }

  public async setNextAvailable(yearMonth: number | null = null): Promise<void> {
    if (!this.getPostReqTurn()) {
      return;
    }
    
    if (yearMonth === null) {
      yearMonth = this.joinYearMonth(this.env.year, this.env.month) 
        + this.getPostReqTurn() - this.getPreReqTurn();
    }
    
    // KVStorage 대신 nation.aux에 저장
    try {
      const { nationRepository } = await import('../../repositories/nation.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const nationID = this.generalObj.getNationID();
      const key = this.getNextExecuteKey();
      
      if (!this.nation.aux) {
        this.nation.aux = {};
      }
      if (!this.nation.aux._next_execute) {
        this.nation.aux._next_execute = {};
      }
      this.nation.aux._next_execute[key] = yearMonth;
      
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, 'data.nation': nationID },
        { aux: this.nation.aux }
      );
    } catch (error) {
      console.error('setNextAvailable 실패:', error);
    }
  }
}
