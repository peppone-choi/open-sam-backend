// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { Diplomacy } from '../../../models/diplomacy.model';
import { Event } from '../../../models/event.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { Util } from '../../../utils/Util';
import { saveNation, saveGeneral, saveCity } from '../../../common/cache/model-cache.helper';
import { createLogger } from '../../../utils/logger';
import { getScenarioConfig, loadDataAsset } from '../../../utils/scenario-data';

const logger = createLogger('RaiseInvader');

/**
 * 이민족 침략 이벤트 액션
 * 
 * 양수 : 정해진 값 [절대값]
 * 음수 : 합산(장수 등), 혹은 평균(기술 등)을 곱해 적용한 값 [상대값]
 * 
 * 센 이민족 : npcEachCount = -2, specAvg = 195, tech = 15000, dex = 450000
 * 약한 이민족 : npcEachCount = -2, specAvg = 150, tech = -1, dex = 0
 * 엄청 약한 이민족 : npcEachCount = 100, specAvg = 50, tech = 0, dex = 0
 */
export class RaiseInvader extends Action {
  private npcEachCount: number;
  private specAvg: number;
  private tech: number;
  private dex: number;

  constructor(
    npcEachCount: number = -3,
    specAvg: number = -1.2,
    tech: number = -1.2,
    dex: number = -1
  ) {
    super();
    this.npcEachCount = npcEachCount;
    this.specAvg = specAvg;
    this.tech = tech;
    this.dex = dex;
  }

  /**
   * 기존 국가들의 수도를 이민족 출현 도시에서 이동
   */
  private async moveCapital(sessionId: string, invaderCityIds: number[]): Promise<Set<number>> {
    const disabledInvaderCity = new Set<number>();
    if (invaderCityIds.length === 0) return disabledInvaderCity;

    const nations = await Nation.find({ 
      session_id: sessionId,
      'data.capital': { $in: invaderCityIds }
    });

    for (const nation of nations) {
      const oldCapital = nation.data?.capital;
      const nationId = nation.nation;

      // 새 수도 후보 조회
      const candidateCities = await City.find({
        session_id: sessionId,
        nation: nationId,
        city: { $nin: invaderCityIds }
      });

      if (candidateCities.length === 0) {
        // 다른 도시가 없으면 이민족 도시로 사용 불가
        disabledInvaderCity.add(oldCapital);
        continue;
      }

      // 랜덤하게 새 수도 선택
      const newCapital = candidateCities[Math.floor(Math.random() * candidateCities.length)];

      // 수도 이전
      nation.data.capital = newCapital.city;
      await saveNation(sessionId, nationId, nation.toObject());

      // 해당 도시 장수들 이동
      await General.updateMany(
        { session_id: sessionId, nation: nationId, 'data.city': oldCapital },
        { $set: { 'data.city': newCapital.city, city: newCapital.city } }
      );

      logger.info('[RaiseInvader] 수도 이전', {
        nationId,
        oldCapital,
        newCapital: newCapital.city
      });
    }

    // 이민족 출현 도시를 공백지로 전환
    await General.updateMany(
      { session_id: sessionId, 'data.officer_city': { $in: invaderCityIds } },
      { $set: { 'data.officer_level': 1, 'data.officer_city': 0 } }
    );

    await City.updateMany(
      { session_id: sessionId, city: { $in: invaderCityIds } },
      { $set: { nation: 0, front: 0, supply: 1 } }
    );

    return disabledInvaderCity;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;
    const scenarioId = env['scenario_id'] || 'sangokushi';

    logger.info('[RaiseInvader] 이민족 침략 이벤트 시작', { sessionId, year, month });

    // 1. 외곽 도시 조회 (level = 4, 이민족 출현 위치)
    const invaderCities = await City.find({
      session_id: sessionId,
      level: 4
    });

    if (invaderCities.length === 0) {
      logger.warn('[RaiseInvader] 이민족 출현 가능 도시 없음');
      return [RaiseInvader.name, 0];
    }

    const invaderCityIds = invaderCities.map(c => c.city);

    // 2. 통일 플래그 설정
    // (게임 설정에서 isunited = 1로 설정)

    // 3. NPC 장수 수 계산
    let npcEachCount = this.npcEachCount;
    if (npcEachCount < 0) {
      const humanGeneralCount = await General.countDocuments({
        session_id: sessionId,
        'data.npc': { $lt: 4 }
      });
      npcEachCount = Math.floor(humanGeneralCount / invaderCities.length * (-npcEachCount));
    }
    npcEachCount = Math.max(10, Math.floor(npcEachCount));

    // 4. 능력치 평균 계산
    let specAvg = this.specAvg;
    if (specAvg < 0) {
      const generals = await General.find({
        session_id: sessionId,
        'data.npc': { $lt: 4 }
      });
      
      if (generals.length > 0) {
        const totalStats = generals.reduce((sum, g) => {
          const d = g.data || {};
          return sum + (d.leadership || 0) + (d.strength || 0) + (d.intel || 0);
        }, 0);
        specAvg = Math.floor(totalStats / generals.length * (-specAvg));
      } else {
        specAvg = 150;
      }
    }
    specAvg = Math.floor(specAvg / 3);

    // 5. 기술력 계산
    let tech = this.tech;
    if (tech < 0) {
      const nations = await Nation.find({
        session_id: sessionId,
        'data.level': { $gt: 0 }
      });
      
      if (nations.length > 0) {
        const avgTech = nations.reduce((sum, n) => sum + (n.data?.tech || 0), 0) / nations.length;
        tech = Math.floor(avgTech * (-tech));
      } else {
        tech = 5000;
      }
    }

    // 6. 숙련도 계산
    let dex = this.dex;
    if (dex < 0) {
      const generals = await General.find({
        session_id: sessionId,
        'data.npc': { $lt: 4 }
      });
      
      if (generals.length > 0) {
        const avgDex = generals.reduce((sum, g) => {
          const d = g.data || {};
          const totalDex = (d.dex1 || 0) + (d.dex2 || 0) + (d.dex3 || 0) + (d.dex4 || 0) + (d.dex5 || 0);
          return sum + totalDex / 5;
        }, 0) / generals.length;
        dex = Math.floor(avgDex * (-dex));
      } else {
        dex = 10000;
      }
    }
    dex = Math.floor(dex);

    // 7. 평균 경험치 계산
    const generalStats = await General.aggregate([
      { $match: { session_id: sessionId, 'data.npc': { $lt: 6 } } },
      { $group: { _id: null, avgExp: { $avg: '$data.experience' } } }
    ]);
    const avgExp = generalStats[0]?.avgExp || 1000;

    // 8. 기존 모든 국가의 전쟁/첩보 상태 초기화
    await Nation.updateMany(
      { session_id: sessionId },
      { $set: { 'data.war': 0, 'data.scout': 0 } }
    );

    // 9. 수도 이전 처리
    const disabledInvaderCity = await this.moveCapital(sessionId, invaderCityIds);

    // 10. 기존 국가 ID 목록
    const existingNations = await Nation.find({ session_id: sessionId });
    const existingNationIds = existingNations.map(n => n.nation);
    let maxNationId = Math.max(...existingNationIds, 0);

    // 11. 모든 장수에게 자금 지급
    await General.updateMany(
      { session_id: sessionId },
      { $set: { 'data.gold': 999999, 'data.rice': 999999 } }
    );

    // 12. 이민족 국가 생성
    const invaderNationIds: number[] = [];

    for (const cityDoc of invaderCities) {
      const cityId = cityDoc.city;
      if (disabledInvaderCity.has(cityId)) continue;

      maxNationId++;
      const invaderNationId = maxNationId;
      invaderNationIds.push(invaderNationId);

      const invaderName = cityDoc.name || `도시${cityId}`;
      const nationName = `ⓞ${invaderName}족`;

      // 이민족 국가 생성
      const newNation = new Nation({
        session_id: sessionId,
        nation: invaderNationId,
        data: {
          name: nationName,
          color: '#800080',
          gold: 9999999,
          rice: 9999999,
          tech: tech,
          type: 'che_병가',
          level: 2,
          capital: cityId,
          aux: {},
          message: '중원의 부패를 물리쳐라! 이민족 침범!'
        }
      });
      await newNation.save();

      // 도시 소속 변경
      cityDoc.nation = invaderNationId;
      await saveCity(sessionId, cityId, cityDoc.toObject());

      // 대왕 장수 생성
      const rulerNo = invaderNationId * 1000 + 1;
      const ruler = new General({
        session_id: sessionId,
        no: rulerNo,
        nation: invaderNationId,
        city: cityId,
        data: {
          no: rulerNo,
          name: `${invaderName}대왕`,
          nation: invaderNationId,
          city: cityId,
          leadership: Math.floor(specAvg * 1.8),
          strength: Math.floor(specAvg * 1.8),
          intel: Math.floor(specAvg * 1.2),
          experience: Math.floor(avgExp * 1.2),
          gold: 99999,
          rice: 99999,
          crew: 10000,
          train: 100,
          atmos: 100,
          officer_level: 12,
          npc: 9,
          affinity: 999,
          birth_year: year - 30,
          death_year: year + 20,
          dex1: dex * 2,
          dex2: dex,
          dex3: dex,
          dex4: dex,
          dex5: 0
        }
      });
      await ruler.save();

      // 부하 장수들 생성
      for (let i = 1; i <= npcEachCount; i++) {
        const genNo = invaderNationId * 1000 + i + 1;
        const leadership = Math.floor(specAvg * (1.2 + Math.random() * 0.2));
        const mainStat = Math.floor(specAvg * (1.2 + Math.random() * 0.2));
        const subStat = Math.floor(specAvg * 3 - leadership - mainStat);
        
        const isWarrior = Math.random() > 0.5;
        const strength = isWarrior ? mainStat : subStat;
        const intel = isWarrior ? subStat : mainStat;

        const dexTable = isWarrior
          ? [dex * 2, dex, dex]
          : [dex, dex, dex];
        
        const gen = new General({
          session_id: sessionId,
          no: genNo,
          nation: invaderNationId,
          city: cityId,
          data: {
            no: genNo,
            name: `${invaderName}장수${i}`,
            nation: invaderNationId,
            city: cityId,
            leadership,
            strength,
            intel,
            experience: avgExp,
            gold: 99999,
            rice: 99999,
            crew: 8000,
            train: 100,
            atmos: 100,
            officer_level: 1,
            npc: 9,
            affinity: 999,
            birth_year: year - 25,
            death_year: year + 20,
            dex1: dexTable[0] || dex,
            dex2: dexTable[1] || dex,
            dex3: dexTable[2] || dex,
            dex4: isWarrior ? dex : dex * 2,
            dex5: 0
          }
        });
        await gen.save();
      }

      // AutoDeleteInvader 이벤트 등록
      await Event.create({
        session_id: sessionId,
        target: 'month',
        priority: 1000,
        condition: JSON.stringify(true),
        action: JSON.stringify([['AutoDeleteInvader', invaderNationId]])
      });

      logger.info('[RaiseInvader] 이민족 국가 생성', {
        nationId: invaderNationId,
        nationName,
        cityId,
        npcCount: npcEachCount + 1
      });
    }

    // 13. InvaderEnding 이벤트 등록
    await Event.create({
      session_id: sessionId,
      target: 'month',
      priority: 1000,
      condition: JSON.stringify(true),
      action: JSON.stringify([['InvaderEnding']])
    });

    // 14. 외교 상태 설정 - 기존 국가와 이민족 선전포고
    if (Diplomacy && invaderNationIds.length > 0) {
      // 기존 국가 → 이민족: 전쟁
      for (const existNationId of existingNationIds) {
        for (const invaderId of invaderNationIds) {
          await Diplomacy.updateOne(
            { session_id: sessionId, me: existNationId, you: invaderId },
            { $set: { state: 1, term: 24 } },
            { upsert: true }
          );
          await Diplomacy.updateOne(
            { session_id: sessionId, me: invaderId, you: existNationId },
            { $set: { state: 1, term: 24 } },
            { upsert: true }
          );
        }
      }

      // 이민족끼리는 동맹
      for (let i = 0; i < invaderNationIds.length; i++) {
        for (let j = i + 1; j < invaderNationIds.length; j++) {
          await Diplomacy.updateOne(
            { session_id: sessionId, me: invaderNationIds[i], you: invaderNationIds[j] },
            { $set: { state: 7, term: 480 } },
            { upsert: true }
          );
          await Diplomacy.updateOne(
            { session_id: sessionId, me: invaderNationIds[j], you: invaderNationIds[i] },
            { $set: { state: 7, term: 480 } },
            { upsert: true }
          );
        }
      }
    }

    // 15. 이민족 도시 능력치 강화
    const cityMaxPop = specAvg * npcEachCount * 100 * 4;
    await City.updateMany(
      { session_id: sessionId, nation: { $in: invaderNationIds } },
      {
        $set: {
          pop_max: cityMaxPop,
          def_max: 100000,
          wall_max: 10000
        }
      }
    );

    // 모든 도시 인구/내정 최대로
    await City.updateMany(
      { session_id: sessionId },
      [
        {
          $set: {
            pop: { $ifNull: ['$pop_max', 100000] },
            agri: { $ifNull: ['$agri_max', 10000] },
            comm: { $ifNull: ['$comm_max', 10000] },
            secu: { $ifNull: ['$secu_max', 1000] }
          }
        }
      ]
    );

    // 16. 글로벌 히스토리 로그
    const actionLogger = new ActionLogger(0, 0, year, month);
    actionLogger.pushGlobalHistoryLog(`<L><b>【이벤트】</b></>각지의 이민족들이 <M>궐기</>합니다!`);
    actionLogger.pushGlobalHistoryLog(`<L><b>【이벤트】</b></>중원의 전 국가에 <M>선전포고</> 합니다!`);
    actionLogger.pushGlobalHistoryLog(`<L><b>【이벤트】</b></>이민족의 기세는 그 누구도 막을 수 없을듯 합니다!`);
    await actionLogger.flush();

    logger.info('[RaiseInvader] 이민족 침략 이벤트 완료', {
      sessionId,
      invaderNationCount: invaderNationIds.length,
      npcEachCount,
      specAvg,
      tech,
      dex
    });

    return [RaiseInvader.name, invaderNationIds.length];
  }
}


