/**
 * 커스텀 HTTP 예외 클래스
 * blackandwhite-dev-back 패턴 적용
 */
export class HttpException extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(
    status: number,
    message: string,
    details?: any,
    code?: string
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
    this.name = 'HttpException';
  }
}
