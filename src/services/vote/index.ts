/**
 * 투표/정치 시스템 Export
 * Agent I: 정치/투표 시스템
 */

// 기존 서비스들
export { VoteService } from './Vote.service';
export { NewVoteService } from './NewVote.service';
export { GetVoteListService } from './GetVoteList.service';
export { GetVoteDetailService } from './GetVoteDetail.service';
export { AddCommentService } from './AddComment.service';
export { OpenVoteService } from './OpenVote.service';

// 새로 구현된 서비스들
export { VoteSystemService } from './VoteSystem.service';
export { OfficerSystemService } from './OfficerSystem.service';
export { ImpeachmentService } from './Impeachment.service';

// 타입 re-export
export {
  // Enums
  VoteType,
  VoteStatus,
  OfficerLevel,
  
  // 유틸리티 함수
  getNationChiefLevel,
  doOfficerSet,
  isOfficerSet,
  clearOfficerSet,
  checkOfficerStatRequirement,
  getOfficerTitle,
  calcLeadershipBonus,
  
  // 상수
  CHIEF_STAT_MIN,
  NATION_CHIEF_LEVEL_MAP,
  OFFICER_TITLE_MAP,
  
  // 타입/인터페이스
  type VoteInfo,
  type VoteMetadata,
  type VoteRecord,
  type VoteResult,
  type VoteOptionResult,
  type CandidateInfo,
  type PolicyChangeInfo,
  type DiplomacyVoteInfo,
  type ImpeachmentRequest,
  type ImpeachmentVote,
  type OfficerAppointment,
  type OfficerDismissal,
  type OfficerInfo,
  type OfficerBonus
} from '../../types/vote.types';


