/**
 * 성격 레지스트리
 * PHP 대응: func_converter.php buildPersonalityClass()
 */

import { BasePersonality } from './BasePersonality';
import { NonePersonality } from './impl/NonePersonality';
import { CheDaeuiPersonality } from './impl/CheDaeuiPersonality';
import { CheJeongbokPersonality } from './impl/CheJeongbokPersonality';
import { ChePaegwonPersonality } from './impl/ChePaegwonPersonality';
import { CheChulsePersonality } from './impl/CheChulsePersonality';
import { CheEundunPersonality } from './impl/CheEundunPersonality';
import { CheAnjeonPersonality } from './impl/CheAnjeonPersonality';
import { CheWangjwaPersonality } from './impl/CheWangjwaPersonality';
import { CheYujiPersonality } from './impl/CheYujiPersonality';
import { CheUihyeopPersonality } from './impl/CheUihyeopPersonality';
import { CheJaeganPersonality } from './impl/CheJaeganPersonality';
import { CheHalgeoPersonality } from './impl/CheHalgeoPersonality';

const registry: Record<string, () => BasePersonality> = {
  None: () => new NonePersonality(),
  'che_중립': () => new NonePersonality(),
  'che_대의': () => new CheDaeuiPersonality(),
  'che_정복': () => new CheJeongbokPersonality(),
  'che_패권': () => new ChePaegwonPersonality(),
  'che_출세': () => new CheChulsePersonality(),
  'che_은둔': () => new CheEundunPersonality(),
  'che_안전': () => new CheAnjeonPersonality(),
  'che_왕좌': () => new CheWangjwaPersonality(),
  'che_유지': () => new CheYujiPersonality(),
  'che_의협': () => new CheUihyeopPersonality(),
  'che_재간': () => new CheJaeganPersonality(),
  'che_할거': () => new CheHalgeoPersonality(),
};

const cache = new Map<string, BasePersonality>();

/**
 * 성격 Action 조회
 * @param key 성격 키 (예: 'che_대의', 'None')
 * @returns BasePersonality 인스턴스
 */
export function getPersonalityAction(key?: string | null): BasePersonality {
  const normalized = key && registry[key] ? key : 'None';
  if (!cache.has(normalized)) {
    cache.set(normalized, registry[normalized]());
  }
  return cache.get(normalized)!;
}

/**
 * 등록된 모든 성격 목록 조회
 */
export function getAvailablePersonalities(): string[] {
  return Object.keys(registry).filter(k => k !== 'None' && k !== 'che_중립');
}

/**
 * 성격 이름으로 ID 조회
 */
export function getPersonalityIdByName(name: string): string | null {
  for (const [id, factory] of Object.entries(registry)) {
    const instance = factory();
    if (instance.getName() === name) {
      return id;
    }
  }
  return null;
}




