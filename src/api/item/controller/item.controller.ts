import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../service/item.service';

export class ItemController {
  constructor(private service: ItemService) {}
  
  // TODO: 구현
  // GET /api/:sessionId/items - 아이템 목록
  // GET /api/:sessionId/items/:id - 아이템 상세
  // POST /api/:sessionId/items/:id/equip - 아이템 장착
}
