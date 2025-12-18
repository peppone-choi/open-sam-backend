// @ts-nocheck - Type issues with Mongoose models
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { General } from '../../../models/general.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveCity, saveGeneral } from '../../../common/cache/model-cache.helper';
import { SabotageInjury } from '../../../utils/SabotageInjury';
import { RandUtil } from '../../../utils/RandUtil';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';

/**
 * RandomDisaster (PHP RaiseDisaster.php와 동일)
 * 분기별 재해 또는 호황 이벤트 처리
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/RaiseDisaster.php
 */

// PHP와 동일한 재해/호황 텍스트 목록
// [로그 타이틀, state 코드, 로그 메시지]
const DISASTER_TEXT_LIST: Record<number, [string, number, string][]> = {
  1: [
    ['<M><b>【재난】</b></>', 4, '역병이 발생하여 도시가 황폐해지고 있습니다.'],
    ['<M><b>【재난】</b></>', 5, '지진으로 피해가 속출하고 있습니다.'],
    ['<M><b>【재난】</b></>', 3, '추위가 풀리지 않아 얼어죽는 백성들이 늘어나고 있습니다.'],
    ['<M><b>【재난】</b></>', 9, '황건적이 출현해 도시를 습격하고 있습니다.'],
  ],
  4: [
    ['<M><b>【재난】</b></>', 7, '홍수로 인해 피해가 급증하고 있습니다.'],
    ['<M><b>【재난】</b></>', 5, '지진으로 피해가 속출하고 있습니다.'],
    ['<M><b>【재난】</b></>', 6, '태풍으로 인해 피해가 속출하고 있습니다.'],
  ],
  7: [
    ['<M><b>【재난】</b></>', 8, '메뚜기 떼가 발생하여 도시가 황폐해지고 있습니다.'],
    ['<M><b>【재난】</b></>', 5, '지진으로 피해가 속출하고 있습니다.'],
    ['<M><b>【재난】</b></>', 8, '흉년이 들어 굶어죽는 백성들이 늘어나고 있습니다.'],
  ],
  10: [
    ['<M><b>【재난】</b></>', 3, '혹한으로 도시가 황폐해지고 있습니다.'],
    ['<M><b>【재난】</b></>', 5, '지진으로 피해가 속출하고 있습니다.'],
    ['<M><b>【재난】</b></>', 3, '눈이 많이 쌓여 도시가 황폐해지고 있습니다.'],
    ['<M><b>【재난】</b></>', 9, '황건적이 출현해 도시를 습격하고 있습니다.'],
  ]
};

// PHP와 동일한 호황/풍작 텍스트 목록
const BOOMING_TEXT_LIST: Record<number, [string, number, string][] | null> = {
  1: null,  // 1월은 호황 없음
  4: [
    ['<C><b>【호황】</b></>', 2, '호황으로 도시가 번창하고 있습니다.'],
  ],
  7: [
    ['<C><b>【풍작】</b></>', 1, '풍작으로 도시가 번창하고 있습니다.'],
  ],
  10: null  // 10월은 호황 없음
};

// PHP와 동일한 호황 발생 확률 (분기별)
const BOOMING_RATE: Record<number, number> = {
  1: 0,
  4: 0.25,
  7: 0.25,
  10: 0
};

/**
 * 랜덤 재해/호황 이벤트
 * PHP RaiseDisaster.php와 완전히 동일한 로직
 */
export class RandomDisaster extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const startYear = env['startyear'] || 184;
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // PHP와 동일: 분기별(1, 4, 7, 10월)에만 실행
    if (![1, 4, 7, 10].includes(month)) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'not_quarter' };
    }

    // 시드 기반 RNG 생성 (PHP와 동일)
    const rng = new RandUtil(new LiteHashDRBG(`${sessionId}_disaster_${year}_${month}`));

    // 재난표시 초기화 (state <= 10인 도시들)
    await City.updateMany(
      { session_id: sessionId, state: { $lte: 10 } },
      { $set: { state: 0 } }
    );

    // PHP와 동일: 초반 3년은 스킵
    if (startYear + 3 > year) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'early_years' };
    }

    // PHP와 동일: 호황 여부 결정
    const boomingRate = BOOMING_RATE[month] || 0;
    const isGood = rng.nextBool(boomingRate);

    // 도시 목록 조회
    const cities = await City.find({ session_id: sessionId });
    const targetCityList: any[] = [];

    // PHP와 동일: 도시별 이벤트 발생 확률 계산
    for (const city of cities) {
      const secuMax = city.secu_max || 1000;
      const secu = city.secu || 0;
      const secuRatio = secuMax > 0 ? secu / secuMax : 0;

      let raiseProp: number;
      if (isGood) {
        // 호황 발생 확률: 2% + 치안 보너스 (2~7%)
        raiseProp = 0.02 + secuRatio * 0.05;
      } else {
        // 재해 발생 확률: 6% - 치안 보너스 (1~6%)
        raiseProp = 0.06 - secuRatio * 0.05;
      }

      if (rng.nextBool(raiseProp)) {
        targetCityList.push(city);
      }
    }

    // 대상 도시가 없으면 종료
    if (targetCityList.length === 0) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'no_target' };
    }

    // PHP와 동일: 이벤트 텍스트 선택
    const textList = isGood ? BOOMING_TEXT_LIST[month] : DISASTER_TEXT_LIST[month];
    if (!textList || textList.length === 0) {
      return { action: 'RandomDisaster', affectedCities: [], count: 0, skipped: 'no_text_list' };
    }

    const selectedText = textList[rng.nextRangeInt(0, textList.length - 1)];
    const [logTitle, stateCode, logBody] = selectedText;

    // 대상 도시 이름 목록
    const targetCityNames = '<G><b>' + targetCityList.map(c => c.name || `도시 ${c.city}`).join(' ') + '</b></>';

    // 글로벌 히스토리 로그
    const logger = new ActionLogger(0, 0, year, month, sessionId);
    logger.pushGlobalHistoryLog(`${logTitle}${targetCityNames}에 ${logBody}`);
    await logger.flush();

    const affectedCities: string[] = [];

    if (!isGood) {
      // ===== 재해 처리 =====
      // 대상 도시의 장수 목록 조회
      const cityIds = targetCityList.map(c => c.city);
      const cityGenerals = await General.find({
        session_id: sessionId,
        $or: [
          { city: { $in: cityIds } },
          { 'data.city': { $in: cityIds } }
        ]
      });

      // 도시별로 장수 그룹화
      const generalListByCity: Record<number, any[]> = {};
      for (const general of cityGenerals) {
        const cityId = general.city || general.data?.city || 0;
        if (!generalListByCity[cityId]) {
          generalListByCity[cityId] = [];
        }
        generalListByCity[cityId].push(general);
      }

      for (const city of targetCityList) {
        const secuMax = city.secu_max || 1000;
        const secu = city.secu || 0;
        const secuRatio = secuMax > 0 ? secu / secuMax : 0;

        // PHP와 동일: 피해 비율 계산 (치안 높으면 피해 감소)
        let affectRatio = Math.min(secuRatio / 0.8, 1);
        affectRatio = 0.8 + affectRatio * 0.15; // 80% ~ 95%

        // 도시 내정 감소
        city.state = stateCode;
        city.pop = Math.floor((city.pop || 0) * affectRatio);
        city.trust = Math.floor((city.trust || 50) * affectRatio);
        city.agri = Math.floor((city.agri || 0) * affectRatio);
        city.comm = Math.floor((city.comm || 0) * affectRatio);
        city.secu = Math.floor((city.secu || 0) * affectRatio);
        city.def = Math.floor((city.def || 0) * affectRatio);
        city.wall = Math.floor((city.wall || 0) * affectRatio);

        // 도시 저장
        await saveCity(sessionId, city.city, city.toObject ? city.toObject() : city);

        // PHP와 동일: 장수 부상 처리 (SabotageInjury)
        const generalList = generalListByCity[city.city] || [];
        if (generalList.length > 0) {
          const injuryRng = new RandUtil(new LiteHashDRBG(`disaster_injury_${year}_${month}_${city.city}`));
          await SabotageInjury(injuryRng, generalList, '재난', async (general) => {
            const generalId = general.data?.no || general.no;
            if (generalId) {
              const generalData = general.toObject ? general.toObject() : { ...general.data, session_id: sessionId, no: generalId };
              await saveGeneral(sessionId, generalId, generalData);
            }
          });
        }

        affectedCities.push(city.name || `도시 ${city.city}`);
      }
    } else {
      // ===== 호황/풍작 처리 =====
      for (const city of targetCityList) {
        const secuMax = city.secu_max || 1000;
        const secu = city.secu || 0;
        const secuRatio = secuMax > 0 ? secu / secuMax : 0;

        // PHP와 동일: 보너스 비율 계산 (치안 높으면 보너스 증가)
        let affectRatio = Math.min(secuRatio / 0.8, 1);
        affectRatio = 1.01 + affectRatio * 0.04; // 101% ~ 105%

        // 도시 내정 증가 (최대값 제한)
        city.state = stateCode;
        city.pop = Math.min(city.pop_max || 100000, Math.floor((city.pop || 0) * affectRatio));
        city.trust = Math.min(100, Math.floor((city.trust || 50) * affectRatio));
        city.agri = Math.min(city.agri_max || 999, Math.floor((city.agri || 0) * affectRatio));
        city.comm = Math.min(city.comm_max || 999, Math.floor((city.comm || 0) * affectRatio));
        city.secu = Math.min(city.secu_max || 1000, Math.floor((city.secu || 0) * affectRatio));
        city.def = Math.min(city.def_max || 999, Math.floor((city.def || 0) * affectRatio));
        city.wall = Math.min(city.wall_max || 999, Math.floor((city.wall || 0) * affectRatio));

        // 도시 저장
        await saveCity(sessionId, city.city, city.toObject ? city.toObject() : city);

        affectedCities.push(city.name || `도시 ${city.city}`);
      }
    }

    return {
      action: 'RandomDisaster',
      affectedCities,
      count: affectedCities.length,
      eventType: isGood ? 'booming' : 'disaster',
      stateCode
    };
  }
}
