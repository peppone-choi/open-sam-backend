import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * HTTP 요청 로깅 미들웨어
 * 
 * 모든 HTTP 요청/응답을 자동으로 로깅합니다.
 * 요청 ID를 생성하고 응답 헤더에 포함시킵니다.
 * 
 * 로그 항목:
 * - requestId: 요청 추적 ID
 * - method: HTTP 메서드
 * - url: 요청 URL
 * - status: 응답 상태 코드
 * - durationMs: 처리 시간 (밀리초)
 * - userAgent: 클라이언트 User-Agent
 * - ip: 클라이언트 IP
 * 
 * @example
 * app.use(requestLogger);
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  
  // 요청 ID 생성 또는 헤더에서 가져오기
  const requestId = (req.headers['x-request-id'] as string) || logger.generateRequestId();
  
  // 응답 헤더에 요청 ID 추가
  res.setHeader('x-request-id', requestId);
  
  // req 객체에 requestId 추가 (다른 미들웨어/컨트롤러에서 사용 가능)
  (req as any).requestId = requestId;

  // 응답 완료 시 로그 출력
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    
    logger.info('HTTP 요청', {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress
    });
  });

  next();
}
