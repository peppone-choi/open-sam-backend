/**
 * 명마/탈것 아이템 모듈
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_*.php
 */

// 기본 클래스 및 타입
export { MountBase, BasicMount, SpecialMount } from './MountBase';
export * from './types';
export * from './MountEffects';

// 레지스트리
export { MountRegistry, mountRegistry } from './MountRegistry';

// 일반 명마 (등급 1-6)
export * from './common';

// 고급 명마 (등급 7-9)
export * from './advanced';

// 희귀 명마 (등급 10-12)
export * from './rare';

// 전설 명마 (등급 13-15)
export * from './legendary';

/**
 * 모든 명마 코드 상수
 */
export const MOUNT_CODES = {
  // 일반 (등급 1-6)
  NOGI: 'che_명마_01_노기',
  JORANG: 'che_명마_02_조랑',
  NOSAE: 'che_명마_03_노새',
  NAGWI: 'che_명마_04_나귀',
  GALSAEK_MA: 'che_명마_05_갈색마',
  HEUKSAEK_MA: 'che_명마_06_흑색마',
  
  // 고급 (등급 7-9)
  GIJU_MA: 'che_명마_07_기주마',
  BAEK_MA: 'che_명마_07_백마',
  BAEK_SANG: 'che_명마_07_백상',
  OHWAN_MA: 'che_명마_07_오환마',
  YANGJU_MA: 'che_명마_08_양주마',
  HYUNGNO_MA: 'che_명마_08_흉노마',
  GWAHA_MA: 'che_명마_09_과하마',
  UINAM_BAEK_MA: 'che_명마_09_의남백마',
  
  // 희귀 (등급 10-12)
  DAEWAN_MA: 'che_명마_10_대완마',
  OKCHU_MA: 'che_명마_10_옥추마',
  SEORYANG_MA: 'che_명마_11_서량마',
  HWAJONG_MA: 'che_명마_11_화종마',
  SARYUN_GEO: 'che_명마_12_사륜거',
  OKRAN_BAEK_YONG_GU: 'che_명마_12_옥란백용구',
  
  // 전설 (등급 13-15)
  JEOK_RO: 'che_명마_13_적로',
  JEOL_YOUNG: 'che_명마_13_절영',
  JEOK_RAN_MA: 'che_명마_14_적란마',
  JOHWANG_BIJEON: 'che_명마_14_조황비전',
  JEOK_TO_MA: 'che_명마_15_적토마',
  HAN_HYUL_MA: 'che_명마_15_한혈마',
} as const;

/**
 * 명마 등급별 코드 그룹
 */
export const MOUNT_CODES_BY_GRADE = {
  common: [
    MOUNT_CODES.NOGI,
    MOUNT_CODES.JORANG,
    MOUNT_CODES.NOSAE,
    MOUNT_CODES.NAGWI,
    MOUNT_CODES.GALSAEK_MA,
    MOUNT_CODES.HEUKSAEK_MA,
  ],
  advanced: [
    MOUNT_CODES.GIJU_MA,
    MOUNT_CODES.BAEK_MA,
    MOUNT_CODES.BAEK_SANG,
    MOUNT_CODES.OHWAN_MA,
    MOUNT_CODES.YANGJU_MA,
    MOUNT_CODES.HYUNGNO_MA,
    MOUNT_CODES.GWAHA_MA,
    MOUNT_CODES.UINAM_BAEK_MA,
  ],
  rare: [
    MOUNT_CODES.DAEWAN_MA,
    MOUNT_CODES.OKCHU_MA,
    MOUNT_CODES.SEORYANG_MA,
    MOUNT_CODES.HWAJONG_MA,
    MOUNT_CODES.SARYUN_GEO,
    MOUNT_CODES.OKRAN_BAEK_YONG_GU,
  ],
  legendary: [
    MOUNT_CODES.JEOK_RO,
    MOUNT_CODES.JEOL_YOUNG,
    MOUNT_CODES.JEOK_RAN_MA,
    MOUNT_CODES.JOHWANG_BIJEON,
    MOUNT_CODES.JEOK_TO_MA,
    MOUNT_CODES.HAN_HYUL_MA,
  ],
} as const;

/**
 * 특수 효과가 있는 명마 코드
 */
export const MOUNTS_WITH_SPECIAL_EFFECT = [
  MOUNT_CODES.GIJU_MA,       // 페이즈 +1
  MOUNT_CODES.BAEK_MA,       // 퇴각 부상 무효
  MOUNT_CODES.BAEK_SANG,     // 공격력/군량/페이즈
  MOUNT_CODES.SARYUN_GEO,    // 퇴각 부상 무효
  MOUNT_CODES.OKRAN_BAEK_YONG_GU, // 병력 비례 회피
] as const;


