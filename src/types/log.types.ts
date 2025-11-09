/**
 * 로그 포맷 타입
 * PHP ActionLogger 클래스의 상수를 참고
 */
export enum LogFormatType {
  /** 원문 (포맷 없음) */
  RAWTEXT = 0,
  /** <C>●</> 텍스트 */
  PLAIN = 1,
  /** <C>●</>220년 1월: 텍스트 */
  YEAR_MONTH = 2,
  /** <C>●</>220년: 텍스트 */
  YEAR = 3,
  /** <C>●</>1월: 텍스트 */
  MONTH = 4,
  /** <S>◆</> 텍스트 (이벤트) */
  EVENT_PLAIN = 5,
  /** <S>◆</>220년 1월: 텍스트 (이벤트) */
  EVENT_YEAR_MONTH = 6,
  /** <R>★</> 텍스트 (알림) */
  NOTICE = 7,
  /** <R>★</>220년 1월: 텍스트 (알림) */
  NOTICE_YEAR_MONTH = 8,
}

/**
 * 로그 타입
 */
export enum LogType {
  /** 장수 이력 (중요 행동 요약) */
  HISTORY = 'history',
  /** 장수 행동 (상세 행동 로그) */
  ACTION = 'action',
  /** 전투 결과 */
  BATTLE_RESULT = 'battle_result',
  /** 전투 상세 */
  BATTLE_DETAIL = 'battle_detail',
  /** 국가 이력 */
  NATION_HISTORY = 'nation_history',
  /** 전역 이력 */
  GLOBAL_HISTORY = 'global_history',
  /** 전역 행동 */
  GLOBAL_ACTION = 'global_action',
}

/**
 * 로그 레코드 인터페이스
 */
export interface ILogRecord {
  session_id: string;
  general_id?: number;
  nation_id?: number;
  log_type: LogType;
  message: string;
  data: {
    year: number;
    month: number;
    [key: string]: any;
  };
  created_at?: Date;
}
