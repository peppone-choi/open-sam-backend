/**
 * BaseStatItem - PHP sammo\BaseStatItem 직접 변환
 * 
 * 능력치 증가 아이템의 기본 클래스 (명마, 무기, 서적)
 * 참고: core/hwe/sammo/BaseStatItem.php
 */

import { BaseItem } from '../item.model';
import type { IGeneral } from '../general.model';

/**
 * 아이템 타입별 능력치 매핑
 */
const ITEM_TYPE_MAP: Record<string, [string, string]> = {
  '명마': ['통솔', 'leadership'],
  '무기': ['무력', 'strength'],
  '서적': ['지력', 'intel']
};

/**
 * BaseStatItem 추상 클래스
 * 능력치를 증가시키는 아이템들의 기본 클래스
 */
export abstract class BaseStatItem extends BaseItem {
  protected statNick: string = '통솔';
  protected statType: string = 'leadership';
  protected statValue: number = 1;

  constructor() {
    super();
    
    // 클래스명 파싱: che_명마_01_노기 형태
    const className = this.constructor.name;
    const nameTokens = className.split('_');
    const tokenLen = nameTokens.length;
    
    if (tokenLen >= 3) {
      // 마지막에서 2번째: 능력치 수치
      this.statValue = parseInt(nameTokens[tokenLen - 2]) || 1;
      
      // 마지막: 아이템 이름
      this.rawName = nameTokens[tokenLen - 1];
      
      // 마지막에서 3번째: 아이템 타입 (명마, 무기, 서적)
      const itemType = nameTokens[tokenLen - 3];
      const mapping = ITEM_TYPE_MAP[itemType];
      if (mapping) {
        [this.statNick, this.statType] = mapping;
      }
      
      this.name = `${this.rawName}(+${this.statValue})`;
      this.info = `${this.statNick} +${this.statValue}`;
    }
  }

  /**
   * 능력치 계산 시 수치 증가
   */
  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === this.statType) {
      return value + this.statValue;
    }
    return value;
  }
}
