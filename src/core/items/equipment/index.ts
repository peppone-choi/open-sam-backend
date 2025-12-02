/**
 * Equipment Items Module
 * 무기/방어구/서적 아이템 시스템
 * 
 * 사용법:
 * ```typescript
 * import { 
 *   getItemRegistry, 
 *   getItem, 
 *   ItemRarity,
 *   createCheongryongUnwoldo 
 * } from '@/core/items/equipment';
 * 
 * // 레지스트리 사용
 * const registry = getItemRegistry();
 * const allWeapons = registry.getWeapons();
 * const legendaryItems = registry.getLegendary();
 * 
 * // 특정 아이템 생성
 * const 청룡언월도 = createCheongryongUnwoldo();
 * 
 * // ID로 아이템 조회
 * const item = getItem('weapon_legendary_cheongryong_unwoldo');
 * ```
 */

// ============================================
// 타입 정의
// ============================================

export {
  ItemSlot,
  type StatType,
  type BattleStatType,
  type StatBonus,
  type BattleBonus,
  type SkillBonus,
  type TerrainType,
  type WeatherType,
  type BattlePhase,
  type Position,
  type ItemRef,
  type BattleUnit,
  type BattleContext,
  type General
} from './types';

// ============================================
// 기본 클래스 및 타입
// ============================================

export {
  ItemBase,
  StatItemBase,
  ItemRarity,
  ItemCategory,
  type ItemConfig,
  type ItemEffect,
  type StatItemConfig
} from './ItemBase';

// ============================================
// 무기 시스템
// ============================================

export {
  WeaponBase,
  LegendaryWeapon,
  WeaponType,
  type WeaponConfig,
  type LegendaryWeaponConfig,
  AllWeaponCreators,
  // 전설 무기 생성 함수
  createCheongryongUnwoldo,
  createBangcheonHwageuk,
  createUicheonGeom,
  createCheonghongGeom,
  createUnwoldo,
  // 명물급 무기
  createChilseongGeom,
  createCheolcheokSamo,
  createYangyugiGung,
  createSamo,
  createIgwangGung,
  createGojeongdo,
  // 일반 무기
  createDando,
  createDangung,
  createDangeuk,
  createMokgeom,
  createJukchang,
  createSobu,
  createMaekgung,
  createDongchu,
  createCheolswae,
  createCheolpyeon,
  createYuseongchu,
  createDonghoBigung,
  createSsangcheolgeuk,
  createDaebu,
  createSamcheomndo
} from './WeaponBase';

// ============================================
// 방어구 시스템
// ============================================

export {
  ArmorBase,
  LegendaryArmor,
  ArmorType,
  ArmorMaterial,
  type ArmorConfig,
  type LegendaryArmorConfig,
  AllArmorCreators,
  // 전설급 방어구
  createYonglingap,
  createYeonhwangap,
  createBiiktugu,
  createYongmyeonbangpae,
  // 일반 갑옷
  createPigap,
  createSwaegap,
  createCheolgap,
  createMyeonggwanggap,
  // 투구
  createCheoldugeon,
  createCheoltugu,
  createGeumgwan,
  // 방패
  createMokpae,
  createCheolpae,
  createDaebangpae
} from './ArmorBase';

// ============================================
// 서적 시스템
// ============================================

export {
  BookBase,
  IntelBook,
  ConsumableBook,
  SiegeBook,
  BookType,
  type BookEffect,
  type BookConfig,
  AllBookCreators,
  // 계략 서적
  createSamryak,
  createYukdo,
  createIchu,
  createHyangnang,
  // 공성/농성 서적
  createMukja,
  createMukjaSiege,
  createWigongjaBbyeongbeop,
  createJuseoeumbu,
  createNogunipsanbu,
  // 지력 서적
  createHyogyeongjeon,
  createHoenamja,
  createByeondoron,
  createGeonSangyeokju,
  createYeossichunchu,
  createSaminwolryeong,
  createNoneyo,
  createSamabeop,
  createWiryoja,
  createHanseo,
  createSagi,
  createJeonron,
  createYeokgyeong,
  createJangja,
  createGugukron,
  createSigyeong,
  createSanggunseo,
  createChunchujeon,
  createMaengdeoksinseo,
  createSanhaegyeong,
  createGwanja,
  createByeongbeop24pyeon,
  createOjabyeongbeop,
  createHanbija,
  createNoja,
  createSonjabyeongbeop
} from './BookBase';

// ============================================
// 레지스트리 시스템
// ============================================

export {
  ItemRegistry,
  NoneItem,
  NONE_ITEM,
  type ItemSearchOptions,
  type ItemRegistryStats,
  // 편의 함수
  getItemRegistry,
  getItem,
  getItemOrThrow,
  createItem
} from './ItemRegistry';

