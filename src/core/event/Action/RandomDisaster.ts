// @ts-nocheck - Type issues with Mongoose models
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { General } from '../../../models/general.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveCity, saveGeneral } from '../../../common/cache/model-cache.helper';
import { unitStackRepository } from '../../../repositories/unit-stack.repository';
import { UnitStack } from '../../../models/unit_stack.model';
import { SabotageInjury } from '../../../utils/SabotageInjury';
import { RandUtil } from '../../../utils/RandUtil';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';

// PHP 버전과 동일한 재해 타입
type DisasterType = 'plague' | 'earthquake' | 'typhoon' | 'flood' | 'locust' | 'cold' | 'bandit';

interface DisasterConfig {
  name: string;
  icon: string;
  effects: {
    pop?: number;      // 인구 감소율 (0.1 = 10%)
    agri?: number;     // 농업 감소율
    comm?: number;     // 상업 감소율
    trust?: number;    // 민심 감소
    troops?: number;   // 병사 감소율 (역병)
    wall?: number;     // 성벽 피해율 (지진)
    gold?: number;     // 금 약탈율 (황건적)
    rice?: number;     // 군량 약탈율 (황건적)
  };
  message: string;
  stateCode: number;   // 도시 상태 코드 (이벤트 아이콘)
}

// PHP 버전과 동일한 state 코드 사용
// 1: 풍작, 2: 호황, 3: 혹한/눈, 4: 역병, 5: 지진, 6: 태풍, 7: 홍수, 8: 메뚜기/흉년, 9: 황건적
const DISASTER_CONFIGS: Record<DisasterType, DisasterConfig> = {
  plague: {
    name: '역병',
    icon: '🦠',
    effects: { pop: 0.15, troops: 0.10, trust: 10 },
    message: '역병이 창궐하여 백성들이 쓰러지고 있습니다.',
    stateCode: 4 // event4.gif (PHP와 동일)
  },
  earthquake: {
    name: '지진',
    icon: '🏚️',
    effects: { pop: 0.08, agri: 0.10, comm: 0.15, trust: 8, wall: 0.20 },
    message: '지진으로 피해가 속출하고 있습니다.',
    stateCode: 5 // event5.gif (PHP와 동일)
  },
  typhoon: {
    name: '태풍',
    icon: '🌪️',
    effects: { pop: 0.06, agri: 0.15, comm: 0.10, trust: 6 },
    message: '태풍으로 인해 피해가 속출하고 있습니다.',
    stateCode: 6 // event6.gif (PHP와 동일)
  },
  flood: {
    name: '홍수',
    icon: '🌊',
    effects: { pop: 0.08, agri: 0.20, comm: 0.10, trust: 8 },
    message: '홍수로 인해 피해가 급증하고 있습니다.',
    stateCode: 7 // event7.gif (PHP와 동일)
  },
  locust: {
    name: '메뚜기떼',
    icon: '🦗',
    effects: { agri: 0.25, trust: 3 },
    message: '메뚜기떼가 농작물을 모두 먹어치웠습니다.',
    stateCode: 8 // event8.gif (PHP와 동일)
  },
  cold: {
    name: '혹한',
    icon: '❄️',
    effects: { pop: 0.05, agri: 0.10, trust: 5 },
    message: '추위가 풀리지 않아 얼어죽는 백성들이 늘어나고 있습니다.',
    stateCode: 3 // event3.gif (PHP와 동일)
  },
  bandit: {
    name: '황건적',
    icon: '⚔️',
    effects: { pop: 0.10, trust: 15, gold: 0.20, rice: 0.20 },
    message: '황건적이 출현해 도시를 습격하고 있습니다.',
    stateCode: 9 // event9.gif (PHP와 동일)
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
    const startYear = env['startyear'] || 184;
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // PHP와 동일: 분기별(1, 4, 7, 10월)에만 재해 발생
    if (![1, 4, 7, 10].includes(month)) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'not_quarter' };
    }

    // PHP와 동일: 초반 3년은 스킵
    if (startYear + 3 > year) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'early_years' };
    }

    const cities = await City.find({ session_id: sessionId }).exec();
    const affectedCities: string[] = [];

    // PHP와 동일: 분기별 재해 타입 목록
    const disastersByQuarter: Record<number, DisasterType[]> = {
      1: ['plague', 'earthquake', 'cold', 'bandit'],      // 겨울/봄: 역병, 지진, 혹한, 황건적
      4: ['flood', 'earthquake', 'typhoon'],               // 봄/여름: 홍수, 지진, 태풍
      7: ['locust', 'earthquake', 'locust'],               // 여름/가을: 메뚜기, 지진, 흉년
      10: ['cold', 'earthquake', 'cold', 'bandit'],        // 가을/겨울: 혹한, 지진, 눈, 황건적
    };

    const availableDisasters = disastersByQuarter[month] || ['earthquake'];
    const selectedType = availableDisasters[Math.floor(Math.random() * availableDisasters.length)];

    for (const city of cities) {
      // PHP와 동일: secu(치안) 기반 확률 계산
      const secuMax = city.secu_max || 1000;
      const secu = city.secu || 0;
      const secuRatio = secuMax > 0 ? secu / secuMax : 0;
      
      // 재해 발생 확률: 기본 6% - 치안 보너스 (1~6%)
      const raiseProp = 0.06 - secuRatio * 0.05;
      
      if (Math.random() > raiseProp) continue;

      const config = DISASTER_CONFIGS[selectedType];
      const cityName = city.name || `도시 ${city.city}`;
      const nationId = city.nation || 0;

      // PHP와 동일: secu 기반 피해 비율 계산 (치안 높으면 피해 감소)
      const affectSecuRatio = secuMax > 0 ? Math.min(secu / secuMax / 0.8, 1) : 0;
      const affectRatio = 0.8 + affectSecuRatio * 0.15; // 80% ~ 95%

      // 효과 적용
      if (config.effects.pop) {
        city.pop = Math.max(1000, Math.floor((city.pop || 0) * affectRatio));
      }
      if (config.effects.agri) {
        city.agri = Math.max(0, Math.floor((city.agri || 0) * affectRatio));
      }
      if (config.effects.comm) {
        city.comm = Math.max(0, Math.floor((city.comm || 0) * affectRatio));
      }
      if (config.effects.trust) {
        city.trust = Math.max(0, Math.floor((city.trust || 50) * affectRatio));
      }
      // 치안도 감소 (PHP와 동일)
      city.secu = Math.max(0, Math.floor((city.secu || 0) * affectRatio));
      // 방어/성벽 피해 (지진 등)
      if (config.effects.wall) {
        city.def = Math.max(0, Math.floor((city.def || 0) * affectRatio));
        city.wall = Math.max(0, Math.floor((city.wall || 0) * affectRatio));
      }
      // 자금/군량 약탈 (황건적)
      if (config.effects.gold) {
        city.gold = Math.max(0, Math.floor((city.gold || 0) * (1 - config.effects.gold)));
      }
      if (config.effects.rice) {
        city.rice = Math.max(0, Math.floor((city.rice || 0) * (1 - config.effects.rice)));
      }

      // 도시 상태 설정 (이벤트 아이콘 표시용)
      city.state = config.stateCode;
      // PHP와 다르게 term 기반 초기화 사용 (다음 분기까지 표시)

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
      const logger = new ActionLogger(0, nationId, year, month, sessionId);
      logger.pushGlobalHistoryLog(
        `<R><b>【${config.icon} ${config.name}】</b></><Y>${cityName}</>에 ${config.message}`
      );
      await logger.flush();

      // 해당 도시 장수들에게도 알림 및 부상 처리
      const cityGenerals = await General.find({
        session_id: sessionId,
        $or: [{ city: city.city }, { 'data.city': city.city }]
      });
      
      for (const general of cityGenerals) {
        const generalLogger = new ActionLogger(general.no || general.data?.no || 0, nationId, year, month, sessionId);
        generalLogger.pushGeneralActionLog(
          `<R>${config.icon} ${config.name}</> - ${config.message}`,
          ActionLogger.PLAIN
        );
        await generalLogger.flush();
      }

      // PHP와 동일: SabotageInjury로 장수 부상 처리
      // PHP RaiseDisaster.php line 144: SabotageInjury($rng, $generalList, '재난');
      const rng = new RandUtil(new LiteHashDRBG(`disaster_injury_${year}_${month}_${city.city}`));
      await SabotageInjury(rng, cityGenerals, '재난', async (general) => {
        const generalId = general.data?.no || general.no;
        if (generalId) {
          const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
          await saveGeneral(sessionId, generalId, generalData);
        }
      });
    }

    return { 
      action: 'RandomDisaster', 
      affectedCities,
      count: affectedCities.length 
    };
  }
}

