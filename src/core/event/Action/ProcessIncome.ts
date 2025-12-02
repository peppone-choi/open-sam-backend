// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { getGoldIncome, getRiceIncome, getWallIncome, getOutcome, getBill } from '../../../utils/income-util';
import { Util } from '../../../utils/Util';
import { ActionLogger } from '../../../types/ActionLogger';
import { NationEnv } from '../../../models/nation-env.model';
import { saveNation, saveGeneral } from '../../../common/cache/model-cache.helper';

/**
 * 수입 처리 액션
 * PHP ProcessIncome Action과 동일한 구조
 */
export class ProcessIncome extends Action {
  private resource: 'gold' | 'rice';

  constructor(resource: string) {
    super();
    if (resource !== 'gold' && resource !== 'rice') {
      throw new Error('잘못된 자원 타입');
    }
    this.resource = resource;
  }

  async run(env: any): Promise<any> {
    if (this.resource === 'gold') {
      return await this.processGoldIncome(env);
    } else {
      return await this.processRiceIncome(env);
    }
  }

  private async processGoldIncome(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    const nations = await Nation.find({ session_id: sessionId });
    const cities = await City.find({ session_id: sessionId });
    const generals = await General.find({ session_id: sessionId });

    // 국가별 도시 및 장수 그룹화
    const cityListByNation: Record<number, any[]> = {};
    const generalListByNation: Record<number, any[]> = {};

    for (const city of cities) {
      const nationId = city.nation || 0;
      if (!cityListByNation[nationId]) {
        cityListByNation[nationId] = [];
      }
      cityListByNation[nationId].push(city);
    }

    for (const general of generals) {
      const nationId = general.nation || 0;
      if (!generalListByNation[nationId]) {
        generalListByNation[nationId] = [];
      }
      generalListByNation[nationId].push(general);
    }

    // 국가별 처리
    for (const nation of nations) {
      const nationId = nation.nation || 0;
      const generalList = generalListByNation[nationId] || [];
      const cityList = cityListByNation[nationId] || [];

      // officerCnt 계산 (officer_level IN (2,3,4) AND city = officer_city)
      const officersCnt: Record<number, number> = {};
      for (const general of generalList) {
        const officerLevel = general.data?.officer_level || 0;
        const officerCity = general.data?.officer_city || 0;
        const generalCity = general.city || general.data?.city || 0;
        
        if ([2, 3, 4].includes(officerLevel) && officerCity === generalCity && officerCity > 0) {
          officersCnt[officerCity] = (officersCnt[officerCity] || 0) + 1;
        }
      }

      const income = getGoldIncome(
        nationId,
        nation.data?.level || 0,
        nation.data?.rate_tmp || 100,
        nation.data?.capital || 0,
        nation.data?.type || 'normal',
        cityList,
        officersCnt
      );
      
      const originOutcome = getOutcome(100, generalList);
      
      const bill = nation.data?.bill || 100;
      const outcome = Math.round(bill / 100 * originOutcome);
      
      const currentGold = nation.data?.gold || 0;
      const baseGold = 1000; // GameConst.basegold
      
      let realOutcome = 0;
      let ratio = 0;
      
      const newGold = currentGold + income;
      
      if (newGold < baseGold) {
        realOutcome = 0;
        ratio = 0;
        nation.data.gold = newGold;
      } else if (newGold - baseGold < outcome) {
        realOutcome = newGold - baseGold;
        nation.data.gold = baseGold;
        ratio = originOutcome > 0 ? realOutcome / originOutcome : 0;
      } else {
        realOutcome = outcome;
        nation.data.gold = newGold - realOutcome;
        ratio = originOutcome > 0 ? realOutcome / originOutcome : 1;
      }

        nation.data.gold = Math.max(nation.data.gold, baseGold);
        
        // CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
        const nationData = nation.toObject ? nation.toObject() : { ...nation.data, session_id: sessionId, nation: nationId };
        await saveNation(sessionId, nationId, nationData);

      // nation_env에 prev_income_gold 저장
      await NationEnv.findOneAndUpdate(
        {
          session_id: sessionId,
          namespace: nationId,
          key: 'prev_income_gold'
        },
        {
          session_id: sessionId,
          namespace: nationId,
          key: 'prev_income_gold',
          value: income
        },
        { upsert: true }
      );

      // 각 장수들에게 지급
      const incomeText = Util.numberFormat(income);
      const incomeLog = `이번 수입은 금 <C>${incomeText}</>입니다.`;

      for (const general of generalList) {
        const dedication = general.data?.dedication || 0;
        const gold = Math.round(getBill(dedication) * ratio);
        
        general.data.gold = (general.data?.gold || 0) + gold;
        
        // CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
        const generalId = general.data?.no || 0;
        const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
        await saveGeneral(sessionId, generalId, generalData);
        const logger = new ActionLogger(generalId, nationId, year, month);
        
        if (general.data?.officer_level && general.data.officer_level > 4) {
          logger.pushGeneralActionLog(incomeLog, ActionLogger.PLAIN);
        }
        const goldText = Util.numberFormat(gold);
        logger.pushGeneralActionLog(`봉급으로 금 <C>${goldText}</>을 받았습니다.`, ActionLogger.PLAIN);
        await logger.flush();
      }
    }

    const logger = new ActionLogger(0, 0, year, month);
    logger.pushGlobalHistoryLog('<W><b>【지급】</b></>봄이 되어 봉록에 따라 자금이 지급됩니다.');
    await logger.flush();

    return [ProcessIncome.name, 'gold'];
  }

  private async processRiceIncome(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    const nations = await Nation.find({ session_id: sessionId });
    const cities = await City.find({ session_id: sessionId });
    const generals = await General.find({ session_id: sessionId });

    // 국가별 도시 및 장수 그룹화
    const cityListByNation: Record<number, any[]> = {};
    const generalListByNation: Record<number, any[]> = {};

    for (const city of cities) {
      const nationId = city.nation || 0;
      if (!cityListByNation[nationId]) {
        cityListByNation[nationId] = [];
      }
      cityListByNation[nationId].push(city);
    }

    for (const general of generals) {
      const nationId = general.nation || 0;
      if (!generalListByNation[nationId]) {
        generalListByNation[nationId] = [];
      }
      generalListByNation[nationId].push(general);
    }

    // 국가별 처리
    for (const nation of nations) {
      const nationId = nation.nation || 0;
      const generalList = generalListByNation[nationId] || [];
      const cityList = cityListByNation[nationId] || [];

      // officerCnt 계산
      const officersCnt: Record<number, number> = {};
      for (const general of generalList) {
        const officerLevel = general.data?.officer_level || 0;
        const officerCity = general.data?.officer_city || 0;
        const generalCity = general.city || general.data?.city || 0;
        
        if ([2, 3, 4].includes(officerLevel) && officerCity === generalCity && officerCity > 0) {
          officersCnt[officerCity] = (officersCnt[officerCity] || 0) + 1;
        }
      }

      const income = getRiceIncome(
        nationId,
        nation.data?.level || 0,
        nation.data?.rate_tmp || 100,
        nation.data?.capital || 0,
        nation.data?.type || 'normal',
        cityList,
        officersCnt
      );

      const wallIncome = getWallIncome(
        nationId,
        nation.data?.level || 0,
        nation.data?.rate_tmp || 100,
        nation.data?.capital || 0,
        nation.data?.type || 'normal',
        cityList,
        officersCnt
      );

      const totalIncome = income + wallIncome;
      const originOutcome = getOutcome(100, generalList);
      
      const bill = nation.data?.bill || 100;
      const outcome = Math.round(bill / 100 * originOutcome);
      
      const currentRice = nation.data?.rice || 0;
      const baseRice = 2000; // GameConst.baserice
      
      let realOutcome = 0;
      let ratio = 0;
      
      const newRice = currentRice + totalIncome;
      
      if (newRice < baseRice) {
        realOutcome = 0;
        ratio = 0;
        nation.data.rice = newRice;
      } else if (newRice - baseRice < outcome) {
        realOutcome = newRice - baseRice;
        nation.data.rice = baseRice;
        ratio = originOutcome > 0 ? realOutcome / originOutcome : 0;
      } else {
        realOutcome = outcome;
        nation.data.rice = newRice - realOutcome;
        ratio = originOutcome > 0 ? realOutcome / originOutcome : 1;
      }

      nation.data.rice = Math.max(nation.data.rice, baseRice);
      
      // CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
      const nationData = nation.toObject ? nation.toObject() : { ...nation.data, session_id: sessionId, nation: nationId };
      await saveNation(sessionId, nationId, nationData);

      // nation_env에 prev_income_rice 저장
      await NationEnv.findOneAndUpdate(
        {
          session_id: sessionId,
          namespace: nationId,
          key: 'prev_income_rice'
        },
        {
          session_id: sessionId,
          namespace: nationId,
          key: 'prev_income_rice',
          value: totalIncome
        },
        { upsert: true }
      );

      // 각 장수들에게 지급
      const incomeText = Util.numberFormat(totalIncome);
      const incomeLog = `이번 수입은 쌀 <C>${incomeText}</>입니다.`;

      for (const general of generalList) {
        const dedication = general.data?.dedication || 0;
        const rice = Math.round(getBill(dedication) * ratio);
        
        general.data.rice = (general.data?.rice || 0) + rice;
        
        // CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
        const generalId = general.data?.no || 0;
        const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
        await saveGeneral(sessionId, generalId, generalData);
        const logger = new ActionLogger(generalId, nationId, year, month);
        
        if (general.data?.officer_level && general.data.officer_level > 4) {
          logger.pushGeneralActionLog(incomeLog, ActionLogger.PLAIN);
        }
        const riceText = Util.numberFormat(rice);
        logger.pushGeneralActionLog(`봉급으로 쌀 <C>${riceText}</>을 받았습니다.`, ActionLogger.PLAIN);
        await logger.flush();
      }
    }

    const logger = new ActionLogger(0, 0, year, month);
    logger.pushGlobalHistoryLog('<W><b>【지급】</b></>가을이 되어 봉록에 따라 군량이 지급됩니다.');
    await logger.flush();

    return [ProcessIncome.name, 'rice'];
  }
}

