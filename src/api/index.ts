import { Application } from 'express';
import generalRouter from './general/router/general.router';
import commandRouter from './command/router/command.router';
import cityRouter from './city/router/city.router';

/**
 * 도메인별 라우터 통합
 * blackandwhite-dev-back 패턴 적용
 */
export function mountRoutes(app: Application): void {
  // General 라우터
  app.use('/api/generals', generalRouter);

  // Command 라우터
  app.use('/api/commands', commandRouter);

  // City 라우터
  app.use('/api/cities', cityRouter);

  // TODO: 나머지 도메인 라우터 추가
  // app.use('/api/nations', nationRouter);
  // app.use('/api/battles', battleRouter);
  // app.use('/api/items', itemRouter);
}
