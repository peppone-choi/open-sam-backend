import { randomUUID } from 'crypto';

/**
 * 구조화된 로깅 유틸리티
 * 
 * 모든 로그는 JSON 형태로 출력되며, 타임스탬프, 레벨, 메시지, 메타데이터를 포함합니다.
 * 
 * @example
 * logger.info('사용자 로그인', { userId: '123', ip: '127.0.0.1' });
 * logger.error('DB 연결 실패', { error: err.message });
 */
export const logger = {
  /**
   * 정보성 로그 출력
   * @param msg - 로그 메시지
   * @param meta - 추가 메타데이터
   */
  info: (msg: string, meta: any = {}) => {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      msg,
      ...meta
    }));
  },

  /**
   * 에러 로그 출력
   * @param msg - 에러 메시지
   * @param meta - 추가 메타데이터 (error, stack 등)
   */
  error: (msg: string, meta: any = {}) => {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      msg,
      ...meta
    }));
  },

  /**
   * 경고 로그 출력
   * @param msg - 경고 메시지
   * @param meta - 추가 메타데이터
   */
  warn: (msg: string, meta: any = {}) => {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'warn',
      msg,
      ...meta
    }));
  },

  /**
   * 디버그 로그 출력 (DEBUG 환경변수가 설정된 경우에만)
   * @param msg - 디버그 메시지
   * @param meta - 추가 메타데이터
   */
  debug: (msg: string, meta: any = {}) => {
    if (process.env.DEBUG) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'debug',
        msg,
        ...meta
      }));
    }
  },

  /**
   * 요청 ID 생성
   * @returns UUID v4
   */
  generateRequestId: (): string => {
    return randomUUID();
  }
};
