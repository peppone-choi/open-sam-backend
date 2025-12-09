import { BattleReplay, IBattleReplay } from '../models/battle-replay.model';
import { DeleteResult } from 'mongodb';
import type { ReplayData } from '../services/war/BattleReplay';

/**
 * 전투 리플레이 리포지토리
 * 
 * 전투 로그(리플레이) 데이터의 CRUD 처리
 */
class BattleReplayRepository {
  /**
   * 리플레이 데이터 생성
   * @param data - ReplayData 객체
   * @returns 생성된 리플레이 문서
   */
  async create(data: ReplayData): Promise<IBattleReplay> {
    const replay = new BattleReplay(data);
    return replay.save();
  }

  /**
   * battleId로 리플레이 조회
   * @param sessionId - 세션 ID
   * @param battleId - 전투 ID (warSeed)
   * @returns 리플레이 문서 또는 null
   */
  async findByBattleId(sessionId: string, battleId: string): Promise<IBattleReplay | null> {
    return BattleReplay.findOne({
      'metadata.sessionId': sessionId,
      'metadata.battleId': battleId,
    });
  }

  /**
   * MongoDB _id로 리플레이 조회
   * @param id - MongoDB _id
   * @returns 리플레이 문서 또는 null
   */
  async findById(id: string): Promise<IBattleReplay | null> {
    return BattleReplay.findById(id);
  }

  /**
   * 세션 내 모든 리플레이 조회 (최근순)
   * @param sessionId - 세션 ID
   * @param limit - 조회 개수 제한 (기본 100)
   * @returns 리플레이 목록
   */
  async findBySession(sessionId: string, limit: number = 100): Promise<IBattleReplay[]> {
    return BattleReplay.find({ 'metadata.sessionId': sessionId })
      .sort({ 'metadata.date': -1 })
      .limit(limit)
      .lean() as unknown as IBattleReplay[];
  }

  /**
   * 특정 장수가 공격자인 리플레이 조회
   * @param sessionId - 세션 ID
   * @param generalId - 장수 ID
   * @param limit - 조회 개수 제한
   * @returns 리플레이 목록
   */
  async findByAttacker(sessionId: string, generalId: number, limit: number = 50): Promise<IBattleReplay[]> {
    return BattleReplay.find({
      'metadata.sessionId': sessionId,
      'metadata.attacker.id': generalId,
    })
      .sort({ 'metadata.date': -1 })
      .limit(limit)
      .lean() as unknown as IBattleReplay[];
  }

  /**
   * 특정 도시가 방어 대상인 리플레이 조회
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @param limit - 조회 개수 제한
   * @returns 리플레이 목록
   */
  async findByDefenderCity(sessionId: string, cityId: number, limit: number = 50): Promise<IBattleReplay[]> {
    return BattleReplay.find({
      'metadata.sessionId': sessionId,
      'metadata.defender.cityId': cityId,
    })
      .sort({ 'metadata.date': -1 })
      .limit(limit)
      .lean() as unknown as IBattleReplay[];
  }

  /**
   * 특정 국가가 참여한 리플레이 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @param limit - 조회 개수 제한
   * @returns 리플레이 목록
   */
  async findByNation(sessionId: string, nationId: number, limit: number = 50): Promise<IBattleReplay[]> {
    return BattleReplay.find({
      'metadata.sessionId': sessionId,
      $or: [
        { 'metadata.attacker.nationId': nationId },
        { 'metadata.defender.nationId': nationId },
      ],
    })
      .sort({ 'metadata.date': -1 })
      .limit(limit)
      .lean() as unknown as IBattleReplay[];
  }

  /**
   * 리플레이 삭제
   * @param sessionId - 세션 ID
   * @param battleId - 전투 ID
   * @returns 삭제 결과
   */
  async delete(sessionId: string, battleId: string): Promise<DeleteResult> {
    return BattleReplay.deleteOne({
      'metadata.sessionId': sessionId,
      'metadata.battleId': battleId,
    });
  }

  /**
   * 세션의 모든 리플레이 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return BattleReplay.deleteMany({ 'metadata.sessionId': sessionId });
  }

  /**
   * 오래된 리플레이 삭제 (보관 기간 초과)
   * @param sessionId - 세션 ID
   * @param beforeDate - 이 날짜 이전의 리플레이 삭제
   * @returns 삭제 결과
   */
  async deleteOldReplays(sessionId: string, beforeDate: Date): Promise<DeleteResult> {
    return BattleReplay.deleteMany({
      'metadata.sessionId': sessionId,
      'metadata.date': { $lt: beforeDate },
    });
  }

  /**
   * 리플레이 개수 조회
   * @param sessionId - 세션 ID
   * @returns 리플레이 개수
   */
  async count(sessionId: string): Promise<number> {
    return BattleReplay.countDocuments({ 'metadata.sessionId': sessionId });
  }
}

export const battleReplayRepository = new BattleReplayRepository();





