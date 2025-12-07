/**
 * Gin7 Character Routes
 * 캐릭터 생성 및 오리지널 캐릭터 추첨 API
 */

import { Router, Request, Response } from 'express';
import CharacterGenService, {
  rollStats,
  calculatePointBuyCost,
  createStatsByPointBuy,
  rollTraits,
  validateTraitSelection,
  createCharacter,
  generateName,
  formatStats,
  getStatGrade
} from '../../services/gin7/CharacterGenService';
import LotteryService, {
  openLotteryPool,
  applyForLottery,
  cancelApplication,
  executeDrawing,
  getLotteryPools,
  getUserApplications,
  getAvailableOriginalCharacters,
  getCharacterOwner,
  processExpiredPools
} from '../../services/gin7/LotteryService';
import {
  GIN7_STAT_KEYS,
  GIN7_STAT_NAMES,
  Gin7Stats,
  CreateCharacterRequest,
  Gin7Faction,
  NameStyle
} from '../../types/gin7/character.types';
import {
  GIN7_TRAITS,
  getTraitById,
  getTraitsByCategory,
  getAffordableTraits,
  calculateTraitEffects
} from '../../data/gin7/traits';
import {
  ORIGINAL_CHARACTERS,
  getOriginalCharacterById,
  getOriginalCharactersByFaction,
  getOriginalCharactersByRarity
} from '../../data/gin7/original-characters';

const router = Router();

// ============================================
// 캐릭터 생성 API
// ============================================

/**
 * POST /api/gin7/character/create
 * 캐릭터 생성 (스탯 롤링 방식)
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, faction, method = 'roll', seed, traitIds } = req.body as CreateCharacterRequest;

    if (!name || !faction) {
      return res.status(400).json({
        success: false,
        error: '이름과 진영은 필수입니다.'
      });
    }

    // 진영 유효성 검증
    const validFactions: Gin7Faction[] = ['empire', 'alliance', 'phezzan', 'neutral'];
    if (!validFactions.includes(faction)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 진영입니다.'
      });
    }

    const result = createCharacter({ name, faction, method, seed, traitIds });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      character: result.character,
      grade: getStatGrade(result.character!.totalStatPoints),
      statsFormatted: formatStats(result.character!.stats)
    });
  } catch (error) {
    console.error('Character creation error:', error);
    return res.status(500).json({
      success: false,
      error: '캐릭터 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/roll-stats
 * 스탯만 롤링 (프리뷰용)
 */
router.post('/roll-stats', (req: Request, res: Response) => {
  try {
    const { seed, config } = req.body;
    const stats = rollStats(seed, config);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    return res.json({
      success: true,
      stats,
      total,
      grade: getStatGrade(total),
      formatted: formatStats(stats)
    });
  } catch (error) {
    console.error('Stat rolling error:', error);
    return res.status(500).json({
      success: false,
      error: '스탯 롤링 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/point-buy
 * 포인트 구매 방식 스탯 생성
 */
router.post('/point-buy', (req: Request, res: Response) => {
  try {
    const { stats } = req.body as { stats: Gin7Stats };

    if (!stats) {
      return res.status(400).json({
        success: false,
        error: '스탯 할당이 필요합니다.'
      });
    }

    // 모든 스탯이 지정되었는지 확인
    for (const key of GIN7_STAT_KEYS) {
      if (stats[key] === undefined) {
        return res.status(400).json({
          success: false,
          error: `${GIN7_STAT_NAMES[key]} 스탯이 지정되지 않았습니다.`
        });
      }
    }

    const costResult = calculatePointBuyCost(stats);
    
    if (!costResult.valid) {
      return res.status(400).json({
        success: false,
        errors: costResult.errors,
        totalCost: costResult.totalCost,
        remaining: costResult.remaining
      });
    }

    const createResult = createStatsByPointBuy(stats);

    return res.json({
      success: createResult.success,
      stats: createResult.stats,
      totalCost: costResult.totalCost,
      remaining: createResult.remaining,
      grade: getStatGrade(Object.values(stats).reduce((a, b) => a + b, 0))
    });
  } catch (error) {
    console.error('Point buy error:', error);
    return res.status(500).json({
      success: false,
      error: '포인트 구매 처리 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/generate-name
 * 랜덤 이름 생성
 */
router.post('/generate-name', (req: Request, res: Response) => {
  try {
    const { style = 'imperial', gender = 'male', seed } = req.body;
    
    const validStyles: NameStyle[] = ['imperial', 'alliance', 'phezzan'];
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 이름 스타일입니다.'
      });
    }

    const name = generateName({ style, gender }, seed);

    return res.json({
      success: true,
      name,
      style,
      gender
    });
  } catch (error) {
    console.error('Name generation error:', error);
    return res.status(500).json({
      success: false,
      error: '이름 생성 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 트레잇 API
// ============================================

/**
 * GET /api/gin7/character/traits
 * 전체 트레잇 목록
 */
router.get('/traits', (req: Request, res: Response) => {
  const { category } = req.query;

  let traits = GIN7_TRAITS;
  
  if (category && typeof category === 'string') {
    traits = getTraitsByCategory(category as any);
  }

  return res.json({
    success: true,
    traits,
    count: traits.length
  });
});

/**
 * GET /api/gin7/character/traits/:id
 * 트레잇 상세 정보
 */
router.get('/traits/:id', (req: Request, res: Response) => {
  const trait = getTraitById(req.params.id);

  if (!trait) {
    return res.status(404).json({
      success: false,
      error: '트레잇을 찾을 수 없습니다.'
    });
  }

  return res.json({
    success: true,
    trait
  });
});

/**
 * POST /api/gin7/character/traits/validate
 * 트레잇 선택 유효성 검증
 */
router.post('/traits/validate', (req: Request, res: Response) => {
  try {
    const { traitIds, availablePoints = 10 } = req.body;

    if (!Array.isArray(traitIds)) {
      return res.status(400).json({
        success: false,
        error: 'traitIds는 배열이어야 합니다.'
      });
    }

    const result = validateTraitSelection(traitIds, availablePoints);
    const effects = calculateTraitEffects(traitIds);

    return res.json({
      success: result.valid,
      ...result,
      effects
    });
  } catch (error) {
    console.error('Trait validation error:', error);
    return res.status(500).json({
      success: false,
      error: '트레잇 검증 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/traits/affordable
 * 구매 가능한 트레잇 목록
 */
router.post('/traits/affordable', (req: Request, res: Response) => {
  try {
    const { currentTraits = [], availablePoints = 10 } = req.body;

    const affordable = getAffordableTraits(currentTraits, availablePoints);

    return res.json({
      success: true,
      traits: affordable,
      count: affordable.length
    });
  } catch (error) {
    console.error('Affordable traits error:', error);
    return res.status(500).json({
      success: false,
      error: '트레잇 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 오리지널 캐릭터 추첨 API
// ============================================

/**
 * GET /api/gin7/character/lottery/pool
 * 현재 열린 추첨 풀 목록
 */
router.get('/lottery/pool', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const status = req.query.status as 'open' | 'closed' | 'completed' | undefined;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId가 필요합니다.'
      });
    }

    const pools = await getLotteryPools(sessionId, status);

    return res.json({
      success: true,
      pools,
      count: pools.length
    });
  } catch (error) {
    console.error('Lottery pool error:', error);
    return res.status(500).json({
      success: false,
      error: '추첨 풀 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/lottery/apply
 * 추첨 신청
 */
router.post('/lottery/apply', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, characterId, userReputation } = req.body;

    if (!sessionId || !userId || !characterId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, userId, characterId가 필요합니다.'
      });
    }

    const result = await applyForLottery(
      sessionId,
      userId,
      characterId,
      userReputation ?? 0
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Lottery apply error:', error);
    return res.status(500).json({
      success: false,
      error: '추첨 신청 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/lottery/cancel
 * 추첨 신청 취소
 */
router.post('/lottery/cancel', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, characterId } = req.body;

    if (!sessionId || !userId || !characterId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, userId, characterId가 필요합니다.'
      });
    }

    const result = await cancelApplication(sessionId, userId, characterId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Lottery cancel error:', error);
    return res.status(500).json({
      success: false,
      error: '신청 취소 중 오류가 발생했습니다.'
    });
  }
});

/**
 * GET /api/gin7/character/lottery/my-applications
 * 내 추첨 신청 목록
 */
router.get('/lottery/my-applications', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.query;

    if (!sessionId || !userId || typeof sessionId !== 'string' || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 userId가 필요합니다.'
      });
    }

    const applications = await getUserApplications(sessionId, userId);

    return res.json({
      success: true,
      applications,
      count: applications.length
    });
  } catch (error) {
    console.error('My applications error:', error);
    return res.status(500).json({
      success: false,
      error: '신청 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 오리지널 캐릭터 데이터 API
// ============================================

/**
 * GET /api/gin7/character/original
 * 전체 오리지널 캐릭터 목록
 */
router.get('/original', (req: Request, res: Response) => {
  const { faction, rarity } = req.query;

  let characters = ORIGINAL_CHARACTERS;

  if (faction && typeof faction === 'string') {
    characters = getOriginalCharactersByFaction(faction);
  }

  if (rarity && typeof rarity === 'string') {
    characters = characters.filter(c => c.rarity === rarity);
  }

  return res.json({
    success: true,
    characters,
    count: characters.length
  });
});

/**
 * GET /api/gin7/character/original/:id
 * 오리지널 캐릭터 상세 정보
 */
router.get('/original/:id', (req: Request, res: Response) => {
  const character = getOriginalCharacterById(req.params.id);

  if (!character) {
    return res.status(404).json({
      success: false,
      error: '캐릭터를 찾을 수 없습니다.'
    });
  }

  // 트레잇 상세 정보 추가
  const traitDetails = character.traits.map(traitId => getTraitById(traitId)).filter(Boolean);
  const totalStats = Object.values(character.stats).reduce((a, b) => a + b, 0);

  return res.json({
    success: true,
    character: {
      ...character,
      traitDetails,
      totalStats,
      grade: getStatGrade(totalStats),
      statsFormatted: formatStats(character.stats)
    }
  });
});

/**
 * GET /api/gin7/character/original/available
 * 세션에서 선택 가능한 오리지널 캐릭터
 */
router.get('/original/available/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const available = await getAvailableOriginalCharacters(sessionId);

    return res.json({
      success: true,
      characters: available,
      count: available.length
    });
  } catch (error) {
    console.error('Available characters error:', error);
    return res.status(500).json({
      success: false,
      error: '캐릭터 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 관리자 API (Admin)
// ============================================

/**
 * POST /api/gin7/character/lottery/open
 * 추첨 풀 열기 (관리자용)
 */
router.post('/lottery/open', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId, durationHours = 24 } = req.body;

    if (!sessionId || !characterId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 characterId가 필요합니다.'
      });
    }

    const result = await openLotteryPool(sessionId, characterId, durationHours);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Lottery open error:', error);
    return res.status(500).json({
      success: false,
      error: '추첨 풀 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/lottery/draw
 * 추첨 실행 (관리자용)
 */
router.post('/lottery/draw', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId, seed } = req.body;

    if (!sessionId || !characterId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 characterId가 필요합니다.'
      });
    }

    const result = await executeDrawing(sessionId, characterId, seed);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Lottery draw error:', error);
    return res.status(500).json({
      success: false,
      error: '추첨 실행 중 오류가 발생했습니다.'
    });
  }
});

/**
 * POST /api/gin7/character/lottery/process-expired
 * 만료된 추첨 풀 처리 (관리자/데몬용)
 */
router.post('/lottery/process-expired', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId가 필요합니다.'
      });
    }

    const processedCount = await processExpiredPools(sessionId);

    return res.json({
      success: true,
      processedCount
    });
  } catch (error) {
    console.error('Process expired error:', error);
    return res.status(500).json({
      success: false,
      error: '만료 풀 처리 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 유틸리티 API
// ============================================

/**
 * GET /api/gin7/character/stats/info
 * 스탯 시스템 정보
 */
router.get('/stats/info', (req: Request, res: Response) => {
  return res.json({
    success: true,
    stats: GIN7_STAT_KEYS.map(key => ({
      key,
      name: GIN7_STAT_NAMES[key]
    })),
    grades: [
      { grade: 'S', minTotal: 70 },
      { grade: 'A', minTotal: 65 },
      { grade: 'B', minTotal: 58 },
      { grade: 'C', minTotal: 50 },
      { grade: 'D', minTotal: 40 },
      { grade: 'F', minTotal: 0 }
    ],
    defaultConfig: {
      totalPoints: 60,
      minStat: 1,
      maxStat: 10,
      mean: 7.5,
      stdDev: 2
    }
  });
});

export default router;

