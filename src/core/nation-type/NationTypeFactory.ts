/**
 * NationTypeFactory
 * 
 * 국가 타입 클래스 생성 팩토리
 * PHP buildNationTypeClass 함수를 TypeScript로 포팅
 */

import { BaseNationType } from './BaseNationType';
import { NoneNationType } from './types/NoneNationType';
import { ConfucianismNationType } from './types/ConfucianismNationType';
import { LegalismNationType } from './types/LegalismNationType';
import { MilitarismNationType } from './types/MilitarismNationType';
import { MohismNationType } from './types/MohismNationType';
import { LogiciansNationType } from './types/LogiciansNationType';
import { DiplomatistsNationType } from './types/DiplomatistsNationType';
import { YinyangNationType } from './types/YinyangNationType';
import { TaoismNationType } from './types/TaoismNationType';
import { BanditsNationType } from './types/BanditsNationType';
import { BuddhismNationType } from './types/BuddhismNationType';
import { TaoismReligiousNationType } from './types/TaoismReligiousNationType';
import { TaipingNationType } from './types/TaipingNationType';
import { VirtueNationType } from './types/VirtueNationType';

// 캐시
const typeCache = new Map<string, BaseNationType>();

/**
 * 국가 타입 클래스 빌드
 * @param type 국가 타입 ID (예: 'confucianism', 'legalism' 등)
 * @returns 국가 타입 인스턴스
 */
export function buildNationTypeClass(type: string | null): BaseNationType {
  if (!type || type === '') {
    type = 'none';
  }

  // 캐시 확인
  if (typeCache.has(type)) {
    return typeCache.get(type)!;
  }

  // 타입 ID 정규화
  const normalizedType = type.toLowerCase().replace(/^che_/, '');

  // 타입별 클래스 매핑
  let nationType: BaseNationType;

  switch (normalizedType) {
    case 'none':
    case 'neutral':
      nationType = new NoneNationType();
      break;
    case 'confucianism':
    case '유가':
      nationType = new ConfucianismNationType();
      break;
    case 'legalism':
    case '법가':
      nationType = new LegalismNationType();
      break;
    case 'militarism':
    case '병가':
      nationType = new MilitarismNationType();
      break;
    case 'mohism':
    case '묵가':
      nationType = new MohismNationType();
      break;
    case 'logicians':
    case '명가':
      nationType = new LogiciansNationType();
      break;
    case 'diplomatists':
    case '종횡가':
      nationType = new DiplomatistsNationType();
      break;
    case 'yinyang':
    case '음양가':
      nationType = new YinyangNationType();
      break;
    case 'taoism':
    case '도가':
      nationType = new TaoismNationType();
      break;
    case 'bandits':
    case '도적':
      nationType = new BanditsNationType();
      break;
    case 'buddhism':
    case '불가':
      nationType = new BuddhismNationType();
      break;
    case 'taoism_religious':
    case '오두미도':
      nationType = new TaoismReligiousNationType();
      break;
    case 'taiping':
    case '태평도':
      nationType = new TaipingNationType();
      break;
    case 'virtue':
    case '덕가':
      nationType = new VirtueNationType();
      break;
    default:
      // 알 수 없는 타입은 None으로 처리
      console.warn(`Unknown nation type: ${type}, using None`);
      nationType = new NoneNationType();
  }

  // 캐시에 저장
  typeCache.set(type, nationType);

  return nationType;
}

/**
 * 국가 타입 이름 반환
 * @param type 국가 타입 ID
 * @returns 국가 타입 이름
 */
export function getNationTypeName(type: string | null): string {
  const nationType = buildNationTypeClass(type);
  return nationType.getName();
}

/**
 * 국가 타입 정보 반환 (장점/단점)
 * @param type 국가 타입 ID
 * @returns 국가 타입 정보
 */
export function getNationTypeInfo(type: string | null): { name: string; pros: string; cons: string } {
  const nationType = buildNationTypeClass(type);
  const pros = (nationType.constructor as typeof BaseNationType).pros;
  const cons = (nationType.constructor as typeof BaseNationType).cons;
  
  return {
    name: nationType.getName(),
    pros,
    cons
  };
}

