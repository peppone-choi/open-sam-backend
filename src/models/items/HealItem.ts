/**
 * Heal items – trimmed Session 5 representatives.
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';
import type { RandUtil } from '../../utils/RandUtil';

/**
 * che_치료_환약 – multi‑charge heal item.
 *
 * - On purchase: sets remain count to 3.
 * - On each GeneralTrigger/che_아이템치료: decrements, and on last use
 *   returns true so the caller can delete the item from inventory.
 */
export class che_치료_환약 extends ActionItem {
  protected rawName = '환약';
  protected name = '환약(치료)';
  protected info = '[군사] 턴 실행 전 부상 회복. 3회용';
  protected cost = 200;
  protected consumable = true;
  protected buyable = true;
  protected reqSecu = 0;

  static readonly REMAIN_KEY = 'remain환약';

  onArbitraryAction(
    general: IGeneral,
    _rng: RandUtil,
    actionType: string,
    phase: string | null = null,
    aux: any = null
  ): any {
    if (actionType !== '장비매매' || phase !== '구매') {
      return aux;
    }
    this.setAuxVar(general, che_치료_환약.REMAIN_KEY, 3);
    return aux;
  }

  tryConsumeNow(general: IGeneral, actionType: string, command: string): boolean {
    if (actionType !== 'GeneralTrigger' || command !== 'che_아이템치료') {
      return false;
    }

    const remain = (this.getAuxVar(general, che_치료_환약.REMAIN_KEY) ?? 1) as number;
    if (remain > 1) {
      this.setAuxVar(general, che_치료_환약.REMAIN_KEY, remain - 1);
      return false;
    }

    // 마지막 사용: aux 정리 후 인벤토리에서 제거되도록 true 반환
    this.setAuxVar(general, che_치료_환약.REMAIN_KEY, null);
    return true;
  }
}

/**
 * che_치료_정력견혈 – 치료 성공률/회복량 보정용 단순 버프.
 */
export class che_치료_정력견혈 extends ActionItem {
  protected rawName = '정력견혈산';
  protected name = '정력견혈산(치료)';
  protected info = '[군사] 부상 회복률 +50%p';
  protected cost = 200;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' && varType === 'recovery_rate') {
      return value + 0.5;
    }
    return value;
  }
}
