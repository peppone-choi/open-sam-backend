// @ts-nocheck - Type cleanup pending
/**
 * NationalFinance Service
 * 
 * 국가 재정 계산 서비스
 * - 도시 수입 (city income)
 * - 전쟁 수입 (war income)
 * - 성벽 수입 (wall income)
 * - 지급률 기반 지출 (payment rate based expenses)
 * - 상비군 유지 비용 (standing army maintenance cost)
 * 
 * PHP 참조: 각종 턴 처리 로직에서의 국가 재정 계산
 */

import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { General } from '../../models/general.model';
import { logger } from '../../common/logger';
import { KVStorage } from '../../utils/KVStorage';
import { Util } from '../../utils/Util';

export interface NationalFinanceResult {
  sessionId: string;
  nationId: number;
  nationName: string;

  // 수입
  cityIncome: number;
  cityIncomeDetail: Array<{
    cityId: number;
    cityName: string;
    population: number;
    agriculture: number;
    commerce: number;
    security: number;
    wall: number;
    income: number;
  }>;

  warIncome: number;
  wallIncome: number;

  totalIncome: number;

  // 지출
  salaryExpense: number; // 급여 지출 (지급률 기반)
  armyMaintenanceCost: number; // 상비군 유지 비용
  totalExpense: number;

  // 순이익
  netIncome: number;

  // 현재 재정 상태
  currentGold: number;
  currentRice: number;

  // 계산 시간
  calculatedAt: Date;
}

export class NationalFinanceService {
  /**
   * 국가 재정 상태 조회
   */
  static async getNationalFinance(sessionId: string, nationId: number): Promise<NationalFinanceResult> {
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    const nationName = nationData.name || `국가${nationId}`;

    // 도시 수입 계산
    const { cityIncome, cityIncomeDetail } = await this.calculateCityIncome(sessionId, nationId);

    // 전쟁 수입 계산
    const warIncome = await this.calculateWarIncome(sessionId, nationId);

    // 성벽 수입 계산
    const wallIncome = await this.calculateWallIncome(sessionId, nationId, cityIncomeDetail);

    // 총 수입
    const totalIncome = cityIncome + warIncome + wallIncome;

    // 급여 지출 계산
    const salaryExpense = await this.calculateSalaryExpense(sessionId, nationId, totalIncome);

    // 상비군 유지 비용 계산
    const armyMaintenanceCost = await this.calculateArmyMaintenanceCost(sessionId, nationId);

    // 총 지출
    const totalExpense = salaryExpense + armyMaintenanceCost;

    // 순이익
    const netIncome = totalIncome - totalExpense;

    return {
      sessionId,
      nationId,
      nationName,

      cityIncome,
      cityIncomeDetail,
      warIncome,
      wallIncome,
      totalIncome,

      salaryExpense,
      armyMaintenanceCost,
      totalExpense,

      netIncome,

      currentGold: nationData.gold || 0,
      currentRice: nationData.rice || 0,

      calculatedAt: new Date()
    };
  }

  /**
   * 도시 수입 계산
   * 
   * PHP 공식:
   * - 기본 수입 = population * (agriculture + commerce) / 200
   * - 치안 보너스 = security >= 80 ? 10% : 0%
   */
  private static async calculateCityIncome(
    sessionId: string,
    nationId: number
  ): Promise<{ cityIncome: number; cityIncomeDetail: any[] }> {
    const cities = await City.find({
      session_id: sessionId,
      'data.nation': nationId
    });

    let totalIncome = 0;
    const incomeDetail = [];

    for (const city of cities) {
      const cityData = city.data || {};
      const cityId = cityData.city || 0;
      const cityName = cityData.name || `도시${cityId}`;
      const population = cityData.population || 0;
      const agriculture = cityData.agriculture || 0;
      const commerce = cityData.commerce || 0;
      const security = cityData.security || 0;
      const wall = cityData.wall || 0;

      // 기본 수입 = population * (agriculture + commerce) / 200
      let income = Math.floor(population * (agriculture + commerce) / 200);

      // 치안 보너스
      if (security >= 80) {
        income = Math.floor(income * 1.1);
      }

      totalIncome += income;

      incomeDetail.push({
        cityId,
        cityName,
        population,
        agriculture,
        commerce,
        security,
        wall,
        income
      });
    }

    return {
      cityIncome: totalIncome,
      cityIncomeDetail: incomeDetail
    };
  }

  /**
   * 전쟁 수입 계산
   * 
   * PHP 공식:
   * - 전쟁 중인 국가의 도시 수에 비례
   * - 도시당 100골드 (예시)
   */
  private static async calculateWarIncome(
    sessionId: string,
    nationId: number
  ): Promise<number> {
    // TODO: 전쟁 상태 확인 및 수입 계산
    // 현재는 0으로 반환
    return 0;
  }

  /**
   * 성벽 수입 계산
   * 
   * PHP 공식:
   * - 성벽 레벨에 비례한 추가 수입
   * - 성벽 수입 = sum(wall * 10) for all cities
   */
  private static async calculateWallIncome(
    sessionId: string,
    nationId: number,
    cityIncomeDetail: any[]
  ): Promise<number> {
    let wallIncome = 0;

    for (const city of cityIncomeDetail) {
      wallIncome += city.wall * 10;
    }

    return wallIncome;
  }

  /**
   * 급여 지출 계산
   * 
   * PHP 공식:
   * - 지급률(paymentRate)에 따라 총 수입의 일정 비율을 급여로 지급
   * - 급여 = totalIncome * paymentRate / 100
   */
  private static async calculateSalaryExpense(
    sessionId: string,
    nationId: number,
    totalIncome: number
  ): Promise<number> {
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      return 0;
    }

    const nationData = nation.data || {};
    const paymentRate = nationData.rate_tmp || nationData.rate || 10; // 기본 10%

    // 급여 = 총 수입 * 지급률 / 100
    const salaryExpense = Math.floor(totalIncome * paymentRate / 100);

    return salaryExpense;
  }

  /**
   * 상비군 유지 비용 계산
   * 
   * PHP 공식:
   * - 각 장수의 병력 수에 비례한 유지 비용
   * - 유지비 = sum(troops * 0.1) for all generals
   */
  private static async calculateArmyMaintenanceCost(
    sessionId: string,
    nationId: number
  ): Promise<number> {
    const generals = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.npc': { $lt: 2 } // NPC 제외
    });

    let totalCost = 0;

    for (const general of generals) {
      const generalData = general.data || {};
      const troops = generalData.leadership || 0; // 병력 수 (통솔력 기반)

      // 유지비 = 병력 * 0.1
      const cost = Math.floor(troops * 0.1);
      totalCost += cost;
    }

    return totalCost;
  }

  /**
   * 국가 재정 적용 (턴 처리 시 호출)
   * - 수입을 국가 금고에 추가
   * - 지출을 국가 금고에서 차감
   * - 급여를 장수들에게 지급
   */
  static async applyNationalFinance(
    sessionId: string,
    nationId: number
  ): Promise<NationalFinanceResult> {
    const finance = await this.getNationalFinance(sessionId, nationId);

    // 국가 금고 업데이트
    const nation = await Nation.findOne({ session_id: sessionId, 'data.nation': nationId });

    if (!nation) {
      throw new Error(`Nation not found: ${nationId}`);
    }

    const nationData = nation.data || {};
    const currentGold = nationData.gold || 0;
    const currentRice = nationData.rice || 0;

    const newGold = currentGold + finance.netIncome;

    await Nation.updateOne(
      { session_id: sessionId, 'data.nation': nationId },
      {
        $set: {
          'data.gold': Math.max(0, newGold),
          'data.rice': currentRice
        }
      }
    );

    // 급여 지급
    await this.distributeSalary(sessionId, nationId, finance.salaryExpense);

    logger.info('[NationalFinance] Finance applied', {
      sessionId,
      nationId,
      nationName: finance.nationName,
      totalIncome: finance.totalIncome,
      totalExpense: finance.totalExpense,
      netIncome: finance.netIncome,
      newGold
    });

    return finance;
  }

  /**
   * 급여 지급
   * - 지급률에 따라 장수들에게 급여 분배
   */
  private static async distributeSalary(
    sessionId: string,
    nationId: number,
    totalSalary: number
  ): Promise<void> {
    const generals = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.npc': { $lt: 2 } // NPC 제외
    });

    if (generals.length === 0) {
      return;
    }

    // 장수별 급여 = 총 급여 / 장수 수 (단순 분배)
    const salaryPerGeneral = Math.floor(totalSalary / generals.length);

    for (const general of generals) {
      const generalData = general.data || {};
      const currentGold = generalData.gold || 0;

      await General.updateOne(
        { session_id: sessionId, no: general.no },
        {
          $set: {
            'data.gold': currentGold + salaryPerGeneral
          }
        }
      );
    }

    logger.info('[NationalFinance] Salary distributed', {
      sessionId,
      nationId,
      totalSalary,
      generalCount: generals.length,
      salaryPerGeneral
    });
  }
}
