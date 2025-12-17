/**
 * MergeInheritPointRank.ts
 * 계승점수 랭킹 병합 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/MergeInheritPointRank.php
 * 
 * 장수들의 계승점수를 계산하고 랭킹 데이터에 병합
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import mongoose from 'mongoose';

// 랭킹 타입 상수
enum RankColumn {
  inherit_point_earned = 'inherit_point_earned',
  inherit_point_earned_by_action = 'inherit_point_earned_by_action',
  inherit_point_earned_by_merge = 'inherit_point_earned_by_merge',
  inherit_point_spent = 'inherit_point_spent',
  inherit_point_spent_dynamic = 'inherit_point_spent_dynamic'
}

// 계승 포인트 키
enum InheritanceKey {
  previous = 'previous',
  killnum = 'killnum',
  experience = 'experience',
  dedication = 'dedication',
  officer_level = 'officer_level',
  stat_total = 'stat_total'
}

/**
 * 계승점수 랭킹 병합 액션
 */
export class MergeInheritPointRank extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';

    // 모든 장수 조회
    const generals = await General.find({ session_id: sessionId });

    // 장수별 총 계승점수 계산
    const points: Map<number, number> = new Map();

    for (const general of generals) {
      const generalId = general.no;
      points.set(generalId, 0);

      // 각 계승 키별 점수 계산
      let totalPoints = 0;

      // 킬 수
      const killnum = general.data?.killnum || 0;
      totalPoints += Math.floor(killnum * 10);

      // 경험
      const experience = general.data?.experience || 0;
      totalPoints += Math.floor(experience / 100);

      // 공헌
      const dedication = general.data?.dedication || 0;
      totalPoints += Math.floor(dedication / 100);

      // 직위
      const officerLevel = general.data?.officer_level || 0;
      totalPoints += officerLevel * 5;

      // 능력치 합
      const leadership = general.data?.leadership || 0;
      const strength = general.data?.strength || 0;
      const intel = general.data?.intel || 0;
      totalPoints += Math.floor((leadership + strength + intel) / 3);

      points.set(generalId, totalPoints);
    }

    // 랭킹 데이터 저장
    const rankDataCollection = mongoose.connection.collection('rank_data');

    // 기존 merge 데이터 삭제
    await rankDataCollection.deleteMany({
      session_id: sessionId,
      type: RankColumn.inherit_point_earned_by_merge
    });

    // 새 데이터 삽입
    const pointPairs: any[] = [];
    for (const general of generals) {
      const generalId = general.no;
      const point = points.get(generalId) || 0;

      pointPairs.push({
        session_id: sessionId,
        nation_id: general.nation || 0,
        general_id: generalId,
        type: RankColumn.inherit_point_earned_by_merge,
        value: point
      });
    }

    if (pointPairs.length > 0) {
      await rankDataCollection.insertMany(pointPairs);
    }

    // inherit_point_earned 업데이트 (action + merge 합계)
    for (const general of generals) {
      const generalId = general.no;
      
      // action과 merge 합계 조회
      const actionPoints = await rankDataCollection.findOne({
        session_id: sessionId,
        general_id: generalId,
        type: RankColumn.inherit_point_earned_by_action
      });
      
      const mergePoints = await rankDataCollection.findOne({
        session_id: sessionId,
        general_id: generalId,
        type: RankColumn.inherit_point_earned_by_merge
      });

      const totalEarned = (actionPoints?.value || 0) + (mergePoints?.value || 0);

      await rankDataCollection.updateOne(
        {
          session_id: sessionId,
          general_id: generalId,
          type: RankColumn.inherit_point_earned
        },
        {
          $set: { value: totalEarned }
        },
        { upsert: true }
      );
    }

    // inherit_point_spent 업데이트 (dynamic 복사)
    for (const general of generals) {
      const generalId = general.no;
      
      const dynamicSpent = await rankDataCollection.findOne({
        session_id: sessionId,
        general_id: generalId,
        type: RankColumn.inherit_point_spent_dynamic
      });

      await rankDataCollection.updateOne(
        {
          session_id: sessionId,
          general_id: generalId,
          type: RankColumn.inherit_point_spent
        },
        {
          $set: { value: dynamicSpent?.value || 0 }
        },
        { upsert: true }
      );
    }

    return [MergeInheritPointRank.name, { processedCount: generals.length }];
  }
}










