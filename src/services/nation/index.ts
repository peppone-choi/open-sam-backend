/**
 * Nation Services Index
 * 국가 관련 서비스 모듈 export
 */

// 국력/순위 서비스
export { 
  NationStatsService,
  POWER_WEIGHTS,
  type NationStats,
} from './NationStats.service';

// 관직 시스템 서비스
export {
  OfficerSystemService,
  OfficerLevel,
  Permission,
  OFFICER_PERMISSIONS,
  CHIEF_SLOTS_BY_LEVEL,
} from './OfficerSystem.service';

// 기존 서비스들
export { GeneralListService } from './GeneralList.service';
export { GetGeneralLogService } from './GetGeneralLog.service';
export { GetNationInfoService } from './GetNationInfo.service';
export { GetNationStratFinanService } from './GetNationStratFinan.service';
export { GrantPowerService } from './GrantPower.service';
export { JoinNationService } from './JoinNation.service';
export { KickGeneralService } from './KickGeneral.service';
export { ModifyDiplomacyService } from './ModifyDiplomacy.service';
export { NationFinanceService } from './NationFinance.service';
export { SetBillService } from './SetBill.service';
export { SetBlockScoutService } from './SetBlockScout.service';
export { SetBlockWarService } from './SetBlockWar.service';
export { SetChiefAttrService } from './SetChiefAttr.service';
export { SetNationAttrService } from './SetNationAttr.service';
export { SetNoticeService } from './SetNotice.service';
export { SetRateService } from './SetRate.service';
export { SetScoutMsgService } from './SetScoutMsg.service';
export { SetSecretLimitService } from './SetSecretLimit.service';
export { SetTroopNameService } from './SetTroopName.service';
export { TransferNationOwnerService } from './TransferNationOwner.service';
export { WithdrawNationService } from './WithdrawNation.service';


