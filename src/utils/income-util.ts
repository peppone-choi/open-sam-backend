import { City } from '../models/city.model';
import { General } from '../models/general.model';

/**
 * 수입 계산 유틸리티
 * PHP func_time_event.php의 함수들을 TypeScript로 변환
 */

/**
 * 금 수입 계산
 * PHP getGoldIncome과 동일
 * calcCityGoldIncome을 사용하여 정확히 계산
 */
export function getGoldIncome(
  nationId: number,
  nationLevel: number,
  taxRate: number,
  capitalId: number,
  nationType: string,
  cityList: any[],
  officersCnt?: Record<number, number>
): number {
  if (!cityList || cityList.length === 0) {
    return 0;
  }

  // TODO: nationType을 실제 NationType 클래스로 변환
  // 현재는 기본 계산만 수행
  
  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    cityIncome += calcCityGoldIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
  }

  // PHP: $cityIncome *= ($taxRate / 20);
  cityIncome = Math.floor(cityIncome * (taxRate / 20));

  return cityIncome;
}

/**
 * 도시별 금 수입 계산
 * PHP calcCityGoldIncome과 동일
 */
function calcCityGoldIncome(
  rawCity: any,
  officerCnt: number,
  isCapital: boolean,
  nationLevel: number,
  nationType: string
): number {
  const supply = rawCity.supply || rawCity.data?.supply || 0;
  if (supply === 0) {
    return 0;
  }

  const trust = rawCity.trust || rawCity.data?.trust || 0;
  const trustRatio = trust / 200 + 0.5; // 0.5 ~ 1

  const pop = rawCity.pop || rawCity.data?.pop || 0;
  const comm = rawCity.comm || rawCity.data?.comm || 0;
  const commMax = rawCity.comm_max || rawCity.data?.comm_max || 100;
  const secu = rawCity.secu || rawCity.data?.secu || 0;
  const secuMax = rawCity.secu_max || rawCity.data?.secu_max || 100;

  let cityIncome = pop * comm / commMax * trustRatio / 30;
  cityIncome *= 1 + secu / secuMax / 10;
  cityIncome *= Math.pow(1.05, officerCnt);
  
  if (isCapital) {
    cityIncome *= 1 + (1 / 3 / nationLevel);
  }

  // TODO: nationType.onCalcNationalIncome('gold', cityIncome) 구현 필요
  // 현재는 그대로 반환
  cityIncome = Math.round(cityIncome);

  return cityIncome;
}

/**
 * 쌀 수입 계산
 * PHP getRiceIncome과 동일
 * calcCityRiceIncome을 사용하여 정확히 계산
 */
export function getRiceIncome(
  nationId: number,
  nationLevel: number,
  taxRate: number,
  capitalId: number,
  nationType: string,
  cityList: any[],
  officersCnt?: Record<number, number>
): number {
  if (!cityList || cityList.length === 0) {
    return 0;
  }

  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    cityIncome += calcCityRiceIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
  }

  // PHP: $cityIncome *= ($taxRate / 20);
  cityIncome = Math.floor(cityIncome * (taxRate / 20));

  return cityIncome;
}

/**
 * 도시별 쌀 수입 계산
 * PHP calcCityRiceIncome과 동일
 */
function calcCityRiceIncome(
  rawCity: any,
  officerCnt: number,
  isCapital: boolean,
  nationLevel: number,
  nationType: string
): number {
  const supply = rawCity.supply || rawCity.data?.supply || 0;
  if (supply === 0) {
    return 0;
  }

  const trust = rawCity.trust || rawCity.data?.trust || 0;
  const trustRatio = trust / 200 + 0.5; // 0.5 ~ 1

  const pop = rawCity.pop || rawCity.data?.pop || 0;
  const agri = rawCity.agri || rawCity.data?.agri || 0;
  const agriMax = rawCity.agri_max || rawCity.data?.agri_max || 100;
  const secu = rawCity.secu || rawCity.data?.secu || 0;
  const secuMax = rawCity.secu_max || rawCity.data?.secu_max || 100;

  let cityIncome = pop * agri / agriMax * trustRatio / 30;
  cityIncome *= 1 + secu / secuMax / 10;
  cityIncome *= Math.pow(1.05, officerCnt);
  
  if (isCapital) {
    cityIncome *= 1 + (1 / 3 / nationLevel);
  }

  // TODO: nationType.onCalcNationalIncome('rice', cityIncome) 구현 필요
  cityIncome = Math.round(cityIncome);

  return cityIncome;
}

/**
 * 성벽 수입 계산
 * PHP getWallIncome과 동일
 * calcCityWallRiceIncome을 사용하여 정확히 계산
 */
export function getWallIncome(
  nationId: number,
  nationLevel: number,
  taxRate: number,
  capitalId: number,
  nationType: string,
  cityList: any[],
  officersCnt?: Record<number, number>
): number {
  if (!cityList || cityList.length === 0) {
    return 0;
  }

  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    cityIncome += calcCityWallRiceIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
  }

  // PHP: $cityIncome *= ($taxRate / 20);
  cityIncome = Math.floor(cityIncome * (taxRate / 20));

  return cityIncome;
}

/**
 * 도시별 성벽 쌀 수입 계산
 * PHP calcCityWallRiceIncome과 동일
 */
function calcCityWallRiceIncome(
  rawCity: any,
  officerCnt: number,
  isCapital: boolean,
  nationLevel: number,
  nationType: string
): number {
  const supply = rawCity.supply || rawCity.data?.supply || 0;
  if (supply === 0) {
    return 0;
  }

  const def = rawCity.def || rawCity.data?.def || 0;
  const wall = rawCity.wall || rawCity.data?.wall || 0;
  const wallMax = rawCity.wall_max || rawCity.data?.wall_max || 100;
  const secu = rawCity.secu || rawCity.data?.secu || 0;
  const secuMax = rawCity.secu_max || rawCity.data?.secu_max || 100;

  let wallIncome = def * wall / wallMax / 3;
  wallIncome *= 1 + secu / secuMax / 10;
  wallIncome *= Math.pow(1.05, officerCnt);
  
  if (isCapital) {
    wallIncome *= 1 + 1 / (3 * nationLevel);
  }

  // TODO: nationType.onCalcNationalIncome('rice', wallIncome) 구현 필요
  wallIncome = Math.round(wallIncome);

  return wallIncome;
}

/**
 * 지출 계산
 * PHP getOutcome과 동일
 */
export function getOutcome(billRate: number, generalList: any[]): number {
  let totalOutcome = 0;

  for (const general of generalList) {
    const dedication = general.data?.dedication || 0;
    const bill = getBill(dedication);
    totalOutcome += bill;
  }

  return Math.floor(totalOutcome * (billRate / 100));
}

/**
 * 봉록 계산
 * PHP getBill과 동일
 */
export function getBill(dedication: number): number {
  const dedLevel = getDedLevel(dedication);
  return getBillByLevel(dedLevel);
}

/**
 * 헌신 레벨 계산
 */
function getDedLevel(dedication: number): number {
  if (dedication <= 0) return 0;
  if (dedication < 100) return 1;
  if (dedication < 300) return 2;
  if (dedication < 600) return 3;
  if (dedication < 1000) return 4;
  if (dedication < 1500) return 5;
  if (dedication < 2100) return 6;
  if (dedication < 2800) return 7;
  if (dedication < 3600) return 8;
  if (dedication < 4500) return 9;
  if (dedication < 5500) return 10;
  if (dedication < 6600) return 11;
  if (dedication < 7800) return 12;
  if (dedication < 9100) return 13;
  if (dedication < 10500) return 14;
  if (dedication < 12000) return 15;
  if (dedication < 13600) return 16;
  if (dedication < 15300) return 17;
  if (dedication < 17100) return 18;
  if (dedication < 19000) return 19;
  return 20;
}

/**
 * 레벨별 봉록 계산
 * PHP getBillByLevel과 동일: ($dedLevel * 200 + 400)
 */
function getBillByLevel(dedLevel: number): number {
  if (dedLevel < 0) return 0;
  return dedLevel * 200 + 400;
}

