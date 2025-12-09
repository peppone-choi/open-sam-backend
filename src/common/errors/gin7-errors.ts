/**
 * GIN7 Error Codes
 * 
 * 직무 권한 카드 시스템과 CP 관련 에러 코드 정의
 * @see agents/gin7-agents/shared/GIN7_API_CONTRACT.md
 */

export const GIN7_ERROR_CODES = {
  /** 직무 카드를 찾을 수 없음 */
  CARD_NOT_FOUND: 'GIN7_E001',
  /** 해당 카드의 소유자가 아님 */
  CARD_NOT_OWNED: 'GIN7_E002',
  /** CP 부족 */
  CP_INSUFFICIENT: 'GIN7_E003',
  /** 그리드 진입 제한 초과 */
  GRID_FULL: 'GIN7_E004',
  /** 전투 중에는 불가능한 행동 */
  BATTLE_IN_PROGRESS: 'GIN7_E005',
} as const;

export type Gin7ErrorCode = (typeof GIN7_ERROR_CODES)[keyof typeof GIN7_ERROR_CODES];

export interface IGin7Error {
  code: Gin7ErrorCode;
  message: string;
  details?: Record<string, any>;
}

/**
 * GIN7 에러 메시지 매핑
 */
export const GIN7_ERROR_MESSAGES: Record<Gin7ErrorCode, string> = {
  [GIN7_ERROR_CODES.CARD_NOT_FOUND]: '직무 카드를 찾을 수 없습니다.',
  [GIN7_ERROR_CODES.CARD_NOT_OWNED]: '해당 카드의 소유자가 아닙니다.',
  [GIN7_ERROR_CODES.CP_INSUFFICIENT]: 'CP가 부족합니다.',
  [GIN7_ERROR_CODES.GRID_FULL]: '그리드 진입 제한을 초과했습니다.',
  [GIN7_ERROR_CODES.BATTLE_IN_PROGRESS]: '전투 중에는 이 행동을 수행할 수 없습니다.',
};

/**
 * GIN7 API 에러 클래스
 */
/**
 * GIN7 Error Class (서비스에서 사용)
 * Gin7ApiError의 간단한 버전
 */
export class Gin7Error extends Error {
  public readonly errorCode: string;
  public readonly details?: string;

  constructor(errorCode: string, details?: string) {
    super(details || errorCode);
    this.name = 'Gin7Error';
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class Gin7ApiError extends Error {
  public readonly code: Gin7ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: Gin7ErrorCode,
    message?: string,
    statusCode: number = 400,
    details?: Record<string, any>
  ) {
    super(message || GIN7_ERROR_MESSAGES[code]);
    this.name = 'Gin7ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): IGin7Error {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }

  static cardNotFound(cardId?: string): Gin7ApiError {
    return new Gin7ApiError(
      GIN7_ERROR_CODES.CARD_NOT_FOUND,
      cardId ? `직무 카드 '${cardId}'를 찾을 수 없습니다.` : undefined,
      404,
      cardId ? { cardId } : undefined
    );
  }

  static cardNotOwned(cardId: string, ownerId?: string): Gin7ApiError {
    return new Gin7ApiError(
      GIN7_ERROR_CODES.CARD_NOT_OWNED,
      `카드 '${cardId}'의 소유자가 아닙니다.`,
      403,
      { cardId, ownerId }
    );
  }

  static cpInsufficient(required: number, available: number, cpType: 'PCP' | 'MCP'): Gin7ApiError {
    const cpLabel = cpType === 'PCP' ? '정략 CP' : '군사 CP';
    return new Gin7ApiError(
      GIN7_ERROR_CODES.CP_INSUFFICIENT,
      `${cpLabel}가 부족합니다. (필요: ${required}, 보유: ${available})`,
      400,
      { required, available, cpType }
    );
  }

  static gridFull(gridId: string, current: number, max: number): Gin7ApiError {
    return new Gin7ApiError(
      GIN7_ERROR_CODES.GRID_FULL,
      `그리드 '${gridId}' 진입 제한 초과 (${current}/${max})`,
      400,
      { gridId, current, max }
    );
  }

  static battleInProgress(battleId?: string): Gin7ApiError {
    return new Gin7ApiError(
      GIN7_ERROR_CODES.BATTLE_IN_PROGRESS,
      battleId 
        ? `전투 '${battleId}' 진행 중에는 이 행동을 수행할 수 없습니다.`
        : undefined,
      409,
      battleId ? { battleId } : undefined
    );
  }
}

