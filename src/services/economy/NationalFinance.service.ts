// @ts-nocheck - Type cleanup pending
/**
 * NationalFinance Service
 * 
 * 국가 재정 계산 서비스
 * - 도시 수입 (city income) - 금/쌀
 * - 전쟁 수입 (war income) - 금
 * - 성벽 수입 (wall income) - 쌀
 * - 지급률 기반 지출 (payment rate based expenses)
 * 
 * PHP 참조: func_time_event.php, Event/Action/ProcessIncome.php
 */

import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { General } from '../../models/general.model';
import { logger } from '../../common/logger';
import {
  getGoldIncome,
  getRiceIncome,
  getWallIncome,
  getWarGoldIncome,
  getOutcome,
  getBill
} from '../../utils/income-util';
import { GameBalance } from '../../common/constants/game-balance';

export interface NationalFinanceResult {
  sessionId: string;
  nationId: number;
  nationName: string;

  // 금 수입
  income: {
    gold: {
      city: number;  // 도시 상업 수입
      war: number;   // 전쟁 수입 (사망자 기반)
      total: number;
    };
    rice: {
      city: number;  // 도시 농업 수입
      wall: number;  // 성벽(둔전) 수입
      total: number;
    };
  };

  // 지출 (봉록)
  outcome: {
    gold: number;   // 금 지출
    rice: number;   // 쌀 지출
    baseOutcome: number;  // 100% 기준 지출 (실제 지급률 적용 전)
  };

  // 현재 재정 상태
  current: {
    gold: number;
    rice: number;
  };

  // 국가 설정
  settings: {
    taxRate: number;      // 세율 (rate_tmp)
    billRate: number;     // 봉록률 (bill)
    level: number;        // 국가 레벨
    capitalId: number;    // 수도 ID
    nationType: string;   // 국가 타입
  };

  // 계산 시간
  calculatedAt: Date;
}

export interface CityIncomeDetail {
  cityId: number;
  cityName: string;
  goldIncome: number;
  riceIncome: number;
  wallIncome: number;
  warIncome: number;
  population: number;
  commerce: number;
  agriculture: number;
  wall: number;
  def: number;
  dead: number;
  supply: number;
  trust: number;
  isCapital: boolean;
  officerCount: number;
}

export class NationalFinanceService {
  /**
   * 국가 재정 상태 조회
   * PHP ProcessIncome.php와 동일한 계산 로직 사용
   */
  static async getNationalFinance(sessionId: string, nationId: number): Promise<NationalFinanceResult> {
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    const nationName = nationData.name || `국가${nationId}`;

    // 국가 설정
    const nationLevel = nationData.level || 1;
    const taxRate = nationData.rate_tmp || nationData.rate || 10;
    const capitalId = nationData.capital || 0;
    const nationType = nationData.type || 'none';
    const billRate = nationData.bill || 100;

    // 도시 목록 조회
    const cities = await City.find({
      session_id: sessionId,
      'data.nation': nationId
    }).lean();

    const cityList = cities.map((city: any) => city.data || city);

    // 관직자 수 집계 (officer_level IN (2,3,4) AND city = officer_city)
    const officersCnt: Record<number, number> = {};
    const generalsForOfficers = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.officer_level': { $in: [2, 3, 4] }
    }).select('data').lean();

    for (const general of generalsForOfficers) {
      const gData = (general as any).data || {};
      const officerLevel = gData.officer_level || 0;
      const officerCity = gData.officer_city || 0;
      const generalCity = gData.city || 0;

      if (officerLevel >= 2 && officerLevel <= 4 && officerCity === generalCity && officerCity > 0) {
        officersCnt[officerCity] = (officersCnt[officerCity] || 0) + 1;
      }
    }

    // 금 수입 계산 (income-util 사용)
    const cityGoldIncome = getGoldIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    const warGoldIncome = getWarGoldIncome(nationType, cityList);

    // 쌀 수입 계산 (income-util 사용)
    const cityRiceIncome = getRiceIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    const wallRiceIncome = getWallIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    // 지출 계산 (income-util 사용)
    const generalsForOutcome = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.npc': { $ne: 5 }  // NPC 유형 5 제외
    }).select('data').lean();

    // 100% 기준 지출 (봉록률 적용 전)
    const baseOutcome = getOutcome(100, generalsForOutcome);
    
    // 실제 지출 (봉록률 적용)
    const goldOutcome = getOutcome(billRate, generalsForOutcome);
    const riceOutcome = getOutcome(billRate, generalsForOutcome);

    return {
      sessionId,
      nationId,
      nationName,

      income: {
        gold: {
          city: cityGoldIncome,
          war: warGoldIncome,
          total: cityGoldIncome + warGoldIncome
        },
        rice: {
          city: cityRiceIncome,
          wall: wallRiceIncome,
          total: cityRiceIncome + wallRiceIncome
        }
      },

      outcome: {
        gold: goldOutcome,
        rice: riceOutcome,
        baseOutcome
      },

      current: {
        gold: nationData.gold || 0,
        rice: nationData.rice || 0
      },

      settings: {
        taxRate,
        billRate,
        level: nationLevel,
        capitalId,
        nationType
      },

      calculatedAt: new Date()
    };
  }

  /**
   * 도시별 수입 상세 조회
   */
  static async getCityIncomeDetails(
    sessionId: string,
    nationId: number
  ): Promise<CityIncomeDetail[]> {
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    const nationLevel = nationData.level || 1;
    const taxRate = nationData.rate_tmp || nationData.rate || 10;
    const capitalId = nationData.capital || 0;
    const nationType = nationData.type || 'none';

    // 도시 목록 조회
    const cities = await City.find({
      session_id: sessionId,
      'data.nation': nationId
    }).lean();

    // 관직자 수 집계
    const officersCnt: Record<number, number> = {};
    const generalsForOfficers = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.officer_level': { $in: [2, 3, 4] }
    }).select('data').lean();

    for (const general of generalsForOfficers) {
      const gData = (general as any).data || {};
      const officerLevel = gData.officer_level || 0;
      const officerCity = gData.officer_city || 0;
      const generalCity = gData.city || 0;

      if (officerLevel >= 2 && officerLevel <= 4 && officerCity === generalCity && officerCity > 0) {
        officersCnt[officerCity] = (officersCnt[officerCity] || 0) + 1;
      }
    }

    const details: CityIncomeDetail[] = [];

    for (const city of cities) {
      const cityData = (city as any).data || city;
      const cityId = cityData.city || 0;
      const isCapital = capitalId === cityId;
      const officerCount = officersCnt[cityId] || 0;

      // 단일 도시에 대해 계산
      const singleCityList = [cityData];
      const singleOfficersCnt = { [cityId]: officerCount };

      const goldIncome = getGoldIncome(
        nationId,
        nationLevel,
        taxRate,
        capitalId,
        nationType,
        singleCityList,
        singleOfficersCnt
      );

      const riceIncome = getRiceIncome(
        nationId,
        nationLevel,
        taxRate,
        capitalId,
        nationType,
        singleCityList,
        singleOfficersCnt
      );

      const wallIncome = getWallIncome(
        nationId,
        nationLevel,
        taxRate,
        capitalId,
        nationType,
        singleCityList,
        singleOfficersCnt
      );

      const warIncome = getWarGoldIncome(nationType, singleCityList);

      details.push({
        cityId,
        cityName: cityData.name || `도시${cityId}`,
        goldIncome,
        riceIncome,
        wallIncome,
        warIncome,
        population: cityData.pop || 0,
        commerce: cityData.comm || 0,
        agriculture: cityData.agri || 0,
        wall: cityData.wall || 0,
        def: cityData.def || 0,
        dead: cityData.dead || 0,
        supply: cityData.supply || 0,
        trust: cityData.trust || 0,
        isCapital,
        officerCount
      });
    }

    return details;
  }

  /**
   * 국가 재정 적용 (턴 처리 시 호출)
   * PHP ProcessIncome.php의 processGoldIncome/processRiceIncome 로직 참조
   */
  static async applyGoldIncome(
    sessionId: string,
    nationId: number
  ): Promise<{ income: number; outcome: number; realOutcome: number; ratio: number; newGold: number }> {
    const finance = await this.getNationalFinance(sessionId, nationId);
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    let currentGold = nationData.gold || 0;
    const income = finance.income.gold.total;
    const outcome = finance.outcome.gold;
    const baseGold = GameBalance.baseGold || 0;

    // PHP ProcessIncome.php 로직 그대로 적용
    currentGold += income;

    let realOutcome: number;
    let ratio: number;

    // 기본량도 안될경우
    if (currentGold < baseGold) {
      realOutcome = 0;
      ratio = 0;
    }
    // 기본량은 넘지만 요구량이 안될경우
    else if (currentGold - baseGold < outcome) {
      realOutcome = currentGold - baseGold;
      currentGold = baseGold;
      ratio = realOutcome / finance.outcome.baseOutcome;
    } else {
      realOutcome = outcome;
      currentGold -= realOutcome;
      ratio = realOutcome / finance.outcome.baseOutcome;
    }

    currentGold = Math.max(currentGold, baseGold);

    await Nation.updateOne(
      { session_id: sessionId, 'data.nation': nationId },
      {
        $set: {
          'data.gold': currentGold
        }
      }
    );

    // 장수들에게 급여 지급
    await this.distributeSalary(sessionId, nationId, 'gold', ratio);

    logger.info('[NationalFinance] Gold income applied', {
      sessionId,
      nationId,
      nationName: finance.nationName,
      income,
      outcome,
      realOutcome,
      ratio,
      newGold: currentGold
    });

    return { income, outcome, realOutcome, ratio, newGold: currentGold };
  }

  /**
   * 쌀 수입 적용 (턴 처리 시 호출)
   */
  static async applyRiceIncome(
    sessionId: string,
    nationId: number
  ): Promise<{ income: number; outcome: number; realOutcome: number; ratio: number; newRice: number }> {
    const finance = await this.getNationalFinance(sessionId, nationId);
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    let currentRice = nationData.rice || 0;
    const income = finance.income.rice.total;
    const outcome = finance.outcome.rice;
    const baseRice = GameBalance.baseRice || 2000;

    // PHP ProcessIncome.php 로직 그대로 적용
    currentRice += income;

    let realOutcome: number;
    let ratio: number;

    if (currentRice < baseRice) {
      realOutcome = 0;
      ratio = 0;
    } else if (currentRice - baseRice < outcome) {
      realOutcome = currentRice - baseRice;
      currentRice = baseRice;
      ratio = realOutcome / finance.outcome.baseOutcome;
    } else {
      realOutcome = outcome;
      currentRice -= realOutcome;
      ratio = realOutcome / finance.outcome.baseOutcome;
    }

    currentRice = Math.max(currentRice, baseRice);

    await Nation.updateOne(
      { session_id: sessionId, 'data.nation': nationId },
      {
        $set: {
          'data.rice': currentRice
        }
      }
    );

    // 장수들에게 급여 지급
    await this.distributeSalary(sessionId, nationId, 'rice', ratio);

    logger.info('[NationalFinance] Rice income applied', {
      sessionId,
      nationId,
      nationName: finance.nationName,
      income,
      outcome,
      realOutcome,
      ratio,
      newRice: currentRice
    });

    return { income, outcome, realOutcome, ratio, newRice: currentRice };
  }

  /**
   * 급여 지급
   * PHP ProcessIncome.php 로직: 각 장수의 dedication에 따라 개별 봉록 지급
   */
  private static async distributeSalary(
    sessionId: string,
    nationId: number,
    resourceType: 'gold' | 'rice',
    ratio: number
  ): Promise<void> {
    const generals = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.npc': { $ne: 5 }
    });

    if (generals.length === 0) {
      return;
    }

    for (const general of generals) {
      const generalData = general.data || {};
      const dedication = generalData.dedication || 0;
      
      // 개별 장수의 봉록 계산
      const baseBill = getBill(dedication);
      const actualBill = Math.round(baseBill * ratio);

      const currentResource = generalData[resourceType] || 0;
      const newResource = currentResource + actualBill;

      await General.updateOne(
        { session_id: sessionId, no: (general as any).no },
        {
          $set: {
            [`data.${resourceType}`]: newResource
          }
        }
      );
    }

    logger.info('[NationalFinance] Salary distributed', {
      sessionId,
      nationId,
      resourceType,
      ratio,
      generalCount: generals.length
    });
  }
}
