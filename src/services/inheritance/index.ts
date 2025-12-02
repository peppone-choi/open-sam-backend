/**
 * Inheritance Services
 * 
 * 상속/유산 시스템 서비스 Export
 */

// 상속 포인트 서비스
export {
  InheritancePointService,
  InheritancePointAPI,
  InheritanceKey,
  InheritancePointDetail,
  UsePointResult,
} from './InheritancePoint.service';

// 상속 보상 서비스
export {
  InheritanceRewardService,
  InheritanceRewardAPI,
  InheritBuffType,
  BUFF_TYPE_NAMES,
  MAX_BUFF_LEVEL,
  InheritBuffStatus,
  ApplyRewardResult,
  StatBonusResult,
} from './InheritanceReward.service';


