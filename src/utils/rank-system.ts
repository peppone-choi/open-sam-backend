/**
 * 직위/작위 시스템 유틸리티
 * PHP func_converter.php와 func_gamerule.php 기반
 */

import * as fs from 'fs';
import * as path from 'path';

// 캐시된 상수 데이터
let constantsData: any = null;

function loadConstants() {
  if (constantsData) return constantsData;
  
  const constantsPath = path.join(__dirname, '../../config/scenarios/sangokushi/data/constants.json');
  const data = fs.readFileSync(constantsPath, 'utf-8');
  constantsData = JSON.parse(data);
  return constantsData;
}

/**
 * 도시 수로 국가 레벨 계산
 * @param cityCount 보유 도시 수
 * @returns 국가 레벨 (0~15)
 */
export function getNationLevelByCityCount(cityCount: number): number {
  const constants = loadConstants();
  const levels = constants.nationLevels;
  
  let nationLevel = 0;
  for (const key of Object.keys(levels).reverse()) {
    const level = levels[key];
    if (cityCount >= level.minCities) {
      nationLevel = level.level;
      break;
    }
  }
  
  return nationLevel;
}

/**
 * 국가 레벨명 조회
 * @param nationLevel 국가 레벨 (0~15)
 * @returns 국가 레벨명 (예: "황제", "왕", "공" 등)
 */
export function getNationLevelName(nationLevel: number): string {
  const constants = loadConstants();
  const level = constants.nationLevels[nationLevel.toString()];
  return level?.name || '방랑군';
}

/**
 * 국가 레벨 정보 조회
 * @param nationLevel 국가 레벨 (0~15)
 * @returns { level, name, chiefCount, minCities }
 */
export function getNationLevelInfo(nationLevel: number) {
  const constants = loadConstants();
  return constants.nationLevels[nationLevel.toString()] || constants.nationLevels['0'];
}

/**
 * 모든 국가 레벨 목록 조회
 * @returns 국가 레벨 배열
 */
export function getAllNationLevels() {
  const constants = loadConstants();
  return Object.values(constants.nationLevels);
}

/**
 * 직위 명칭 조회 (국가 레벨 기반)
 * PHP getOfficerLevelText 함수 포팅
 * 
 * @param officerLevel 직위 레벨 (0~12)
 * @param nationLevel 국가 레벨 (0~15, 8은 NPC 전용)
 * @returns 직위 명칭
 */
export function getOfficerTitle(officerLevel: number, nationLevel: number = 0): string {
  const constants = loadConstants();
  const titles = constants.officerTitles;
  
  // 지방관 (officerLevel 0~4)은 국가 레벨 무관
  if (officerLevel >= 0 && officerLevel <= 4) {
    const title = titles[officerLevel.toString()];
    return title?.default || '재야';
  }
  
  // 수뇌부 (officerLevel 5~12)는 국가 레벨에 따라 다름
  const officerTitles = titles[officerLevel.toString()];
  if (!officerTitles) return '-';
  
  // 국가 레벨에 해당하는 직위 조회
  const title = officerTitles[nationLevel.toString()];
  if (title) return title;
  
  // 해당 국가 레벨에 직위가 없으면 가장 낮은 직위 반환
  const availableLevels = Object.keys(officerTitles)
    .filter(k => k !== 'default')
    .map(Number)
    .sort((a, b) => a - b);
  
  for (const level of availableLevels) {
    if (nationLevel >= level) {
      return officerTitles[level.toString()];
    }
  }
  
  return officerTitles.default || '-';
}

/**
 * 헌신도 등급 조회 (짧은 이름)
 * @param dedication 헌신도 수치
 * @returns 헌신도 등급 (예: "하하", "중중", "최상" 등)
 */
export function getDedicationShortName(dedication: number): string {
  const constants = loadConstants();
  const levels = constants.dedicationLevels;
  
  for (const level of levels) {
    if (dedication >= level.min && dedication <= level.max) {
      return level.shortName;
    }
  }
  
  return '최상';
}

/**
 * 헌신도 등급 조회 (전체 이름)
 * @param dedication 헌신도 수치
 * @returns 헌신도 등급 (예: "무명", "충성", "충신" 등)
 */
export function getDedicationFullName(dedication: number): string {
  const constants = loadConstants();
  const levels = constants.dedicationLevels;
  
  for (const level of levels) {
    if (dedication >= level.min && dedication <= level.max) {
      return level.fullName;
    }
  }
  
  return '충신';
}

/**
 * 명성 등급 조회
 * @param experience 경험치/명성 수치
 * @returns 명성 등급 (예: "병졸", "장수", "명장" 등)
 */
export function getHonorLevel(experience: number): string {
  const constants = loadConstants();
  const levels = constants.honorLevels;
  
  for (const level of levels) {
    if (experience >= level.min && experience <= level.max) {
      return level.name;
    }
  }
  
  return '명장';
}

/**
 * 군주 여부 확인
 * @param officerLevel 직위 레벨
 * @returns true if 군주
 */
export function isKing(officerLevel: number): boolean {
  return officerLevel === 12;
}

/**
 * 수뇌부 여부 확인
 * @param officerLevel 직위 레벨
 * @returns true if 수뇌부 (officerLevel >= 5)
 */
export function isChief(officerLevel: number): boolean {
  return officerLevel >= 5;
}

/**
 * 이십등작 명칭 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 이십등작 명칭
 */
export function getMilitaryRankName(militaryRank: number): string {
  const constants = loadConstants();
  const rank = constants.militaryRanks?.[militaryRank.toString()];
  return rank?.name || '무작';
}

/**
 * 이십등작 짧은 명칭 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 이십등작 짧은 명칭
 */
export function getMilitaryRankShortName(militaryRank: number): string {
  const constants = loadConstants();
  const rank = constants.militaryRanks?.[militaryRank.toString()];
  return rank?.shortName || '무작';
}

/**
 * 이십등작 정보 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns { rank, name, shortName }
 */
export function getMilitaryRankInfo(militaryRank: number) {
  const constants = loadConstants();
  return constants.militaryRanks?.[militaryRank.toString()] || constants.militaryRanks?.['0'];
}

/**
 * 모든 이십등작 목록 조회
 * @returns 이십등작 배열
 */
export function getAllMilitaryRanks() {
  const constants = loadConstants();
  return Object.values(constants.militaryRanks || {});
}

/**
 * 이십등작 병력 상한 보너스 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 병력 상한 보너스
 */
export function getMilitaryRankCrewBonus(militaryRank: number): number {
  const rankInfo = getMilitaryRankInfo(militaryRank);
  return rankInfo?.crewBonus || 0;
}

/**
 * 이십등작 모병 비용 할인율 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 모병 비용 할인율 (%)
 */
export function getMilitaryRankRecruitDiscount(militaryRank: number): number {
  const rankInfo = getMilitaryRankInfo(militaryRank);
  return rankInfo?.recruitCostDiscount || 0;
}

/**
 * 이십등작 훈련 보너스 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 훈련 효율 보너스 (%)
 */
export function getMilitaryRankTrainBonus(militaryRank: number): number {
  const rankInfo = getMilitaryRankInfo(militaryRank);
  return rankInfo?.trainBonus || 0;
}

/**
 * 이십등작 사기 보너스 조회
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 사기 보너스 (%)
 */
export function getMilitaryRankMoraleBonus(militaryRank: number): number {
  const rankInfo = getMilitaryRankInfo(militaryRank);
  return rankInfo?.moraleBonus || 0;
}

/**
 * 이십등작 보너스가 적용된 사기 계산
 * @param baseMorale 기본 사기 (0~150)
 * @param militaryRank 이십등작 등급 (0~20)
 * @returns 보너스 적용된 사기
 */
export function getEffectiveMorale(baseMorale: number, militaryRank: number): number {
  const moraleBonus = getMilitaryRankMoraleBonus(militaryRank);
  if (moraleBonus === 0) return baseMorale;
  
  const effectiveMorale = baseMorale * (1 + moraleBonus / 100);
  return Math.min(150, Math.round(effectiveMorale)); // 사기 최대치 150
}

/**
 * 전투 승리 시 이십등작 승급 판정
 * @param currentRank 현재 이십등작 등급 (0~20)
 * @param enemyKilled 적 병력 처치 수
 * @param isVictory 승리 여부
 * @returns 새로운 이십등작 등급
 */
export function promoteMilitaryRank(
  currentRank: number,
  enemyKilled: number,
  isVictory: boolean
): number {
  if (!isVictory) return currentRank;
  if (currentRank >= 20) return 20; // 최대 등급
  
  // 승급 기준: 최소 1000명 이상 처치 시 승급 가능
  const minKillsForPromotion = 1000 + (currentRank * 500);
  
  if (enemyKilled >= minKillsForPromotion) {
    // 처치 병력이 많을수록 여러 단계 승급 가능
    const promotionLevels = Math.floor(enemyKilled / minKillsForPromotion);
    const newRank = Math.min(20, currentRank + promotionLevels);
    return newRank;
  }
  
  return currentRank;
}
