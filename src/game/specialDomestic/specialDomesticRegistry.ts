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

const registry: Record<string, () => BaseSpecialDomestic> = {
  None: () => new NoneSpecialDomestic(),
  'che_거상': () => new CheGeosangSpecialDomestic(),
  'che_경작': () => new CheGyeongjakSpecialDomestic(),
  'che_귀모': () => new CheGwimoSpecialDomestic(),
  'che_인덕': () => new CheIndeokSpecialDomestic(),
  'che_수비': () => new CheSubiSpecialDomestic(),
  'che_축성': () => new CheChukseongSpecialDomestic(),
  'che_통찰': () => new CheTongchalSpecialDomestic(),
  // 추가 특기는 여기에 등록
  // 'che_발명': () => new CheBalMyeongSpecialDomestic(),
  // 'che_상재': () => new CheSangJaeSpecialDomestic(),
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




