import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireGin7Admin, requireGM, requireRoot, Gin7AdminPayload } from '../../middleware/gin7-admin.middleware';
import { Gin7User, IGin7User } from '../../models/gin7/User';
import { Gin7Character } from '../../models/gin7/Character';
import { Gin7GameSession } from '../../models/gin7/GameSession';
import { AuditLog, AuditAction } from '../../models/gin7/AuditLog';

const router = Router();

// 모든 Admin 라우트에 인증 + Admin 권한 필수
router.use(authenticate);

/**
 * 유틸: Audit 로그 기록
 */
async function logAudit(
  req: Request,
  action: AuditAction,
  options: {
    category: 'user' | 'card' | 'resource' | 'session' | 'config';
    targetId?: string;
    targetType?: 'user' | 'character' | 'session' | 'system';
    before?: Record<string, any>;
    after?: Record<string, any>;
    reason?: string;
    metadata?: Record<string, any>;
  }
) {
  const admin = (req as any).gin7Admin as Gin7AdminPayload;
  if (!admin) return;

  await AuditLog.logAction(
    admin.userId,
    admin.username,
    action,
    {
      ...options,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent')
    }
  );
}

// =====================
// 유저 검색 API
// =====================

/**
 * GET /admin/gin7/users/search
 * 유저 검색
 */
router.get('/users/search', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { q, field = 'username', page = 1, limit = 20 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: '검색어를 입력해주세요'
      });
    }

    const query: any = {};
    const searchField = field === 'email' ? 'email' : 
                        field === 'userId' ? 'userId' : 'username';
    
    // 정확한 일치 또는 부분 일치
    if (searchField === 'userId') {
      query[searchField] = q;
    } else {
      query[searchField] = { $regex: q, $options: 'i' };
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      Gin7User.find(query)
        .select('userId username email role isBanned lastLogin createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Gin7User.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 유저 검색 오류:', error);
    return res.status(500).json({
      success: false,
      message: '유저 검색 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /admin/gin7/users/:userId
 * 유저 상세 정보 조회
 */
router.get('/users/:userId', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const [user, characters] = await Promise.all([
      Gin7User.findOne({ userId }).lean(),
      Gin7Character.find({ userId }).lean()
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    // 민감 정보 마스킹 (Observer 등급)
    const admin = (req as any).gin7Admin as Gin7AdminPayload;
    const maskedUser: any = { ...user };
    
    if (admin.role === 'observer' && maskedUser.email) {
      // 이메일 부분 마스킹: example@domain.com -> ex***e@do***n.com
      const [local, domain] = maskedUser.email.split('@');
      if (local && domain) {
        maskedUser.email = `${local.slice(0, 2)}***${local.slice(-1)}@${domain.slice(0, 2)}***${domain.slice(-4)}`;
      }
    }

    return res.json({
      success: true,
      data: {
        user: maskedUser,
        characters
      }
    });
  } catch (error: any) {
    console.error('[Admin] 유저 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '유저 조회 중 오류가 발생했습니다'
    });
  }
});

// =====================
// 제재 API
// =====================

/**
 * POST /admin/gin7/users/:userId/ban
 * 유저 계정 정지
 */
router.post('/users/:userId/ban', requireGM, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await Gin7User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    const before = { isBanned: user.isBanned };
    user.isBanned = true;
    await user.save();

    await logAudit(req, 'USER_BAN', {
      category: 'user',
      targetId: userId,
      targetType: 'user',
      before,
      after: { isBanned: true },
      reason
    });

    return res.json({
      success: true,
      message: '계정이 정지되었습니다'
    });
  } catch (error: any) {
    console.error('[Admin] 계정 정지 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계정 정지 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/users/:userId/unban
 * 유저 계정 정지 해제
 */
router.post('/users/:userId/unban', requireGM, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await Gin7User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    const before = { isBanned: user.isBanned };
    user.isBanned = false;
    await user.save();

    await logAudit(req, 'USER_UNBAN', {
      category: 'user',
      targetId: userId,
      targetType: 'user',
      before,
      after: { isBanned: false },
      reason
    });

    return res.json({
      success: true,
      message: '계정 정지가 해제되었습니다'
    });
  } catch (error: any) {
    console.error('[Admin] 계정 정지 해제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계정 정지 해제 중 오류가 발생했습니다'
    });
  }
});

// =====================
// 로그 조회 API
// =====================

/**
 * GET /admin/gin7/logs
 * Audit 로그 조회
 */
router.get('/logs', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { 
      action, 
      category, 
      adminId, 
      targetId,
      startDate,
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;

    const query: any = {};

    if (action && typeof action === 'string') {
      query.action = action;
    }
    if (category && typeof category === 'string') {
      query.category = category;
    }
    if (adminId && typeof adminId === 'string') {
      query.adminId = adminId;
    }
    if (targetId && typeof targetId === 'string') {
      query.targetId = targetId;
    }

    // 날짜 필터
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(String(startDate));
      }
      if (endDate) {
        query.timestamp.$lte = new Date(String(endDate));
      }
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 로그 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '로그 조회 중 오류가 발생했습니다'
    });
  }
});

// =====================
// GM Tools - 캐릭터 관리
// =====================

/**
 * GET /admin/gin7/characters/search
 * 캐릭터 검색
 */
router.get('/characters/search', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { q, sessionId, page = 1, limit = 20 } = req.query;
    
    const query: any = {};
    
    if (q && typeof q === 'string') {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { characterId: q }
      ];
    }
    
    if (sessionId && typeof sessionId === 'string') {
      query.sessionId = sessionId;
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [characters, total] = await Promise.all([
      Gin7Character.find(query)
        .select('characterId sessionId ownerId name stats state location resources')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Gin7Character.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        characters,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 캐릭터 검색 오류:', error);
    return res.status(500).json({
      success: false,
      message: '캐릭터 검색 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /admin/gin7/characters/:sessionId/:characterId
 * 캐릭터 상세 정보 조회
 */
router.get('/characters/:sessionId/:characterId', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;

    const character = await Gin7Character.findOne({ sessionId, characterId }).lean();

    if (!character) {
      return res.status(404).json({
        success: false,
        message: '캐릭터를 찾을 수 없습니다'
      });
    }

    return res.json({
      success: true,
      data: { character }
    });
  } catch (error: any) {
    console.error('[Admin] 캐릭터 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '캐릭터 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/characters/:sessionId/:characterId/grant-card
 * 카드 강제 지급
 */
router.post('/characters/:sessionId/:characterId/grant-card', requireGM, async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const { cardId, name, category, commands, reason } = req.body;

    if (!cardId || !name) {
      return res.status(400).json({
        success: false,
        message: 'cardId와 name은 필수입니다'
      });
    }

    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return res.status(404).json({
        success: false,
        message: '캐릭터를 찾을 수 없습니다'
      });
    }

    const beforeCards = [...character.commandCards];
    
    // 중복 체크
    const existingCard = character.commandCards.find(c => c.cardId === cardId);
    if (existingCard) {
      return res.status(400).json({
        success: false,
        message: '이미 보유한 카드입니다'
      });
    }

    character.commandCards.push({
      cardId,
      name,
      category: category || 'general',
      commands: commands || []
    });
    await character.save();

    await logAudit(req, 'CARD_GRANT', {
      category: 'card',
      targetId: characterId,
      targetType: 'character',
      before: { commandCards: beforeCards },
      after: { commandCards: character.commandCards },
      reason,
      metadata: { sessionId, cardId, name }
    });

    return res.json({
      success: true,
      message: '카드가 지급되었습니다',
      data: { card: { cardId, name, category, commands } }
    });
  } catch (error: any) {
    console.error('[Admin] 카드 지급 오류:', error);
    return res.status(500).json({
      success: false,
      message: '카드 지급 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/characters/:sessionId/:characterId/revoke-card
 * 카드 강제 회수
 */
router.post('/characters/:sessionId/:characterId/revoke-card', requireGM, async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const { cardId, reason } = req.body;

    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: 'cardId는 필수입니다'
      });
    }

    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return res.status(404).json({
        success: false,
        message: '캐릭터를 찾을 수 없습니다'
      });
    }

    const beforeCards = [...character.commandCards];
    const cardIndex = character.commandCards.findIndex(c => c.cardId === cardId);
    
    if (cardIndex === -1) {
      return res.status(400).json({
        success: false,
        message: '해당 카드를 보유하고 있지 않습니다'
      });
    }

    const revokedCard = character.commandCards.splice(cardIndex, 1)[0];
    await character.save();

    await logAudit(req, 'CARD_REVOKE', {
      category: 'card',
      targetId: characterId,
      targetType: 'character',
      before: { commandCards: beforeCards },
      after: { commandCards: character.commandCards },
      reason,
      metadata: { sessionId, cardId, revokedCard }
    });

    return res.json({
      success: true,
      message: '카드가 회수되었습니다',
      data: { revokedCard }
    });
  } catch (error: any) {
    console.error('[Admin] 카드 회수 오류:', error);
    return res.status(500).json({
      success: false,
      message: '카드 회수 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/characters/:sessionId/:characterId/modify-resources
 * 자원 지급/차감
 */
router.post('/characters/:sessionId/:characterId/modify-resources', requireGM, async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const { resources, reason } = req.body;

    if (!resources || typeof resources !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'resources 객체가 필요합니다 (예: { gold: 100, rice: -50 })'
      });
    }

    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return res.status(404).json({
        success: false,
        message: '캐릭터를 찾을 수 없습니다'
      });
    }

    const beforeResources = { ...character.resources };
    
    // 자원 적용
    for (const [key, value] of Object.entries(resources)) {
      if (typeof value !== 'number') continue;
      
      const currentValue = (character.resources as any)[key] || 0;
      const newValue = currentValue + value;
      
      // 음수 방지
      (character.resources as any)[key] = Math.max(0, newValue);
    }
    
    character.markModified('resources');
    await character.save();

    // 자원 변경량 총합으로 액션 유형 결정
    const totalChange = Object.values(resources as Record<string, number>).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0);
    await logAudit(req, totalChange >= 0 ? 'RESOURCE_ADD' : 'RESOURCE_REMOVE', {
      category: 'resource',
      targetId: characterId,
      targetType: 'character',
      before: { resources: beforeResources },
      after: { resources: character.resources },
      reason,
      metadata: { sessionId, appliedChanges: resources }
    });

    return res.json({
      success: true,
      message: '자원이 변경되었습니다',
      data: { 
        before: beforeResources,
        after: character.resources 
      }
    });
  } catch (error: any) {
    console.error('[Admin] 자원 변경 오류:', error);
    return res.status(500).json({
      success: false,
      message: '자원 변경 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/characters/:sessionId/:characterId/force-move
 * 강제 이동
 */
router.post('/characters/:sessionId/:characterId/force-move', requireGM, async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const { regionId, cityId, x, y, zoneId, reason } = req.body;

    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return res.status(404).json({
        success: false,
        message: '캐릭터를 찾을 수 없습니다'
      });
    }

    const beforeLocation = { ...character.location };
    
    // 위치 업데이트
    if (regionId !== undefined) character.location.regionId = regionId;
    if (cityId !== undefined) character.location.cityId = cityId;
    if (x !== undefined) character.location.x = x;
    if (y !== undefined) character.location.y = y;
    if (zoneId !== undefined) character.location.zoneId = zoneId;
    
    // 이동 중이었다면 상태 초기화
    if (character.state === 'marching') {
      character.state = 'idle';
      character.stateData = {};
    }
    
    character.markModified('location');
    await character.save();

    await logAudit(req, 'FORCE_MOVE', {
      category: 'session',
      targetId: characterId,
      targetType: 'character',
      before: { location: beforeLocation },
      after: { location: character.location },
      reason,
      metadata: { sessionId }
    });

    return res.json({
      success: true,
      message: '캐릭터가 이동되었습니다',
      data: { 
        before: beforeLocation,
        after: character.location 
      }
    });
  } catch (error: any) {
    console.error('[Admin] 강제 이동 오류:', error);
    return res.status(500).json({
      success: false,
      message: '강제 이동 중 오류가 발생했습니다'
    });
  }
});

// =====================
// Sanction 확장 - 경고/채팅금지
// =====================

/**
 * POST /admin/gin7/users/:userId/warn
 * 경고 부여
 */
router.post('/users/:userId/warn', requireGM, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason, level = 1 } = req.body;

    const user = await Gin7User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    // 경고 기록 추가
    const warnings = user.data?.warnings || [];
    const newWarning = {
      id: `warn_${Date.now()}`,
      level,
      reason,
      timestamp: new Date().toISOString()
    };
    warnings.push(newWarning);
    
    user.data = { ...user.data, warnings };
    user.markModified('data');
    await user.save();

    await logAudit(req, 'USER_WARN', {
      category: 'user',
      targetId: userId,
      targetType: 'user',
      after: { warning: newWarning },
      reason,
      metadata: { totalWarnings: warnings.length }
    });

    return res.json({
      success: true,
      message: '경고가 부여되었습니다',
      data: { warning: newWarning, totalWarnings: warnings.length }
    });
  } catch (error: any) {
    console.error('[Admin] 경고 부여 오류:', error);
    return res.status(500).json({
      success: false,
      message: '경고 부여 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/users/:userId/mute
 * 채팅 금지
 */
router.post('/users/:userId/mute', requireGM, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason, durationMinutes = 60 } = req.body;

    const user = await Gin7User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    const muteUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    const before = { muteUntil: user.data?.muteUntil };
    
    user.data = { ...user.data, muteUntil: muteUntil.toISOString() };
    user.markModified('data');
    await user.save();

    await logAudit(req, 'USER_MUTE', {
      category: 'user',
      targetId: userId,
      targetType: 'user',
      before,
      after: { muteUntil: muteUntil.toISOString() },
      reason,
      metadata: { durationMinutes }
    });

    return res.json({
      success: true,
      message: '채팅 금지가 적용되었습니다',
      data: { muteUntil: muteUntil.toISOString(), durationMinutes }
    });
  } catch (error: any) {
    console.error('[Admin] 채팅 금지 오류:', error);
    return res.status(500).json({
      success: false,
      message: '채팅 금지 중 오류가 발생했습니다'
    });
  }
});

/**
 * POST /admin/gin7/users/:userId/unmute
 * 채팅 금지 해제
 */
router.post('/users/:userId/unmute', requireGM, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await Gin7User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    const before = { muteUntil: user.data?.muteUntil };
    
    if (user.data) {
      delete user.data.muteUntil;
      user.markModified('data');
      await user.save();
    }

    await logAudit(req, 'USER_UNMUTE', {
      category: 'user',
      targetId: userId,
      targetType: 'user',
      before,
      after: { muteUntil: null },
      reason
    });

    return res.json({
      success: true,
      message: '채팅 금지가 해제되었습니다'
    });
  } catch (error: any) {
    console.error('[Admin] 채팅 금지 해제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '채팅 금지 해제 중 오류가 발생했습니다'
    });
  }
});

// =====================
// 모니터링 API
// =====================

/**
 * GET /admin/gin7/stats
 * 기본 통계 조회
 */
router.get('/stats', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      bannedUsers,
      activeUsers24h,
      newUsers7d
    ] = await Promise.all([
      Gin7User.countDocuments(),
      Gin7User.countDocuments({ isBanned: true }),
      Gin7User.countDocuments({ lastLogin: { $gte: oneDayAgo } }),
      Gin7User.countDocuments({ createdAt: { $gte: oneWeekAgo } })
    ]);

    return res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          banned: bannedUsers,
          active24h: activeUsers24h,
          newUsers7d
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: now.toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 통계 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /admin/gin7/sessions
 * 세션 목록 조회
 */
router.get('/sessions', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query: any = {};
    if (status && typeof status === 'string') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [sessions, total] = await Promise.all([
      Gin7GameSession.find(query)
        .select('sessionId name status timeConfig currentState createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Gin7GameSession.countDocuments(query)
    ]);

    // 각 세션의 캐릭터 수 조회
    const sessionsWithStats = await Promise.all(
      sessions.map(async (session) => {
        const characterCount = await Gin7Character.countDocuments({ sessionId: session.sessionId });
        return {
          ...session,
          characterCount
        };
      })
    );

    return res.json({
      success: true,
      data: {
        sessions: sessionsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 세션 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '세션 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /admin/gin7/sessions/:sessionId
 * 세션 상세 정보 조회
 */
router.get('/sessions/:sessionId', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await Gin7GameSession.findOne({ sessionId }).lean();
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '세션을 찾을 수 없습니다'
      });
    }

    // 세션 통계
    const [characterCount, activeCharacters] = await Promise.all([
      Gin7Character.countDocuments({ sessionId }),
      Gin7Character.countDocuments({ sessionId, state: { $ne: 'dead' } })
    ]);

    // 틱 지연 계산
    let tickDelay = 0;
    if (session.currentState?.lastTickTime) {
      const expectedTickTime = session.timeConfig?.tickRateMs || 1000;
      const lastTick = new Date(session.currentState.lastTickTime).getTime();
      const now = Date.now();
      tickDelay = Math.max(0, now - lastTick - expectedTickTime);
    }

    return res.json({
      success: true,
      data: {
        session,
        stats: {
          characterCount,
          activeCharacters,
          tickDelay
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin] 세션 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '세션 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * GET /admin/gin7/users/:userId/sanctions
 * 유저 제재 이력 조회
 */
router.get('/users/:userId/sanctions', requireGin7Admin('observer'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await Gin7User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '유저를 찾을 수 없습니다'
      });
    }

    // 제재 관련 로그 조회
    const sanctionLogs = await AuditLog.find({
      targetId: userId,
      action: { $in: ['USER_BAN', 'USER_UNBAN', 'USER_WARN', 'USER_MUTE', 'USER_UNMUTE'] }
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    // 현재 상태 요약
    const currentStatus = {
      isBanned: user.isBanned || false,
      isMuted: user.data?.muteUntil ? new Date(user.data.muteUntil) > new Date() : false,
      muteUntil: user.data?.muteUntil || null,
      warningCount: user.data?.warnings?.length || 0,
      warnings: user.data?.warnings || []
    };

    return res.json({
      success: true,
      data: {
        currentStatus,
        history: sanctionLogs
      }
    });
  } catch (error: any) {
    console.error('[Admin] 제재 이력 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '제재 이력 조회 중 오류가 발생했습니다'
    });
  }
});

export default router;

