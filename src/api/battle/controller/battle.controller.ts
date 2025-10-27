import { Request, Response, NextFunction } from 'express';
import { BattleService } from '../service/battle.service';

export class BattleController {
  constructor(private service: BattleService) {}
  
  // TODO: 구현
  // GET /api/:sessionId/battles - 전투 목록
  // GET /api/:sessionId/battles/:id - 전투 상세
  // POST /api/:sessionId/battles - 전투 시작 (Command 발행)
}
