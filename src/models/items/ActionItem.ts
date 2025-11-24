/**
 * ActionItem - PHP sammo\ActionItem 기본 구조
 * 
 * BaseItem을 상속하는 구체적인 아이템 베이스 클래스
 * 참고: core/hwe/sammo/ActionItem/ 디렉토리의 아이템들
 */

import { BaseItem } from '../item.model';

/**
 * ActionItem 클래스
 * 실제 사용 가능한 아이템들의 기본 클래스
 */
export abstract class ActionItem extends BaseItem {
  // ActionItem에서 공통으로 사용할 메서드들은 여기에 추가
}
