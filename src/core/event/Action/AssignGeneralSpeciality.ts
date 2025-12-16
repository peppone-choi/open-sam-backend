/**
 * AssignGeneralSpeciality.ts
 * 장수 특기 자동 부여 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/AssignGeneralSpeciality.php
 * 
 * 게임 시작 3년 이후부터:
 * - specage <= age 이고 내정특기가 기본값인 장수에게 내정특기 부여
 * - specage2 <= age 이고 전투특기가 기본값인 장수에게 전투특기 부여
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';
import { JosaUtil } from '../../../utils/JosaUtil';

// 기본 특기 값
const DEFAULT_SPECIAL_DOMESTIC = 'None';  // GameConst.$defaultSpecialDomestic
const DEFAULT_SPECIAL_WAR = 'None';       // GameConst.$defaultSpecialWar

// 내정특기 목록 (가중치와 함께)
const DOMESTIC_SPECIALITIES = [
  { id: 'che_경작', name: '경작', weight: 1.0 },
  { id: 'che_상재', name: '상재', weight: 1.0 },
  { id: 'che_발명', name: '발명', weight: 1.0 },
  { id: 'che_축성', name: '축성', weight: 1.0 },
  { id: 'che_수비', name: '수비', weight: 1.0 },
  { id: 'che_통찰', name: '통찰', weight: 1.0 },
  { id: 'che_인덕', name: '인덕', weight: 1.0 },
  { id: 'che_귀모', name: '귀모', weight: 1.0 },
];

// 전투특기 목록 (가중치와 함께)
const WAR_SPECIALITIES = [
  { id: 'che_격노', name: '격노', weight: 1.0 },
  { id: 'che_견고', name: '견고', weight: 1.0 },
  { id: 'che_공성', name: '공성', weight: 1.0 },
  { id: 'che_궁병', name: '궁병', weight: 1.0 },
  { id: 'che_귀병', name: '귀병', weight: 1.0 },
  { id: 'che_기병', name: '기병', weight: 1.0 },
  { id: 'che_돌격', name: '돌격', weight: 1.0 },
  { id: 'che_무쌍', name: '무쌍', weight: 0.5 },  // 희귀
  { id: 'che_반계', name: '반계', weight: 1.0 },
  { id: 'che_보병', name: '보병', weight: 1.0 },
  { id: 'che_신산', name: '신산', weight: 1.0 },
  { id: 'che_신중', name: '신중', weight: 0.5 },  // 희귀
  { id: 'che_위압', name: '위압', weight: 1.0 },
  { id: 'che_의술', name: '의술', weight: 1.0 },
  { id: 'che_저격', name: '저격', weight: 1.0 },
  { id: 'che_집중', name: '집중', weight: 1.0 },
  { id: 'che_징병', name: '징병', weight: 1.0 },
  { id: 'che_척사', name: '척사', weight: 1.0 },
  { id: 'che_필살', name: '필살', weight: 1.0 },
  { id: 'che_환술', name: '환술', weight: 1.0 },
];

/**
 * 장수 특기 자동 부여 액션
 */
export class AssignGeneralSpeciality extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const startYear = env['startyear'] || 184;
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 게임 시작 3년 이후부터 실행
    if (year < startYear + 3) {
      return [AssignGeneralSpeciality.name, false, 'too early'];
    }

    // 시드 생성
    const seed = `${sessionId}_assignGeneralSpeciality_${year}_${month}`;
    const rng = new RandUtil(new LiteHashDRBG(seed));

    let assignedDomestic = 0;
    let assignedWar = 0;

    // 내정특기 부여 대상 장수 조회
    const domesticTargets = await General.find({
      session_id: sessionId,
      'data.special': DEFAULT_SPECIAL_DOMESTIC,
      $expr: { $lte: ['$data.specage', '$data.age'] }
    });

    for (const general of domesticTargets) {
      const generalId = general.no;
      const generalData = general.data || {};
      const prevTypes = generalData.aux?.prev_types_special || [];

      // 내정특기 선택
      const special = this.pickSpecialDomestic(rng, generalData, prevTypes);
      const specialName = this.getSpecialDomesticName(special);

      // 업데이트
      generalData.special = special;
      general.data = generalData;
      await saveGeneral(sessionId, generalId, general.toObject());

      // 로그
      const logger = new ActionLogger(generalId, general.nation || 0, year, month, sessionId);
      const josaUl = JosaUtil.pick(specialName, '을');
      logger.pushGeneralActionLog(`특기 【<b><L>${specialName}</></b>】${josaUl} 익혔습니다!`);
      logger.pushGeneralHistoryLog(`특기 【<b><C>${specialName}</></b>】${josaUl} 습득`);
      await logger.flush();

      assignedDomestic++;
    }

    // 전투특기 부여 대상 장수 조회
    const warTargets = await General.find({
      session_id: sessionId,
      'data.special2': DEFAULT_SPECIAL_WAR,
      $expr: { $lte: ['$data.specage2', '$data.age'] }
    });

    for (const general of warTargets) {
      const generalId = general.no;
      const generalData = general.data || {};
      const generalAux = generalData.aux || {};
      const prevTypes = generalAux.prev_types_special2 || [];

      let special2: string;

      // 상속 지정 특기가 있으면 사용
      if (generalAux.inheritSpecificSpecialWar) {
        special2 = generalAux.inheritSpecificSpecialWar;
        delete generalAux.inheritSpecificSpecialWar;
        generalData.aux = generalAux;
      } else {
        // 전투특기 선택
        special2 = this.pickSpecialWar(rng, generalData, prevTypes);
      }

      const specialName = this.getSpecialWarName(special2);

      // 업데이트
      generalData.special2 = special2;
      general.data = generalData;
      await saveGeneral(sessionId, generalId, general.toObject());

      // 로그
      const logger = new ActionLogger(generalId, general.nation || 0, year, month, sessionId);
      const josaUl = JosaUtil.pick(specialName, '을');
      logger.pushGeneralActionLog(`특기 【<b><L>${specialName}</></b>】${josaUl} 익혔습니다!`);
      logger.pushGeneralHistoryLog(`특기 【<b><C>${specialName}</></b>】${josaUl} 습득`);
      await logger.flush();

      assignedWar++;
    }

    return [AssignGeneralSpeciality.name, true, { assignedDomestic, assignedWar }];
  }

  /**
   * 내정특기 선택
   */
  private pickSpecialDomestic(rng: RandUtil, general: any, prevTypes: string[]): string {
    const filtered = DOMESTIC_SPECIALITIES.filter(s => !prevTypes.includes(s.id));
    if (filtered.length === 0) {
      return DOMESTIC_SPECIALITIES[rng.nextRangeInt(0, DOMESTIC_SPECIALITIES.length - 1)].id;
    }
    return this.weightedPick(rng, filtered);
  }

  /**
   * 전투특기 선택
   */
  private pickSpecialWar(rng: RandUtil, general: any, prevTypes: string[]): string {
    const filtered = WAR_SPECIALITIES.filter(s => !prevTypes.includes(s.id));
    if (filtered.length === 0) {
      return WAR_SPECIALITIES[rng.nextRangeInt(0, WAR_SPECIALITIES.length - 1)].id;
    }
    return this.weightedPick(rng, filtered);
  }

  /**
   * 가중치 기반 선택
   */
  private weightedPick(rng: RandUtil, items: { id: string; weight: number }[]): string {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = rng.nextRange(0, totalWeight);
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item.id;
      }
    }
    
    return items[items.length - 1].id;
  }

  /**
   * 내정특기 이름 조회
   */
  private getSpecialDomesticName(id: string): string {
    const found = DOMESTIC_SPECIALITIES.find(s => s.id === id);
    return found?.name || id;
  }

  /**
   * 전투특기 이름 조회
   */
  private getSpecialWarName(id: string): string {
    const found = WAR_SPECIALITIES.find(s => s.id === id);
    return found?.name || id;
  }
}








