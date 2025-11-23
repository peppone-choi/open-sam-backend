import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { GalaxyAuthorityCardService } from '../../services/logh/GalaxyAuthorityCard.service';
import { Gin7CommandExecutionService } from '../../services/logh/Gin7CommandExecution.service';
import { gin7CommandCatalog } from '../../config/gin7/catalog';

const router = Router();
router.use(autoExtractToken);

router.get('/sessions/:sessionId/cards', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = (req.query.status as any) ?? undefined;
    const cards = await GalaxyAuthorityCardService.listAuthorityCards(sessionId, status);

    res.json({
      success: true,
      schemaVersion: '2025-11-22.authority.1',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: cards,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1076-1166',
          note: '직무 권한 카드 목록은 매뉴얼 3장 직무 카드 사양을 준수합니다.',
        },

      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/sessions/:sessionId/cards/:cardId/assign', async (req, res) => {
  try {
    const { sessionId, cardId } = req.params;
    const { characterId, actorCharacterId } = req.body;

    if (!characterId) {
      return res.status(400).json({ success: false, message: '카드 배정을 위해 캐릭터 식별자가 필요합니다.' });
    }

    const result = await GalaxyAuthorityCardService.assignCard(
      sessionId,
      cardId,
      characterId,
      actorCharacterId
    );

    res.json({
      success: true,
      schemaVersion: '2025-11-22.authority.1',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: result.card,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1076-1090',
          note: '카드 보유 상한 16장과 겸직 규칙을 서버에서 검증합니다.',
        },

      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/sessions/:sessionId/cards/:cardId/release', async (req, res) => {
  try {
    const { sessionId, cardId } = req.params;
    const { actorCharacterId } = req.body;

    const card = await GalaxyAuthorityCardService.releaseCard(sessionId, cardId, actorCharacterId);

    res.json({
      success: true,
      schemaVersion: '2025-11-22.authority.1',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: card,
      compliance: [
        {
          manualRef: 'gin7manual.txt:2342-2350',
          note: '패배·이탈 시 카드 회수 절차를 준수',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/sessions/:sessionId/cards/:cardId/commands/:commandCode/execute', async (req, res) => {
  try {
    const { sessionId, cardId, commandCode } = req.params;
    const { characterId } = req.body;
    const args = req.body.args ?? req.body.payload ?? {};

    if (!characterId) {
      return res.status(400).json({ success: false, message: '커맨드 실행에는 characterId 가 필요합니다.' });
    }

    const result = await Gin7CommandExecutionService.execute({
      sessionId,
      cardId,
      commandCode,
      characterId,
      args,
    });

    res.json({
      success: true,
      schemaVersion: '2025-11-22.authority.1',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: result,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1076-1188',
          note: '직무 카드 소유와 계급/조직 조건을 검증합니다.',
        },
        {
          manualRef: 'gin7manual.txt:1189-1206',
          note: '정략/군사 CP 소모 규칙을 서버에서 강제합니다.',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
