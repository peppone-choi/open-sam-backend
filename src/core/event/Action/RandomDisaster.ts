// @ts-nocheck - Type issues with Mongoose models
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { General } from '../../../models/general.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveCity, saveGeneral } from '../../../common/cache/model-cache.helper';
import { unitStackRepository } from '../../../repositories/unit-stack.repository';
import { UnitStack } from '../../../models/unit_stack.model';

type DisasterType = 'drought' | 'flood' | 'plague' | 'locust';

interface DisasterConfig {
  name: string;
  icon: string;
  effects: {
    pop?: number;      // 인구 감소율 (0.1 = 10%)
    agri?: number;     // 농업 감소율
    comm?: number;     // 상업 감소율
    trust?: number;    // 민심 감소
    troops?: number;   // 병사 감소율 (역병)
  };
  message: string;
}

const DISASTER_CONFIGS: Record<DisasterType, DisasterConfig> = {
  drought: {
    name: '가뭄',
    icon: '☀️',
    effects: { pop: 0.05, agri: 0.15, trust: 5 },
    message: '가뭄으로 인해 농작물이 말라버렸습니다.'
  },
  flood: {
    name: '홍수',
    icon: '🌊',
    effects: { pop: 0.08, agri: 0.20, comm: 0.10, trust: 8 },
    message: '홍수로 인해 도시가 큰 피해를 입었습니다.'
  },
  plague: {
    name: '역병',
    icon: '🦠',
    effects: { pop: 0.15, troops: 0.10, trust: 10 },
    message: '역병이 창궐하여 백성들이 쓰러지고 있습니다.'
  },
  locust: {
    name: '메뚜기떼',
    icon: '🦗',
    effects: { agri: 0.25, trust: 3 },
    message: '메뚜기떼가 농작물을 모두 먹어치웠습니다.'
  }
};

/**
 * 랜덤 재해 이벤트
 * 특정 확률로 도시에 재해 발생
 */
export class RandomDisaster extends Action {
  private chance: number;

  constructor(chance: number = 0.05) { // 기본 5% 확률
    super();
    this.chance = chance;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    const cities = await City.find({ session_id: sessionId, nation: { $ne: 0 } }).exec();
    const affectedCities: string[] = [];

    for (const city of cities) {
      // 각 도시별 재해 발생 확률 체크
      if (Math.random() > this.chance) continue;

      // 랜덤 재해 타입 선택
      const disasterTypes: DisasterType[] = ['drought', 'flood', 'plague', 'locust'];
      
      // 계절에 따른 재해 확률 조정
      let weights = [1, 1, 1, 1];
      if (month >= 6 && month <= 8) { // 여름: 홍수, 역병 확률 증가
        weights = [0.5, 2, 1.5, 1];
      } else if (month >= 3 && month <= 5) { // 봄: 메뚜기 확률 증가
        weights = [1, 0.5, 0.5, 2];
      } else if (month >= 9 && month <= 11) { // 가을: 가뭄 확률 증가
        weights = [2, 0.5, 1, 0.5];
      }

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalWeight;
      let selectedType: DisasterType = 'drought';
      
      for (let i = 0; i < disasterTypes.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedType = disasterTypes[i];
          break;
        }
      }

      const config = DISASTER_CONFIGS[selectedType];
      const cityName = city.name || `도시 ${city.city}`;
      const nationId = city.nation || 0;

      // 효과 적용
      if (config.effects.pop) {
        const reduction = Math.floor((city.pop || 0) * config.effects.pop);
        city.pop = Math.max(1000, (city.pop || 0) - reduction);
      }
      if (config.effects.agri) {
        const reduction = Math.floor((city.agri || 0) * config.effects.agri);
        city.agri = Math.max(0, (city.agri || 0) - reduction);
      }
      if (config.effects.comm) {
        const reduction = Math.floor((city.comm || 0) * config.effects.comm);
        city.comm = Math.max(0, (city.comm || 0) - reduction);
      }
      if (config.effects.trust) {
        city.trust = Math.max(0, (city.trust || 50) - config.effects.trust);
      }

      // 역병인 경우 해당 도시 병사들에게도 피해
      if (selectedType === 'plague' && config.effects.troops) {
        const generals = await General.find({ 
          session_id: sessionId, 
          $or: [{ city: city.city }, { 'data.city': city.city }]
        });
        
        for (const general of generals) {
          const generalNo = general.no || general.data?.no;
          const stacks = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
          for (const stack of stacks) {
            const reduction = Math.floor((stack.hp || 0) * config.effects.troops);
            if (reduction > 0) {
              const newHp = Math.max(100, (stack.hp || 0) - reduction);
              const stackId = (stack as any)._id || (stack as any).id;
              if (stackId) {
                await UnitStack.updateOne({ _id: stackId }, { $set: { hp: newHp } });
              }
            }
          }
          
          // 레거시 crew 필드도 업데이트
          if (general.data?.crew) {
            const reduction = Math.floor(general.data.crew * config.effects.troops);
            general.data.crew = Math.max(0, general.data.crew - reduction);
            const generalId = general.data?.no || general.no;
            const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
            await saveGeneral(sessionId, generalId, generalData);
          }
        }
      }

      // 도시 저장
      const cityData = city.toObject ? city.toObject() : { ...city, session_id: sessionId };
      await saveCity(sessionId, city.city, cityData);

      affectedCities.push(cityName);

      // 로그 기록
      const logger = new ActionLogger(0, nationId, year, month);
      logger.pushGlobalHistoryLog(
        `<R><b>【${config.icon} ${config.name}】</b></><Y>${cityName}</>에 ${config.message}`
      );
      await logger.flush();

      // 해당 도시 장수들에게도 알림
      const cityGenerals = await General.find({
        session_id: sessionId,
        $or: [{ city: city.city }, { 'data.city': city.city }]
      });
      
      for (const general of cityGenerals) {
        const generalLogger = new ActionLogger(general.no || general.data?.no || 0, nationId, year, month);
        generalLogger.pushGeneralActionLog(
          `<R>${config.icon} ${config.name}</> - ${config.message}`,
          ActionLogger.PLAIN
        );
        await generalLogger.flush();
      }
    }

    return { 
      action: 'RandomDisaster', 
      affectedCities,
      count: affectedCities.length 
    };
  }
}

