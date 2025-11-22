import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { issueGalaxyOperation } from '../../services/logh/GalaxyOperation.service';
import { GalaxyOperation } from '../../models/logh/GalaxyOperation.model';

const router = Router();
router.use(autoExtractToken);

router.get('/sessions/:sessionId/operations', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = req.query.status as string | undefined;
    const filter: Record<string, any> = { session_id: sessionId };
    if (status) {
      filter.status = status;
    }

    const operations = await GalaxyOperation.find(filter).lean();
    res.json({
      success: true,
      data: operations,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1800-1898',
          note: '작전 계획과 발령 상태를 목록화하여 계획 중복을 방지',
        },

      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/sessions/:sessionId/operations/:operationId/issue', async (req, res) => {
  try {
    const { sessionId, operationId } = req.params;
    const { issuerCharacterId } = req.body;
    const operation = await issueGalaxyOperation({ sessionId, operationId, issuerCharacterId });

    res.json({
      success: true,
      data: operation,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1850-1868',
          note: '발령 명령은 발동 대기 및 30일 종료 규칙을 강제합니다.',
        },

      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
