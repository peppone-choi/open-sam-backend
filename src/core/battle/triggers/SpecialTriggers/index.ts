/**
 * SpecialTriggers - 특수/이벤트 트리거 모음
 * 
 * 특수 트리거:
 * - 격노 (시도, 발동, 회피시)
 * - 전투치료 (시도, 발동)
 * - 페이즈조정 (전멸시, 기병, 보병)
 * - 스킬활성화 (기본, 상대비활성화, 아이템)
 * - 능력치/전투력 보정
 * - 이벤트 (충차, 화살, 식량, 사기)
 */

export * from './RageTrigger';
export * from './HealTrigger';
export * from './PhaseAdjustTrigger';
export * from './SkillActivateTrigger';
export * from './StatModifierTrigger';
export * from './EventTrigger';

import { rageTriggers } from './RageTrigger';
import { healTriggers } from './HealTrigger';
import { phaseAdjustTriggers } from './PhaseAdjustTrigger';
import { skillActivateTriggers } from './SkillActivateTrigger';
import { statModifierTriggers } from './StatModifierTrigger';
import { eventTriggers } from './EventTrigger';
import { ITrigger } from '../TriggerManager';

/**
 * 모든 특수 트리거
 */
export const allSpecialTriggers: ITrigger[] = [
  ...rageTriggers,
  ...healTriggers,
  ...phaseAdjustTriggers,
  ...skillActivateTriggers,
  ...statModifierTriggers,
  ...eventTriggers,
];
