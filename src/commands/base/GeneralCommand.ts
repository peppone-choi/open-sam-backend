/**
 * GeneralCommand - PHP sammo\Command\GeneralCommand 직접 변환
 * 
 * 장수 커맨드의 기본 클래스
 */

import { BaseCommand } from './BaseCommand';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

export abstract class GeneralCommand extends BaseCommand {
  
  /**
   * 커맨드 실행 후 공통 처리 훅
   * 
   * 모든 장수 커맨드에서 반복되는 로직을 한 곳에서 처리:
   * 1. StaticEventHandler 호출
   * 2. 유니크 아이템 추첨
   * 3. 유산 포인트 적립 (해당되는 경우)
   * 
   * @param rng 난수 생성기
   * @param options 추가 옵션
   */
  protected async postRunHooks(
    rng: any,
    options: {
      skipEventHandler?: boolean;
      skipItemLottery?: boolean;
      skipInheritancePoint?: boolean;
      inheritanceKey?: string;
      inheritanceAmount?: number;
    } = {}
  ): Promise<void> {
    const general = this.generalObj;
    const sessionId = this.env?.session_id || general.getSessionID?.() || 'sangokushi_default';
    const actionName = (this.constructor as typeof GeneralCommand).actionName || (this.constructor as typeof GeneralCommand).getName();

    // 1. StaticEventHandler 처리
    if (!options.skipEventHandler) {
      try {
        const { StaticEventHandler } = await import('../../events/StaticEventHandler');
        await StaticEventHandler.handleEvent(
          general,
          this.destGeneralObj || null,
          this,
          this.env,
          this.arg
        );
      } catch (error) {
        console.warn('[GeneralCommand.postRunHooks] StaticEventHandler 실패:', error);
      }
    }

    // 2. 유니크 아이템 추첨
    if (!options.skipItemLottery) {
      try {
        const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
        await tryUniqueItemLottery(rng, general, sessionId, actionName);
      } catch (error) {
        console.warn('[GeneralCommand.postRunHooks] tryUniqueItemLottery 실패:', error);
      }
    }

    // 3. 유산 포인트 적립
    if (!options.skipInheritancePoint) {
      await this.increaseInheritancePointIfNeeded(
        options.inheritanceKey || 'active_action',
        options.inheritanceAmount || 1
      );
    }
  }

  /**
   * 유산 포인트 적립 헬퍼
   * 
   * @param key 포인트 키 (예: 'active_action', 'battle_win', 등)
   * @param amount 적립량
   */
  protected async increaseInheritancePointIfNeeded(
    key: string = 'active_action',
    amount: number = 1
  ): Promise<void> {
    const general = this.generalObj;
    
    if (typeof general.increaseInheritancePoint === 'function') {
      try {
        await general.increaseInheritancePoint(key, amount);
      } catch (error) {
        console.warn('[GeneralCommand] increaseInheritancePoint 실패:', error);
      }
    } else {
      // general.increaseInheritancePoint가 없으면 InheritancePointService 직접 호출
      try {
        const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
        const sessionId = this.env?.session_id || general.getSessionID?.() || 'sangokushi_default';
        const owner = general.data?.owner || general.owner || 0;
        
        if (owner && owner > 0) {
          const service = new InheritancePointService(sessionId);
          // key를 InheritanceKey enum으로 변환
          const inheritanceKey = key === 'active_action' ? InheritanceKey.ACTIVE_ACTION :
                                  key === 'combat' ? InheritanceKey.COMBAT :
                                  key === 'sabotage' ? InheritanceKey.SABOTAGE :
                                  InheritanceKey.ACTIVE_ACTION;
          await service.recordActivity(owner, inheritanceKey, amount);
        }
      } catch (error) {
        // InheritancePointService가 없거나 실패해도 무시
        // console.warn('[GeneralCommand] InheritancePointService 호출 실패:', error);
      }
    }
  }
  
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

