/**
 * Betting Services
 * 
 * 베팅 시스템 서비스 Export
 */

// 기존 서비스
export { BetService } from './Bet.service';
export { GetBettingListService } from './GetBettingList.service';
export { GetBettingDetailService } from './GetBettingDetail.service';
export { SettleBettingService } from './SettleBetting.service';

// 통합 베팅 시스템 서비스
export {
  BettingSystemService,
  BettingSystemAPI,
  BettingType,
  BettingStatus,
  BettingInfo,
  BettingResult,
  BettingReward,
} from './BettingSystem.service';


