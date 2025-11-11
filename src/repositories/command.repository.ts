// @ts-nocheck - Type issues need investigation
import { Command } from '../models/command.model';
import { DeleteResult } from 'mongodb';
import { cacheService } from '../common/cache/cache.service';

/**
 * 커맨드 리포지토리
 * 
 * 커맨드 데이터의 데이터베이스 접근을 담당합니다.
 */
class CommandRepository {
  /**
   * ID로 커맨드 조회
   * @param commandId - 커맨드 ID
   * @returns 커맨드 문서 또는 null
   */
  async findById(commandId: string) {
    return Command.findById(commandId);
  }

  /**
   * 세션 내 모든 커맨드 조회
   * @param sessionId - 세션 ID
   * @returns 커맨드 목록
   */
  async findBySession(sessionId: string) {
    return Command.find({ session_id: sessionId });
  }

  /**
   * 장수별 커맨드 조회
   * @param sessionId - 세션 ID
   * @param generalId - 장수 ID
   * @returns 커맨드 목록
   */
  async findByGeneral(sessionId: string, generalId: string) {
    return Command.find({ 
      session_id: sessionId, 
      general_id: generalId 
    });
  }

  /**
   * 상태별 커맨드 조회
   * @param sessionId - 세션 ID
   * @param status - 커맨드 상태
   * @returns 커맨드 목록
   */
  async findByStatus(sessionId: string, status: string) {
    return Command.find({ 
      session_id: sessionId, 
      status 
    });
  }

  /**
   * 대기 중인 커맨드 조회
   * @param sessionId - 세션 ID
   * @returns 대기 커맨드 목록
   */
  async findPending(sessionId: string) {
    return Command.find({ 
      session_id: sessionId, 
      status: 'pending' 
    }).sort({ created_at: 1 }).exec();
  }

  /**
   * 커맨드 생성
   * @param data - 커맨드 데이터
   * @returns 생성된 커맨드
   */
  async create(data: any) {
    const result = await Command.create(data);
    
    // 캐시 무효화
    if (data.session_id) {
      await this._invalidateListCaches(data.session_id);
    }
    
    return result;
  }

  /**
   * 커맨드 업데이트
   * @param commandId - 커맨드 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(commandId: string, update: any) {
    // 세션 ID 조회를 위해 먼저 커맨드를 찾기
    const command = await Command.findById(commandId).lean();
    
    const result = await Command.updateOne(
      { _id: commandId },
      { $set: update }
    );
    
    // 캐시 무효화
    if (command?.session_id) {
      await this._invalidateListCaches(command.session_id);
    }
    
    return result;
  }

  /**
   * 커맨드 삭제
   * @param commandId - 커맨드 ID
   * @returns 삭제 결과
   */
  async deleteById(commandId: string): Promise<DeleteResult> {
    // 세션 ID 조회를 위해 먼저 커맨드를 찾기
    const command = await Command.findById(commandId).lean();
    
    const result = await Command.deleteOne({ _id: commandId });
    
    // 캐시 무효화
    if (command?.session_id) {
      await this._invalidateListCaches(command.session_id);
    }
    
    return result;
  }

  /**
   * 세션의 모든 커맨드 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    const result = await Command.deleteMany({ session_id: sessionId });
    
    // 캐시 무효화
    await this._invalidateListCaches(sessionId);
    
    return result;
  }

  /**
   * 완료된 커맨드 조회 (시간 범위)
   * @param sessionId - 세션 ID
   * @param fromDate - 시작 날짜
   * @param toDate - 종료 날짜
   * @returns 완료된 커맨드 목록
   */
  async findCompletedInRange(sessionId: string, fromDate: Date, toDate: Date) {
    return Command.find({
      session_id: sessionId,
      status: 'completed',
      completed_at: { $gte: fromDate, $lte: toDate }
    });
  }

  /**
   * 목록 캐시 무효화 (내부 헬퍼)
   *
   * @param sessionId - 세션 ID
   */
  private async _invalidateListCaches(sessionId: string) {
    await cacheService.invalidate(
      [
        `commands:list:${sessionId}`,
        `commands:pending:${sessionId}`,
      ],
      [
        `commands:general:${sessionId}:*`,
        `commands:status:${sessionId}:*`,
      ]
    );
  }
}

/**
 * 커맨드 리포지토리 싱글톤 인스턴스
 */
export const commandRepository = new CommandRepository();
