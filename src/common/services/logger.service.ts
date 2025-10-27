import { WorldHistoryRepository } from '../../api/world-history/repository/world-history.repository';
import { MessageRepository } from '../../api/message/repository/message.repository';
import { GeneralRecordRepository } from '../../api/general-record/repository/general-record.repository';

/**
 * 로거 서비스
 * 
 * 게임 로그, 역사 기록, 장수 기록, 메시지 전송 기능 제공
 */
export class LoggerService {
  private worldHistoryRepo: WorldHistoryRepository;
  private messageRepo: MessageRepository;
  private generalRecordRepo: GeneralRecordRepository;

  constructor() {
    this.worldHistoryRepo = new WorldHistoryRepository();
    this.messageRepo = new MessageRepository();
    this.generalRecordRepo = new GeneralRecordRepository();
  }

  /**
   * 전체 로그 기록 (세계 역사)
   */
  async logGlobal(sessionId: string, message: string): Promise<void> {
    await this.worldHistoryRepo.create({
      sessionId,
      nationId: '',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      text: message,
    } as any);
  }

  /**
   * 역사 기록
   */
  async logHistory(
    nationId: string,
    year: number,
    month: number,
    message: string
  ): Promise<void> {
    await this.worldHistoryRepo.create({
      nationId,
      year,
      month,
      message,
      date: new Date(),
    } as any);
  }

  /**
   * 장수 로그 기록
   */
  async logGeneral(
    generalId: string,
    year: number,
    month: number,
    logType: string,
    message: string
  ): Promise<void> {
    await this.generalRecordRepo.create({
      generalId,
      year,
      month,
      logType,
      message,
    } as any);
  }

  /**
   * 메시지 전송
   */
  async sendMessage(
    fromId: string,
    toId: string,
    message: string,
    type: 'private' | 'national' | 'public' | 'diplomacy' = 'private'
  ): Promise<void> {
    await this.messageRepo.create({
      from: fromId,
      to: toId,
      content: message,
      type,
      isRead: false,
      date: new Date(),
    } as any);
  }

  /**
   * 내정 로그 (템플릿)
   */
  async logDomestic(
    sessionId: string,
    generalName: string,
    cityName: string,
    actionName: string,
    score: number
  ): Promise<void> {
    const message = `${generalName}이(가) ${cityName}에서 ${actionName}을(를) 실행했습니다. (${score})`;
    await this.logGlobal(sessionId, message);
  }

  /**
   * 군사 로그 (템플릿)
   */
  async logMilitary(
    sessionId: string,
    generalName: string,
    actionName: string,
    amount: number
  ): Promise<void> {
    const message = `${generalName}이(가) ${actionName}을(를) 실행했습니다. (${amount})`;
    await this.logGlobal(sessionId, message);
  }

  /**
   * 계략 로그 (템플릿)
   */
  async logSabotage(
    sessionId: string,
    generalName: string,
    targetCityName: string,
    actionName: string,
    success: boolean
  ): Promise<void> {
    const result = success ? '성공' : '실패';
    const message = `${generalName}이(가) ${targetCityName}에 ${actionName}을(를) 시도하여 ${result}했습니다.`;
    await this.logGlobal(sessionId, message);
  }

  /**
   * 이동 로그 (템플릿)
   */
  async logMovement(
    sessionId: string,
    generalName: string,
    fromCityName: string,
    toCityName: string
  ): Promise<void> {
    const message = `${generalName}이(가) ${fromCityName}에서 ${toCityName}(으)로 이동했습니다.`;
    await this.logGlobal(sessionId, message);
  }
}
