/**
 * GeneralCommand - PHP sammo\Command\GeneralCommand 직접 변환
 * 
 * 장수 커맨드의 기본 클래스
 */

import { BaseCommand } from './BaseCommand';
import { DB } from '../../config/db';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

export abstract class GeneralCommand extends BaseCommand {
  
  public getNextExecuteKey(): string {
    const constructor = this.constructor as typeof BaseCommand;

    const turnKey = constructor.getName();
    const generalID = this.getGeneral().getID();
    const executeKey = `next_execute_${generalID}_${turnKey}`;
    return executeKey;
  }

  public async getNextAvailableTurn(): Promise<number | null> {
    const constructor = this.constructor as typeof BaseCommand;
    if (this.isArgValid && !this.getPostReqTurn()) {
      return null;
    }
    
    // KVStorage 대신 general.data에 저장
    try {
      const key = this.getNextExecuteKey();
      const value = this.generalObj?.data?._next_execute?.[key];
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
    
    // KVStorage 대신 general.data에 저장
    try {
      const key = this.getNextExecuteKey();
      if (!this.generalObj.data._next_execute) {
        this.generalObj.data._next_execute = {};
      }
      this.generalObj.data._next_execute[key] = yearMonth;
      this.generalObj.markModified('data');
    } catch (error) {
      console.error('setNextAvailable 실패:', error);
    }
  }

  protected async syncGeneralUnitStackCity(cityId: number | null): Promise<void> {
    const general = this.generalObj;
    if (!general) return;
    const sessionId = general.getSessionID?.() ?? this.env?.session_id;
    const generalNo = general.getID?.() ?? general.no ?? general.data?.no;
    if (!sessionId || !generalNo) {
      return;
    }
    try {
      await unitStackRepository.updateOwnerCity(sessionId, 'general', generalNo, cityId);
    } catch (error) {
      console.error('syncGeneralUnitStackCity 실패:', error);
    }
  }

  protected async updateGeneralCity(cityId: number): Promise<void> {
    const general = this.generalObj;
    if (!general) return;
    general.data.city = cityId;
    await this.syncGeneralUnitStackCity(cityId);
  }

  protected async updateOtherGeneralsCity(generalIds: Array<number | string>, cityId: number): Promise<void> {
    if (!generalIds || generalIds.length === 0) return;
    const sessionId = this.env?.session_id || this.generalObj?.getSessionID?.();
    if (!sessionId) return;
    const normalized = generalIds
      .map((id) => typeof id === 'number' ? id : Number(id))
      .filter((id) => Number.isFinite(id));
    if (!normalized.length) return;
    try {
      await unitStackRepository.updateOwnersCity(sessionId, normalized, cityId);
    } catch (error) {
      console.error('updateOtherGeneralsCity 실패:', error);
    }
  }
}

