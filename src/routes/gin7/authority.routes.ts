import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { GalaxyAuthorityCardService } from '../../services/logh/GalaxyAuthorityCard.service';

const router = Router();
router.use(autoExtractToken);

router.get('/sessions/:sessionId/cards', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = (req.query.status as any) ?? undefined;
    const cards = await GalaxyAuthorityCardService.listAuthorityCards(sessionId, status);

    res.json({
      success: true,
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

export default router;
