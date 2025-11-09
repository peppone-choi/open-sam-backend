// @ts-nocheck - Type issues need investigation
import { Battle } from '../models/battle.model';
import { BattleMapTemplate } from '../models/battlemap-template.model';
import { DeleteResult } from 'mongodb';

/**
 * 전투 리포지토리
 * 
 * CQRS 패턴:
 * - Query: L1 → L2 → DB (필요시 캐시 추가)
 * - Command: Redis에만 쓰기 (데몬이 주기적으로 DB 동기화)
 */
class BattleRepository {
  /**
   * battleId로 전투 조회
   * @param battleId - 전투 ID
   * @returns 전투 문서 또는 null
   */
  async findByBattleId(battleId: string) {
    return Battle.findOne({ battleId });
  }

  /**
   * MongoDB _id로 전투 조회
   * @param id - MongoDB _id
   * @returns 전투 문서 또는 null
   */
  async findById(id: string) {
    return Battle.findById(id);
  }

  /**
   * 세션 내 모든 전투 조회
   * @param sessionId - 세션 ID
   * @returns 전투 목록
   */
  async findBySession(sessionId: string) {
    return Battle.find({ session_id: sessionId });
  }

  /**
   * 특정 상태의 전투 조회
   * @param sessionId - 세션 ID
   * @param status - 전투 상태
   * @returns 전투 목록
   */
  async findByStatus(sessionId: string, status: string) {
    return Battle.find({ 
      session_id: sessionId, 
      status 
    });
  }

  /**
   * 국가가 참여한 전투 조회
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 전투 목록
   */
  async findByNation(sessionId: string, nationId: number) {
    return Battle.find({
      session_id: sessionId,
      $or: [
        { attackerNationId: nationId },
        { defenderNationId: nationId }
      ]
    });
  }

  /**
   * 진행 중인 전투 조회
   * @param sessionId - 세션 ID
   * @returns 진행 중인 전투 목록
   */
  async findActiveBattles(sessionId: string) {
    return Battle.find({
      session_id: sessionId,
      status: { $in: ['preparing', 'deploying', 'in_progress'] }
    }).sort({ startedAt: -1 }).limit(20).lean();
  }

  /**
   * 도시 대상 전투 조회
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns 전투 목록
   */
  async findByCityId(sessionId: string, cityId: number) {
    return Battle.find({
      session_id: sessionId,
      targetCityId: cityId
    });
  }

  /**
   * 전투 생성
   * @param data - 전투 데이터
   * @returns 생성된 전투
   */
  async create(data: any) {
    const battle = new Battle(data);
    return battle.save();
  }

  /**
   * 전투 업데이트
   * @param battleId - 전투 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트된 전투
   */
  async update(battleId: string, update: any) {
    return Battle.findOneAndUpdate(
      { battleId },
      { $set: update },
      { new: true }
    );
  }

  /**
   * MongoDB _id로 업데이트
   * @param id - MongoDB _id
   * @param update - 업데이트할 데이터
   * @returns 업데이트된 전투
   */
  async updateById(id: string, update: any) {
    return Battle.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
  }

  /**
   * 전투 저장 (모델 인스턴스)
   * @param battle - 전투 모델 인스턴스
   * @returns 저장된 전투
   */
  async save(battle: any) {
    return battle.save();
  }

  /**
   * 전투 삭제
   * @param battleId - 전투 ID
   * @returns 삭제 결과
   */
  async delete(battleId: string): Promise<DeleteResult> {
    return Battle.deleteOne({ battleId });
  }

  /**
   * MongoDB _id로 삭제
   * @param id - MongoDB _id
   * @returns 삭제 결과
   */
  async deleteById(id: string): Promise<DeleteResult> {
    return Battle.deleteOne({ _id: id });
  }

  /**
   * 조건에 맞는 전투 조회 (유연한 쿼리)
   * @param filter - 조회 조건
   * @returns 전투 목록
   */
  async find(filter: any) {
    return Battle.find(filter);
  }

  /**
   * 조건에 맞는 단일 전투 조회
   * @param filter - 조회 조건
   * @returns 전투 문서 또는 null
   */
  async findOne(filter: any) {
    return Battle.findOne(filter);
  }
}

/**
 * 전투 맵 템플릿 리포지토리
 */
class BattleMapTemplateRepository {
  /**
   * 세션과 도시로 맵 템플릿 조회
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns 맵 템플릿 또는 null
   */
  async findBySessionAndCity(sessionId: string, cityId: number) {
    return BattleMapTemplate.findOne({
      session_id: sessionId,
      city_id: cityId
    });
  }

  /**
   * 세션의 모든 맵 템플릿 조회
   * @param sessionId - 세션 ID
   * @returns 맵 템플릿 목록
   */
  async findBySession(sessionId: string) {
    return BattleMapTemplate.find({ session_id: sessionId });
  }

  /**
   * 맵 템플릿 생성
   * @param data - 맵 템플릿 데이터
   * @returns 생성된 맵 템플릿
   */
  async create(data: any) {
    const template = new BattleMapTemplate(data);
    return template.save();
  }

  /**
   * 맵 템플릿 업데이트
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트된 맵 템플릿
   */
  async update(sessionId: string, cityId: number, update: any) {
    return BattleMapTemplate.findOneAndUpdate(
      { session_id: sessionId, city_id: cityId },
      { $set: update },
      { new: true, upsert: true }
    );
  }

  /**
   * 조건에 맞는 맵 템플릿 조회
   * @param filter - 조회 조건
   * @returns 맵 템플릿 또는 null
   */
  async findOne(filter: any) {
    return BattleMapTemplate.findOne(filter);
  }
}

export const battleRepository = new BattleRepository();
export const battleMapTemplateRepository = new BattleMapTemplateRepository();
