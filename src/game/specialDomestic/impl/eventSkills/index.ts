/**
 * 이벤트 특기 모듈 인덱스
 * 이벤트로 획득하는 내정 특기들을 모아서 export
 */

// 복잡한 이벤트 특기 (개별 파일)
export { CheEventGyuknoSpecialDomestic } from './CheEventGyuknoSpecialDomestic';
export { CheEventMusangSpecialDomestic } from './CheEventMusangSpecialDomestic';
export { CheEventBangyeSpecialDomestic } from './CheEventBangyeSpecialDomestic';
export { CheEventPilsalSpecialDomestic } from './CheEventPilsalSpecialDomestic';

// 간단한 이벤트 특기 (bulk)
export {
  CheEventWiapSpecialDomestic,
  CheEventDolgyeokSpecialDomestic,
  CheEventGyeongoSpecialDomestic,
  CheEventSinjungSpecialDomestic,
  CheEventSinsanSpecialDomestic,
  CheEventHwansulSpecialDomestic,
  CheEventChuksaSpecialDomestic,
  CheEventJipjungSpecialDomestic,
  CheEventJeogyeokSpecialDomestic,
  CheEventUisulSpecialDomestic,
  CheEventJingbyeongSpecialDomestic,
} from './simpleEventSkills';

// 병종 이벤트 특기
export {
  CheEventBobyeongSpecialDomestic,
  CheEventGibyeongSpecialDomestic,
  CheEventGungbyeongSpecialDomestic,
  CheEventGwibyeongSpecialDomestic,
  CheEventGongseongSpecialDomestic,
} from './armTypeEventSkills';

// 모든 이벤트 특기 클래스 목록
import { CheEventGyuknoSpecialDomestic } from './CheEventGyuknoSpecialDomestic';
import { CheEventMusangSpecialDomestic } from './CheEventMusangSpecialDomestic';
import { CheEventBangyeSpecialDomestic } from './CheEventBangyeSpecialDomestic';
import { CheEventPilsalSpecialDomestic } from './CheEventPilsalSpecialDomestic';
import {
  CheEventWiapSpecialDomestic,
  CheEventDolgyeokSpecialDomestic,
  CheEventGyeongoSpecialDomestic,
  CheEventSinjungSpecialDomestic,
  CheEventSinsanSpecialDomestic,
  CheEventHwansulSpecialDomestic,
  CheEventChuksaSpecialDomestic,
  CheEventJipjungSpecialDomestic,
  CheEventJeogyeokSpecialDomestic,
  CheEventUisulSpecialDomestic,
  CheEventJingbyeongSpecialDomestic,
} from './simpleEventSkills';
import {
  CheEventBobyeongSpecialDomestic,
  CheEventGibyeongSpecialDomestic,
  CheEventGungbyeongSpecialDomestic,
  CheEventGwibyeongSpecialDomestic,
  CheEventGongseongSpecialDomestic,
} from './armTypeEventSkills';

export const ALL_EVENT_SKILL_CLASSES = [
  // 복잡한 이벤트 특기
  CheEventGyuknoSpecialDomestic,
  CheEventMusangSpecialDomestic,
  CheEventBangyeSpecialDomestic,
  CheEventPilsalSpecialDomestic,
  // 간단한 이벤트 특기
  CheEventWiapSpecialDomestic,
  CheEventDolgyeokSpecialDomestic,
  CheEventGyeongoSpecialDomestic,
  CheEventSinjungSpecialDomestic,
  CheEventSinsanSpecialDomestic,
  CheEventHwansulSpecialDomestic,
  CheEventChuksaSpecialDomestic,
  CheEventJipjungSpecialDomestic,
  CheEventJeogyeokSpecialDomestic,
  CheEventUisulSpecialDomestic,
  CheEventJingbyeongSpecialDomestic,
  // 병종 이벤트 특기
  CheEventBobyeongSpecialDomestic,
  CheEventGibyeongSpecialDomestic,
  CheEventGungbyeongSpecialDomestic,
  CheEventGwibyeongSpecialDomestic,
  CheEventGongseongSpecialDomestic,
] as const;
