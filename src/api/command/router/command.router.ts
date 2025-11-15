import { Router } from 'express';
import { CommandService } from '../../../core/command/CommandService';
import { authenticate } from '../../../middleware/auth';

const router: import('express').Router = Router();

/**
 * CQRS 커맨드 라우터
 * 
 * Redis Streams를 통한 비동기 커맨드 처리
 * CommandService의 static 메서드 사용
 */

// 명령 제출 (CQRS)
router.post('/submit', authenticate, async (req, res, next) => {
  try {
    const result = await CommandService.submit({
      sessionId: req.body.sessionId || req.body.session_id,
      generalId: req.user?.userId || req.body.generalId,
      category: req.body.category || 'general',
      type: req.body.type,
      arg: req.body.arg || {},
      priority: req.body.priority,
    });
    res.json({ success: true, command: result });
  } catch (error: any) {
    next(error);
  }
});

// 명령 조회 (ID)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const command = await CommandService.getById(req.params.id);
    res.json({ success: true, command });
  } catch (error: any) {
    next(error);
  }
});

// 명령 취소
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await CommandService.cancel(req.params.id);
    res.json({ success: true, message: '명령이 취소되었습니다' });
  } catch (error: any) {
    next(error);
  }
});

export default router;
