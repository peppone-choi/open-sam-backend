import { Command } from '../models/command.model';

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
    }).sort({ created_at: 1 });
  }

  /**
   * 커맨드 생성
   * @param data - 커맨드 데이터
   * @returns 생성된 커맨드
   */
  async create(data: any) {
    return Command.create(data);
  }

  /**
   * 커맨드 업데이트
   * @param commandId - 커맨드 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(commandId: string, update: any) {
    return Command.updateOne(
      { _id: commandId },
      { $set: update }
    );
  }

  /**
   * 커맨드 삭제
   * @param commandId - 커맨드 ID
   * @returns 삭제 결과
   */
  async deleteById(commandId: string) {
    return Command.deleteOne({ _id: commandId });
  }

  /**
   * 세션의 모든 커맨드 삭제
   * @param sessionId - 세션 ID
   * @returns 삭제 결과
   */
  async deleteBySession(sessionId: string) {
    return Command.deleteMany({ session_id: sessionId });
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
}

/**
 * 커맨드 리포지토리 싱글톤 인스턴스
 */
export const commandRepository = new CommandRepository();
