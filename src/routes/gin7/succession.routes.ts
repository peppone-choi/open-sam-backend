/**
 * Succession Routes
 * 유산 상속 및 Karma 시스템 API
 */

import { Router, Request, Response } from 'express';
import { successionService, SuccessionService } from '../../services/gin7/SuccessionService';
import { nobilityService } from '../../services/gin7/NobilityService';

const router = Router();

/**
 * GET /api/gin7/succession/karma-grades
 * 모든 Karma 등급 정보 조회
 */
router.get('/karma-grades', async (req: Request, res: Response) => {
  try {
    const grades = SuccessionService.getAllKarmaGrades();
    res.json({
      success: true,
      data: grades,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/succession/pending/:sessionId/:ownerUserId
 * 대기 중인 유산 조회
 */
router.get('/pending/:sessionId/:ownerUserId', async (req: Request, res: Response) => {
  try {
    const { sessionId, ownerUserId } = req.params;

    const result = await successionService.getPendingInheritance(sessionId, ownerUserId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/apply-inheritance
 * 후계 캐릭터에게 유산 적용
 */
router.post('/apply-inheritance', async (req: Request, res: Response) => {
  try {
    const { sessionId, newCommanderNo, inheritance } = req.body;

    if (!sessionId || !newCommanderNo || !inheritance) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, newCommanderNo, inheritance가 필요합니다.',
      });
    }

    const result = await successionService.applyInheritance(
      sessionId,
      newCommanderNo,
      inheritance
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/full-retirement
 * 완전 은퇴 처리
 */
router.post('/full-retirement', async (req: Request, res: Response) => {
  try {
    const { sessionId, commanderNo, successorNo } = req.body;

    if (!sessionId || !commanderNo) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, commanderNo가 필요합니다.',
      });
    }

    const result = await successionService.processFullRetirement(
      sessionId,
      commanderNo,
      successorNo
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/mark-claimed
 * 유산 수령 완료 표시
 */
router.post('/mark-claimed', async (req: Request, res: Response) => {
  try {
    const { sessionId, previousCommanderNo } = req.body;

    if (!sessionId || !previousCommanderNo) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, previousCommanderNo가 필요합니다.',
      });
    }

    const result = await successionService.markInheritanceClaimed(
      sessionId,
      previousCommanderNo
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/succession/nobility/:sessionId/:commanderNo
 * 작위 정보 조회
 */
router.get('/nobility/:sessionId/:commanderNo', async (req: Request, res: Response) => {
  try {
    const { sessionId, commanderNo } = req.params;

    const result = await nobilityService.getNobilityInfo(sessionId, parseInt(commanderNo, 10));

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/ennoble
 * 작위 수여 (서작)
 */
router.post('/ennoble', async (req: Request, res: Response) => {
  try {
    const { sessionId, granterNo, targetNo, newRank } = req.body;

    if (!sessionId || !granterNo || !targetNo || !newRank) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, granterNo, targetNo, newRank가 필요합니다.',
      });
    }

    const result = await nobilityService.ennoble(sessionId, granterNo, targetNo, newRank);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/grant-fief
 * 봉토 수여
 */
router.post('/grant-fief', async (req: Request, res: Response) => {
  try {
    const { sessionId, granterNo, targetNo, planetId } = req.body;

    if (!sessionId || !granterNo || !targetNo || !planetId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, granterNo, targetNo, planetId가 필요합니다.',
      });
    }

    const result = await nobilityService.grantFief(sessionId, granterNo, targetNo, planetId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/revoke-fief
 * 봉토 회수
 */
router.post('/revoke-fief', async (req: Request, res: Response) => {
  try {
    const { sessionId, granterNo, targetNo, planetId } = req.body;

    if (!sessionId || !granterNo || !targetNo || !planetId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, granterNo, targetNo, planetId가 필요합니다.',
      });
    }

    const result = await nobilityService.revokeFief(sessionId, granterNo, targetNo, planetId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/succession/strip-nobility
 * 작위 박탈
 */
router.post('/strip-nobility', async (req: Request, res: Response) => {
  try {
    const { sessionId, granterNo, targetNo } = req.body;

    if (!sessionId || !granterNo || !targetNo) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, granterNo, targetNo가 필요합니다.',
      });
    }

    const result = await nobilityService.stripNobility(sessionId, granterNo, targetNo);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;














