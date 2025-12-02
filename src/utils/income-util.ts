import { City } from '../models/city.model';
import { General } from '../models/general.model';
import { buildNationTypeClass } from '../core/nation-type/NationTypeFactory';
import { GameBalance } from '../common/constants/game-balance';

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

  // 국가 타입 클래스 생성
  const nationTypeClass = buildNationTypeClass(nationType);
  
  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    let income = calcCityGoldIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
    
    // 국가 타입 효과 적용
    income = nationTypeClass.onCalcNationalIncome('gold', income);
    
    cityIncome += income;
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

  // 국가 타입 효과는 상위 함수에서 적용
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

  // 국가 타입 클래스 생성
  const nationTypeClass = buildNationTypeClass(nationType);

  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    let income = calcCityRiceIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
    
    // 국가 타입 효과 적용
    income = nationTypeClass.onCalcNationalIncome('rice', income);
    
    cityIncome += income;
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

  // 국가 타입 효과는 상위 함수에서 적용
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

  // 국가 타입 클래스 생성
  const nationTypeClass = buildNationTypeClass(nationType);

  let cityIncome = 0;
  for (const rawCity of cityList) {
    const cityID = rawCity.city || rawCity.data?.city || 0;
    const officerCnt = officersCnt?.[cityID] || 0;
    const isCapital = capitalId === cityID;
    
    let income = calcCityWallRiceIncome(rawCity, officerCnt, isCapital, nationLevel, nationType);
    
    // 국가 타입 효과 적용 (성벽 수입도 쌀 수입이므로 'rice'로 처리)
    income = nationTypeClass.onCalcNationalIncome('rice', income);
    
    cityIncome += income;
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

  // 국가 타입 효과는 상위 함수에서 적용
  wallIncome = Math.round(wallIncome);

  return wallIncome;
}

/**
 * 전쟁 금 수입 계산
 * PHP getWarGoldIncome과 동일
 */
export function getWarGoldIncome(
  nationType: string,
  cityList: any[]
): number {
  if (!cityList || cityList.length === 0) {
    return 0;
  }

  // 국가 타입 클래스 생성
  const nationTypeClass = buildNationTypeClass(nationType);

  let warIncome = 0;
  for (const rawCity of cityList) {
    const dead = rawCity.dead || rawCity.data?.dead || 0;
    const supply = rawCity.supply || rawCity.data?.supply || 0;
    
    if (supply === 0) {
      continue;
    }

    // 전쟁 수입 = 사망자 수 / 10
    let income = dead / 10;
    
    // 국가 타입 효과 적용
    income = nationTypeClass.onCalcNationalIncome('gold', income);
    
    warIncome += Math.round(income);
  }

  return warIncome;
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
 * PHP: ceil(sqrt($dedication) / 10), 0 ~ maxDedLevel 제한
 */
function getDedLevel(dedication: number): number {
  if (dedication <= 0) return 0;
  
  const maxDedLevel = GameBalance.maxDedLevel || 30;
  const level = Math.ceil(Math.sqrt(dedication) / 10);
  
  // 0 ~ maxDedLevel 범위 제한
  return Math.max(0, Math.min(level, maxDedLevel));
}

/**
 * 레벨별 봉록 계산
 * PHP getBillByLevel과 동일: ($dedLevel * 200 + 400)
 */
function getBillByLevel(dedLevel: number): number {
  if (dedLevel < 0) return 0;
  return dedLevel * 200 + 400;
}

