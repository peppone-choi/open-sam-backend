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
 * 로그 타입 - PHP func_history.php와 완전히 동일한 DB 값 사용
 * 
 * PHP DB 컬럼 'log_type' 값 (general_record 테이블):
 * - 'history': 장수 열전 (pushGeneralHistoryLog)
 * - 'action': 장수 행동 기록 (pushGeneralActionLog)
 * - 'battle_brief': 전투 결과 요약 (pushBattleResultLog)
 * - 'battle': 전투 상세 기록 (pushBattleDetailLog)
 */
export enum LogType {
  /** 장수 이력/열전 (중요 행동 요약) - PHP: log_type='history' */
  HISTORY = 'history',
  /** 장수 행동 (상세 행동 로그) - PHP: log_type='action' */
  ACTION = 'action',
  /** 전투 결과 요약 - PHP: log_type='battle_brief' */
  BATTLE_BRIEF = 'battle_brief',
  /** 전투 상세 기록 - PHP: log_type='battle' */
  BATTLE = 'battle',
  /** 국가 이력 (world_history 테이블에 nation_id로 저장) */
  NATION_HISTORY = 'nation_history',
  /** 전역 이력 (world_history 테이블에 nation_id=0으로 저장) */
  GLOBAL_HISTORY = 'global_history',
  /** 전역 장수 동향 (general_record 테이블에 general_id=0, log_type='history'로 저장) */
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
