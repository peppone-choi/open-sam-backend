/**
 * 외교 서비스 모듈
 * 
 * 외교 상태 관리, 제안/수락, 메시지, 효과 처리를 담당
 */

// 외교 상태 관리
export {
  DiplomacyStateService,
  DiplomacyState,
  DiplomacyStateName,
  DiplomacyTransitions,
  type DiplomacyRelation,
  type TransitionResult
} from './DiplomacyState.service';

// 외교 제안/수락
export {
  DiplomacyProposalService,
  DiplomacyProposalType,
  DiplomacyProposalTypeName,
  ProposalStatus,
  type ProposalData,
  type ProposalResult,
  type AcceptResult
} from './DiplomacyProposal.service';

// 외교 메시지/알림
export {
  DiplomacyMessageService,
  DiplomacyMessageType,
  type DiplomacyMessageData,
  type NotificationResult
} from './DiplomacyMessage.service';

// 외교 효과
export {
  DiplomacyEffectService,
  DiplomacyEffectConfig,
  type CombatModifier,
  type MovementPermission
} from './DiplomacyEffect.service';

// 외교 관계 업데이트 (기존)
export { UpdateRelationService } from './UpdateRelation.service';

// 외교 서신 (기존)
export { DiplomacyLetterService } from './DiplomacyLetter.service';

// 외교 처리 (기존)
export { ProcessDiplomacyService } from './ProcessDiplomacy.service';
