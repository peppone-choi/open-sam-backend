/**
 * 장수 특기 시스템 메인 모듈
 * 
 * PHP core/hwe/sammo/BaseSpecial.php, SpecialityHelper.php 기반
 * 
 * 구조:
 * - SpecialityBase: 특기 기본 클래스 및 인터페이스
 * - SpecialityRegistry: 특기 레지스트리 및 선택 로직
 * - battle/: 전투 특기 (무쌍, 신중, 척사, 인덕, 돌격, 철벽, 명사, 질풍, 기습, 필살)
 * - tactics/: 계략 특기 (천재, 귀모, 화공, 수공, 독살)
 * - politics/: 내정 특기 (농업, 상업, 건설, 징병, 훈련)
 * - unit/: 병종 특기 (기병, 보병, 궁병, 창병, 수군)
 * 
 * @example
 * ```typescript
 * import { specialityRegistry, Musang, SpecialityCategory } from './specialities';
 * 
 * // 특기 조회
 * const musang = specialityRegistry.getByName('무쌍');
 * const spec = specialityRegistry.getById(61);
 * 
 * // 장수에게 특기 배정
 * const generalStats = { leadership: 70, strength: 95, intel: 50 };
 * const warSpec = specialityRegistry.pickBattleSpeciality(generalStats);
 * const domSpec = specialityRegistry.pickDomesticSpeciality(generalStats);
 * 
 * // 직접 인스턴스 생성
 * const myMusang = new Musang();
 * console.log(myMusang.getWarPowerMultiplier(unit));
 * ```
 */

// ============================================================================
// 기본 클래스 및 인터페이스
// ============================================================================

export {
  // 기본 클래스
  SpecialityBase,
  BattleSpecialityBase,
  TacticsSpecialityBase,
  PoliticsSpecialityBase,
  UnitSpecialityBase,

  // Enum
  SpecialityCategory,
  StatRequirement,
  SelectWeightType,
  TriggerTiming,

  // 인터페이스
  type IBattleContext,
  type IStatCalcContext,
  type IDomesticCalcContext,
  type IWarPowerMultiplier,
  type ITriggerResult,

  // 타입 가드
  isBattleSpeciality,
  isTacticsSpeciality,
  isPoliticsSpeciality,
  isUnitSpeciality,
} from './SpecialityBase';

// ============================================================================
// 레지스트리
// ============================================================================

export {
  SpecialityRegistry,
  specialityRegistry,
  type IGeneralStats,
  type ISpecialityPickOptions,
} from './SpecialityRegistry';

// ============================================================================
// 전투 특기
// ============================================================================

export {
  Musang,
  Sinjung,
  Cheoksa,
  Indeok,
  Dolgyeok,
  Cheolbyeok,
  Myeongsa,
  Jilpung,
  Giseup,
  Pilsal,
  BattleSpecialities,
  getBattleSpecialityById,
  getBattleSpecialityByName,
} from './battle';

// ============================================================================
// 계략 특기
// ============================================================================

export {
  Cheonjae,
  Gwimo,
  Hwagong,
  Sugong,
  Doksal,
  TacticsSpecialities,
  getTacticsSpecialityById,
  getTacticsSpecialityByName,
} from './tactics';

// ============================================================================
// 내정 특기
// ============================================================================

export {
  Nongeop,
  Sangeop,
  Geonseol,
  Jingbyeong,
  Hullyeon,
  PoliticsSpecialities,
  getPoliticsSpecialityById,
  getPoliticsSpecialityByName,
} from './politics';

// ============================================================================
// 병종 특기
// ============================================================================

export {
  Gibyeong,
  Bobyeong,
  Gungbyeong,
  Changbyeong,
  Sugun,
  UnitSpecialities,
  getUnitSpecialityById,
  getUnitSpecialityByName,
  getUnitSpecialityByUnitType,
} from './unit';

// ============================================================================
// 모든 특기 통합
// ============================================================================

import { BattleSpecialities } from './battle';
import { TacticsSpecialities } from './tactics';
import { PoliticsSpecialities } from './politics';
import { UnitSpecialities } from './unit';
import { SpecialityBase } from './SpecialityBase';

/**
 * 모든 특기 클래스 배열
 */
export const AllSpecialities: Array<new () => SpecialityBase> = [
  ...BattleSpecialities,
  ...TacticsSpecialities,
  ...PoliticsSpecialities,
  ...UnitSpecialities,
];

/**
 * 특기 총 개수
 */
export const TOTAL_SPECIALITY_COUNT = AllSpecialities.length;


