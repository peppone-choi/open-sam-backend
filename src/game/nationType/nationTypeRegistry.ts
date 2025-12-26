/**
 * 국가유형 레지스트리
 * PHP 대응: func_converter.php buildNationTypeClass()
 */

import { BaseNationType } from './BaseNationType';
import {
  NoneNationType,
  CheYugaNationType,
  CheBeopgaNationType,
  CheDogaNationType,
  CheByeonggaNationType,
  CheMukgaNationType,
  CheMyeonggaNationType,
  CheJonghoenggaNationType,
  CheEumyanggaNationType,
  CheBulgaNationType,
  CheDojeokNationType,
  CheTaepyeongdoNationType,
  CheOdumidoNationType,
  CheDeokgaNationType,
} from './impl';

const registry: Record<string, () => BaseNationType> = {
  None: () => new NoneNationType(),
  'che_중립': () => new NoneNationType(),
  'che_유가': () => new CheYugaNationType(),
  'che_법가': () => new CheBeopgaNationType(),
  'che_도가': () => new CheDogaNationType(),
  'che_병가': () => new CheByeonggaNationType(),
  'che_묵가': () => new CheMukgaNationType(),
  'che_명가': () => new CheMyeonggaNationType(),
  'che_종횡가': () => new CheJonghoenggaNationType(),
  'che_음양가': () => new CheEumyanggaNationType(),
  'che_불가': () => new CheBulgaNationType(),
  'che_도적': () => new CheDojeokNationType(),
  'che_태평도': () => new CheTaepyeongdoNationType(),
  'che_오두미도': () => new CheOdumidoNationType(),
  'che_덕가': () => new CheDeokgaNationType(),
};

const cache = new Map<string, BaseNationType>();

/**
 * 국가유형 Action 조회
 * @param key 국가유형 키 (예: 'che_유가', 'None')
 * @returns BaseNationType 인스턴스
 */
export function getNationTypeAction(key?: string | null): BaseNationType {
  const normalized = key && registry[key] ? key : 'None';
  if (!cache.has(normalized)) {
    cache.set(normalized, registry[normalized]());
  }
  return cache.get(normalized)!;
}

/**
 * 등록된 모든 국가유형 목록 조회
 */
export function getAvailableNationTypes(): string[] {
  return Object.keys(registry).filter((k) => k !== 'None' && k !== 'che_중립');
}

/**
 * 국가유형 이름으로 ID 조회
 */
export function getNationTypeIdByName(name: string): string | null {
  for (const [id, factory] of Object.entries(registry)) {
    const instance = factory();
    if (instance.getName() === name) {
      return id;
    }
  }
  return null;
}

/**
 * 모든 국가유형 정보 조회
 */
export function getAllNationTypeInfo(): Array<{
  id: string;
  name: string;
  pros: string;
  cons: string;
}> {
  return getAvailableNationTypes().map((id) => {
    const instance = getNationTypeAction(id);
    return {
      id,
      name: instance.getName(),
      pros: instance.getPros(),
      cons: instance.getCons(),
    };
  });
}
