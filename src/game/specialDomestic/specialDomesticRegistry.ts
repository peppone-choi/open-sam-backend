/**
 * 내정 특기 레지스트리
 * PHP 대응: func_converter.php buildGeneralSpecialDomesticClass()
 */

import { BaseSpecialDomestic } from './BaseSpecialDomestic';
import { NoneSpecialDomestic } from './impl/NoneSpecialDomestic';
import { CheGeosangSpecialDomestic } from './impl/CheGeosangSpecialDomestic';
import { CheGyeongjakSpecialDomestic } from './impl/CheGyeongjakSpecialDomestic';
import { CheGwimoSpecialDomestic } from './impl/CheGwimoSpecialDomestic';
import { CheIndeokSpecialDomestic } from './impl/CheIndeokSpecialDomestic';
import { CheSubiSpecialDomestic } from './impl/CheSubiSpecialDomestic';
import { CheChukseongSpecialDomestic } from './impl/CheChukseongSpecialDomestic';
import { CheTongchalSpecialDomestic } from './impl/CheTongchalSpecialDomestic';
import { CheBalMyeongSpecialDomestic } from './impl/CheBalMyeongSpecialDomestic';
import { CheSangjaeSpecialDomestic } from './impl/CheSangjaeSpecialDomestic';

// 이벤트 특기 import
import {
  CheEventGyuknoSpecialDomestic,
  CheEventMusangSpecialDomestic,
  CheEventBangyeSpecialDomestic,
  CheEventPilsalSpecialDomestic,
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
  CheEventBobyeongSpecialDomestic,
  CheEventGibyeongSpecialDomestic,
  CheEventGungbyeongSpecialDomestic,
  CheEventGwibyeongSpecialDomestic,
  CheEventGongseongSpecialDomestic,
} from './impl/eventSkills';

const registry: Record<string, () => BaseSpecialDomestic> = {
  None: () => new NoneSpecialDomestic(),
  // 기본 내정 특기
  'che_거상': () => new CheGeosangSpecialDomestic(),
  'che_경작': () => new CheGyeongjakSpecialDomestic(),
  'che_귀모': () => new CheGwimoSpecialDomestic(),
  'che_인덕': () => new CheIndeokSpecialDomestic(),
  'che_수비': () => new CheSubiSpecialDomestic(),
  'che_축성': () => new CheChukseongSpecialDomestic(),
  'che_통찰': () => new CheTongchalSpecialDomestic(),
  'che_발명': () => new CheBalMyeongSpecialDomestic(),
  'che_상재': () => new CheSangjaeSpecialDomestic(),
  // 이벤트 특기 - 복잡한 특기
  'che_event_격노': () => new CheEventGyuknoSpecialDomestic(),
  'che_event_무쌍': () => new CheEventMusangSpecialDomestic(),
  'che_event_반계': () => new CheEventBangyeSpecialDomestic(),
  'che_event_필살': () => new CheEventPilsalSpecialDomestic(),
  // 이벤트 특기 - 간단한 특기
  'che_event_위압': () => new CheEventWiapSpecialDomestic(),
  'che_event_돌격': () => new CheEventDolgyeokSpecialDomestic(),
  'che_event_견고': () => new CheEventGyeongoSpecialDomestic(),
  'che_event_신중': () => new CheEventSinjungSpecialDomestic(),
  'che_event_신산': () => new CheEventSinsanSpecialDomestic(),
  'che_event_환술': () => new CheEventHwansulSpecialDomestic(),
  'che_event_척사': () => new CheEventChuksaSpecialDomestic(),
  'che_event_집중': () => new CheEventJipjungSpecialDomestic(),
  'che_event_저격': () => new CheEventJeogyeokSpecialDomestic(),
  'che_event_의술': () => new CheEventUisulSpecialDomestic(),
  'che_event_징병': () => new CheEventJingbyeongSpecialDomestic(),
  // 이벤트 특기 - 병종 특기
  'che_event_보병': () => new CheEventBobyeongSpecialDomestic(),
  'che_event_기병': () => new CheEventGibyeongSpecialDomestic(),
  'che_event_궁병': () => new CheEventGungbyeongSpecialDomestic(),
  'che_event_귀병': () => new CheEventGwibyeongSpecialDomestic(),
  'che_event_공성': () => new CheEventGongseongSpecialDomestic(),
};

const cache = new Map<string, BaseSpecialDomestic>();

/**
 * 내정 특기 Action 조회
 * @param key 특기 키 (예: 'che_거상', 'None')
 * @returns BaseSpecialDomestic 인스턴스
 */
export function getSpecialDomesticAction(key?: string | null): BaseSpecialDomestic {
  const normalized = key && registry[key] ? key : 'None';
  if (!cache.has(normalized)) {
    cache.set(normalized, registry[normalized]());
  }
  return cache.get(normalized)!;
}

/**
 * 등록된 모든 내정 특기 목록 조회
 */
export function getAvailableSpecialDomestics(): string[] {
  return Object.keys(registry).filter(k => k !== 'None');
}

/**
 * 특기 이름으로 ID 조회
 */
export function getSpecialDomesticIdByName(name: string): string | null {
  for (const [id, factory] of Object.entries(registry)) {
    const instance = factory();
    if (instance.getName() === name) {
      return id;
    }
  }
  return null;
}




