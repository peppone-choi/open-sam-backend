/**
 * CreateManyNPC.ts
 * 대량 NPC 생성 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/CreateManyNPC.php
 * 
 * 지정된 수만큼 재야 NPC를 생성
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';
import { JosaUtil } from '../../../utils/JosaUtil';

// NPC 이름 풀 (예시)
const NPC_NAME_POOL = [
  '무명장수', '초야인사', '유랑무사', '은거학자', '산적두목',
  '퇴역장교', '농민영웅', '상인호위', '유랑검객', '초원기사'
];

// NPC 픽 타입 가중치
const PICK_TYPE_WEIGHTS = {
  '무': 0.333,    // 무력형
  '지': 0.333,    // 지력형
  '무지': 0.334   // 균형형
};

/**
 * 대량 NPC 생성 액션
 */
export class CreateManyNPC extends Action {
  private npcCount: number;
  private fillCnt: number;

  constructor(npcCount: number = 10, fillCnt: number = 0) {
    super();
    this.npcCount = npcCount;
    this.fillCnt = fillCnt;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    if (this.npcCount <= 0 && this.fillCnt <= 0) {
      return [CreateManyNPC.name, []];
    }

    // 국가별 장수 수 채우기 계산
    let moreGenCnt = 0;
    if (this.fillCnt > 0) {
      // 군주(officer_level = 12)가 있는 국가 조회
      const rulers = await General.find({
        session_id: sessionId,
        'data.npc': { $lt: 3 },
        'data.officer_level': 12
      }).select('nation');

      const nationIds = rulers.map(r => r.nation).filter(n => n > 0);

      if (nationIds.length > 0) {
        // 해당 국가의 장수 수 조회
        const regGens = await General.countDocuments({
          session_id: sessionId,
          nation: { $in: nationIds },
          'data.npc': { $lt: 4 }
        });

        moreGenCnt = Math.max(0, nationIds.length * this.fillCnt - regGens);
      }
    }

    const totalCount = this.npcCount + moreGenCnt;
    const result = await this.generateNPCs(env, totalCount);

    // 로그
    const logger = new ActionLogger(0, 0, year, month, sessionId);
    const genCnt = result.length;

    if (genCnt === 1) {
      const npcName = result[0].name;
      const josaRa = JosaUtil.pick(npcName, '라');
      logger.pushGlobalActionLog(`<Y>${npcName}</>${josaRa}는 장수가 <S>등장</>하였습니다.`);
    } else if (genCnt > 0) {
      logger.pushGlobalActionLog(`장수 <C>${genCnt}</>명이 <S>등장</>하였습니다.`);
    }

    if (genCnt > 0) {
      logger.pushGlobalHistoryLog(`장수 <C>${genCnt}</>명이 <S>등장</>했습니다.`);
    }
    await logger.flush();

    return [CreateManyNPC.name, result];
  }

  /**
   * NPC 생성
   */
  private async generateNPCs(env: any, count: number): Promise<{ name: string; id: number }[]> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 시드 생성
    const seed = `${sessionId}_CreateManyNPC_${year}_${month}`;
    const rng = new RandUtil(new LiteHashDRBG(seed));

    // 도시 목록
    const cities = await City.find({ session_id: sessionId }).select('city name');
    const cityIds = cities.map(c => c.city);

    // 새 장수 ID 시작점
    const maxGeneral = await General.findOne({ session_id: sessionId }).sort({ no: -1 });
    let nextGeneralId = (maxGeneral?.no || 0) + 1;

    const result: { name: string; id: number }[] = [];

    for (let i = 0; i < count; i++) {
      // NPC 이름 생성
      const baseName = NPC_NAME_POOL[rng.nextRangeInt(0, NPC_NAME_POOL.length - 1)];
      const name = `${baseName}${nextGeneralId}`;

      // 나이 및 수명
      const age = rng.nextRangeInt(20, 25);
      const birthYear = year - age;
      const deathYear = year + rng.nextRangeInt(10, 50);

      // 스탯 생성 (타입에 따라)
      const pickType = this.pickType(rng);
      const { leadership, strength, intel } = this.generateStats(rng, pickType);

      // 랜덤 도시
      const cityId = cityIds[rng.nextRangeInt(0, cityIds.length - 1)];

      // 숙련도 초기값
      const dexValues = {
        dex1: rng.nextRangeInt(500, 1000),
        dex2: rng.nextRangeInt(500, 1000),
        dex3: rng.nextRangeInt(500, 1000),
        dex4: rng.nextRangeInt(500, 1000),
        dex5: rng.nextRangeInt(500, 1000)
      };

      // NPC 데이터
      const npcData = {
        session_id: sessionId,
        no: nextGeneralId,
        name,
        nation: 0,  // 재야
        city: cityId,
        officer_level: 0,
        data: {
          no: nextGeneralId,
          name,
          leadership,
          strength,
          intel,
          age,
          startage: age,
          birth: birthYear,
          death: deathYear,
          npc: 3,  // 자동 생성 NPC
          affinity: rng.nextRangeInt(0, 150),
          picture: 'default.png',
          imgsvr: 0,
          gold: 1000,
          rice: 1000,
          crew: 0,
          train: 0,
          atmos: 0,
          injury: 0,
          experience: 0,
          dedication: 0,
          special: 'None',
          special2: 'None',
          ...dexValues
        }
      };

      const general = new General(npcData);
      await general.save();
      await saveGeneral(sessionId, nextGeneralId, npcData);

      result.push({ name, id: nextGeneralId });
      nextGeneralId++;
    }

    return result;
  }

  /**
   * 타입 선택 (가중치 기반)
   */
  private pickType(rng: RandUtil): string {
    const rand = rng.nextRange(0, 1);
    let cumulative = 0;

    for (const [type, weight] of Object.entries(PICK_TYPE_WEIGHTS)) {
      cumulative += weight;
      if (rand <= cumulative) {
        return type;
      }
    }

    return '무지';
  }

  /**
   * 스탯 생성
   */
  private generateStats(rng: RandUtil, pickType: string): { leadership: number; strength: number; intel: number } {
    const baseSum = rng.nextRangeInt(150, 220);  // 총합

    let leadership: number;
    let strength: number;
    let intel: number;

    switch (pickType) {
      case '무':  // 무력형
        strength = Math.min(99, rng.nextRangeInt(60, 90));
        intel = rng.nextRangeInt(30, 60);
        leadership = Math.max(30, baseSum - strength - intel);
        break;
      case '지':  // 지력형
        intel = Math.min(99, rng.nextRangeInt(60, 90));
        strength = rng.nextRangeInt(30, 60);
        leadership = Math.max(30, baseSum - strength - intel);
        break;
      default:  // 균형형
        leadership = rng.nextRangeInt(50, 70);
        strength = rng.nextRangeInt(50, 70);
        intel = Math.max(30, baseSum - leadership - strength);
        break;
    }

    // 최대값 제한
    leadership = Math.min(99, Math.max(10, leadership));
    strength = Math.min(99, Math.max(10, strength));
    intel = Math.min(99, Math.max(10, intel));

    return { leadership, strength, intel };
  }
}










