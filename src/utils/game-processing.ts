/**
 * 게임 프로세싱 유틸리티 함수들
 * PHP 원본: func_process.php, func_gamerule.php
 */

import * as fs from 'fs';
import * as path from 'path';

// 캐시된 상수 데이터 (시나리오별로 캐시)
const constantsCache: Record<string, any> = {};

function loadConstants(scenarioId: string = 'sangokushi') {
  if (constantsCache[scenarioId]) {
    return constantsCache[scenarioId];
  }
  
  const constantsPath = path.join(__dirname, '../../config/scenarios', scenarioId, 'data/constants.json');
  if (!fs.existsSync(constantsPath)) {
    throw new Error(`Constants file not found: ${constantsPath}`);
  }
  const data = fs.readFileSync(constantsPath, 'utf-8');
  constantsCache[scenarioId] = JSON.parse(data);
  return constantsCache[scenarioId];
}

/**
 * 내정 커맨드 성공 확률 계산
 * PHP: CriticalRatioDomestic
 */
export function CriticalRatioDomestic(
  leadership: number,
  strength: number,
  intel: number,
  type: 'leadership' | 'strength' | 'intel'
): { success: number; fail: number } {
  const avg = (leadership + strength + intel) / 3;

  let ratio: number;
  switch (type) {
    case 'leadership':
      ratio = avg / leadership;
      break;
    case 'strength':
      ratio = avg / strength;
      break;
    case 'intel':
      ratio = avg / intel;
      break;
    default:
      throw new Error('Invalid type');
  }

  ratio = Math.min(ratio, 1.2);

  let fail = Math.pow(ratio / 1.2, 1.4) - 0.3;
  let success = Math.pow(ratio / 1.2, 1.5) - 0.25;

  fail = Math.max(0, Math.min(0.5, fail));
  success = Math.max(0, Math.min(0.5, success));

  return { success, fail };
}

/**
 * 통솔 보너스 계산
 * PHP: calcLeadershipBonus
 */
export function calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
  if (officerLevel === 12) {
    return nationLevel * 2;
  } else if (officerLevel >= 5) {
    return nationLevel;
  } else {
    return 0;
  }
}

/**
 * 성공/실패 확률에 따른 보너스 계산
 * PHP: CriticalScoreEx
 */
export function CriticalScoreEx(rng: () => number, type: 'success' | 'fail'): number {
  if (type === 'success') {
    return 2.2 + rng() * (3.0 - 2.2);
  }
  if (type === 'fail') {
    return 0.2 + rng() * (0.4 - 0.2);
  }
  return 1;
}

/**
 * 국가 레벨 목록
 * PHP: getNationLevelList
 * 시나리오 JSON의 nationLevels에서 로드
 */
export function getNationLevelList(scenarioId: string = 'sangokushi'): Array<[number, string, number, number]> {
  const constants = loadConstants(scenarioId);
  const nationLevels = constants.nationLevels || {};
  
  const result: Array<[number, string, number, number]> = [];
  for (let level = 0; level <= 8; level++) {
    const levelData = nationLevels[level.toString()];
    if (levelData) {
      // [level, name, chiefCount, minCities]
      result.push([
        levelData.level,
        levelData.name,
        levelData.chiefCount,
        levelData.minCities
      ]);
    }
  }
  
  return result;
}

/**
 * 도시 레벨 목록
 * PHP: getCityLevelList
 * 시나리오 JSON의 cityLevels에서 로드
 */
export function getCityLevelList(scenarioId: string = 'sangokushi'): Record<number, string> {
  const constants = loadConstants(scenarioId);
  const cityLevels = constants.cityLevels || {};
  
  const result: Record<number, string> = {};
  for (const levelStr in cityLevels) {
    const level = parseInt(levelStr);
    if (!isNaN(level)) {
      const levelData = cityLevels[levelStr];
      result[level] = levelData.name || levelData.label || '';
    }
  }
  
  return result;
}




