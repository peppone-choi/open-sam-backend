/**
 * ProvideNPCTroopLeader.ts
 * NPC 부대장 제공 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/ProvideNPCTroopLeader.php
 * 
 * 국가 레벨에 따라 NPC 부대장을 자동 생성
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';
import mongoose from 'mongoose';

// 국가 레벨별 최대 NPC 부대장 수
const MAX_NPC_TROOP_LEADER_CNT: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 4,
  5: 6,
  6: 7,
  7: 9
};

/**
 * NPC 부대장 제공 액션
 */
export class ProvideNPCTroopLeader extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 게임 환경 저장소
    const gameEnvCollection = mongoose.connection.collection('game_env');
    const gameEnv = await gameEnvCollection.findOne({ session_id: sessionId });

    // 국가별 현재 NPC 부대장 수 조회
    const npcTroopLeaderCounts: Record<number, number> = {};
    const troopLeaders = await General.aggregate([
      { $match: { session_id: sessionId, 'data.npc': 5 } },
      { $group: { _id: '$nation', count: { $sum: 1 } } }
    ]);
    for (const item of troopLeaders) {
      npcTroopLeaderCounts[item._id] = item.count;
    }

    // 모든 국가 조회
    const nations = await Nation.find({
      session_id: sessionId,
      level: { $gt: 0 }
    });

    let lastNPCTroopLeaderId = gameEnv?.lastNPCTroopLeaderID || 0;
    const createdLeaders: { nationId: number; leaderId: number; name: string }[] = [];

    // 새 장수 ID 시작점
    const maxGeneral = await General.findOne({ session_id: sessionId }).sort({ no: -1 });
    let nextGeneralId = (maxGeneral?.no || 0) + 1;

    for (const nation of nations) {
      const nationId = nation.nation;
      const level = nation.level || 1;
      const maxTroopLeaderCnt = MAX_NPC_TROOP_LEADER_CNT[level] || 0;
      let currentCnt = npcTroopLeaderCounts[nationId] || 0;

      if (currentCnt >= maxTroopLeaderCnt) {
        continue;
      }

      // 시드 생성
      const seed = `${sessionId}_troopLeader_${year}_${month}_${nationId}`;
      const rng = new RandUtil(new LiteHashDRBG(seed));

      // 부족한 수만큼 부대장 생성
      while (currentCnt < maxTroopLeaderCnt) {
        lastNPCTroopLeaderId += 1;
        const leaderName = `부대장${lastNPCTroopLeaderId.toString().padStart(4, '0')}`;

        // 부대장 생성
        const leaderData = {
          session_id: sessionId,
          no: nextGeneralId,
          name: leaderName,
          nation: nationId,
          city: nation.capital || 1,
          officer_level: 0,
          data: {
            no: nextGeneralId,
            name: leaderName,
            leadership: 10,
            strength: 10,
            intel: 10,
            age: 30,
            startage: 30,
            birth: year - 30,
            death: year + 70,
            npc: 5,  // NPC 부대장 타입
            affinity: 999,
            picture: 'default.png',
            imgsvr: 0,
            gold: 0,
            rice: 0,
            crew: 0,
            train: 0,
            atmos: 0,
            injury: 0,
            experience: 0,
            dedication: 0,
            special: 'None',
            special2: 'None',
            ego: 'che_은둔',
            specage: 999,
            specage2: 999,
            killturn: 70,
            troop: nextGeneralId,  // 자기 자신이 부대장
            dex1: 0,
            dex2: 0,
            dex3: 0,
            dex4: 0,
            dex5: 0
          }
        };

        const general = new General(leaderData);
        await general.save();
        await saveGeneral(sessionId, nextGeneralId, leaderData);

        // 부대 생성
        const troopCollection = mongoose.connection.collection('troop');
        await troopCollection.insertOne({
          session_id: sessionId,
          troop_leader: nextGeneralId,
          name: leaderName,
          nation: nationId
        });

        createdLeaders.push({
          nationId,
          leaderId: nextGeneralId,
          name: leaderName
        });

        currentCnt++;
        nextGeneralId++;
      }
    }

    // 마지막 부대장 ID 저장
    await gameEnvCollection.updateOne(
      { session_id: sessionId },
      { $set: { lastNPCTroopLeaderID: lastNPCTroopLeaderId } },
      { upsert: true }
    );

    return [ProvideNPCTroopLeader.name, {
      createdCount: createdLeaders.length,
      leaders: createdLeaders
    }];
  }
}






