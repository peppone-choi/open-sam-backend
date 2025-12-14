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
  
  // dist 폴더에서 실행되므로 프로젝트 루트로 이동 (dist/utils -> open-sam-backend)
  // dist/utils에서 2단계 상위가 프로젝트 루트
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
 * 
 * 통무지정매 5대 능력치 시스템:
 * - leadership (통솔): 징병, 훈련, 군사 지휘
 * - strength (무력): 전투, 일기토
 * - intel (지력): 계략, 정보 수집
 * - politics (정치): 내정(농업/상업/치안), 외교
 * - charm (매력): 등용, 징병 효율, 민심
 */
export function CriticalRatioDomestic(
  leadership: number,
  strength: number,
  intel: number,
  type: 'leadership' | 'strength' | 'intel' | 'politics' | 'charm',
  politics?: number,
  charm?: number
): { success: number; fail: number } {
  // 정치/매력 값이 없으면 지력 기반으로 추정
  const politicsVal = politics ?? intel;
  const charmVal = charm ?? Math.round((politicsVal + leadership) / 2);
  
  // 5대 능력치 평균
  const avg = (leadership + strength + intel + politicsVal + charmVal) / 5;

  let ratio: number;
  switch (type) {
    case 'leadership':
      ratio = avg / Math.max(1, leadership);
      break;
    case 'strength':
      ratio = avg / Math.max(1, strength);
      break;
    case 'intel':
      ratio = avg / Math.max(1, intel);
      break;
    case 'politics':
      ratio = avg / Math.max(1, politicsVal);
      break;
    case 'charm':
      ratio = avg / Math.max(1, charmVal);
      break;
    default:
      // 알 수 없는 타입은 intel 기반으로 처리
      ratio = avg / Math.max(1, intel);
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
export function CriticalScoreEx(rng: any, type: 'success' | 'fail' | string): number {
  const nextFloat = typeof rng === 'function' ? rng : (rng.nextFloat ? rng.nextFloat.bind(rng) : Math.random);
  
  if (type === 'success') {
    return 2.2 + nextFloat() * (3.0 - 2.2);
  }
  if (type === 'fail') {
    return 0.2 + nextFloat() * (0.4 - 0.2);
  }
  return 1;
}

/**
 * 최대 내정 크리티컬 갱신
 * PHP: updateMaxDomesticCritical
 */
export function updateMaxDomesticCritical(general: any, score: number): void {
  if (!general.data.aux) {
    general.data.aux = {};
  }
  
  let maxDomesticCritical = general.data.aux.max_domestic_critical || 0;
  maxDomesticCritical += score / 2;
  general.data.aux.max_domestic_critical = maxDomesticCritical;

  // Inheritance Point
  const key = 'max_domestic_critical';
  const oldMax = typeof general.getInheritancePoint === 'function' ? general.getInheritancePoint(key) : 0;
  
  if (maxDomesticCritical > oldMax) {
    if (typeof general.setInheritancePoint === 'function') {
      general.setInheritancePoint(key, maxDomesticCritical);
    }
  }
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




