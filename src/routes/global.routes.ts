import { Router, Request, Response, NextFunction } from 'express';
import { GetNationListService } from '../services/global/GetNationList.service';
import { GetMapService } from '../services/global/GetMap.service';
import { Session } from '../models/session.model';

const router = Router();

/**
 * @swagger
 * /api/global/get-map:
 *   get:
 *     summary: 맵 정보 조회
 *     tags: [Global]
 *     parameters:
 *       - in: query
 *         name: serverID
 *         schema:
 *           type: string
 *         description: 서버 ID
 *       - in: query
 *         name: neutralView
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: 중립 시점 여부
 *       - in: query
 *         name: showMe
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: 내 위치 표시 여부
 *     responses:
 *       200:
 *         description: 맵 정보
 */
router.get('/get-map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverID = req.query.serverID as string;
    const sessionId = serverID || req.query.session_id as string || 'sangokushi_default';
    const neutralView = req.query.neutralView === '1' || req.query.neutralView === 1;
    const showMe = req.query.showMe === '1' || req.query.showMe === 1;
    
    const result = await GetMapService.execute({
      session_id: sessionId,
      neutralView,
      showMe
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/get-global-menu:
 *   get:
 *     summary: 글로벌 메뉴 조회
 *     tags: [Global]
 *     parameters:
 *       - in: query
 *         name: serverID
 *         schema:
 *           type: string
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 메뉴 정보
 */
router.get('/get-global-menu', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverID = req.query.serverID as string;
    const sessionId = serverID || req.query.session_id as string || 'sangokushi_default';
    
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    const sessionData = session?.data || {};
    
    // 사용자 권한 확인
    let officerLevel = 0;
    let permission = 0;
    let genPermission = 'normal';
    let isAdmin = false;
    
    if (req.user) {
      const { General } = await import('../models');
      const general = await (General as any).findOne({ 
        session_id: sessionId, 
        user_id: req.user.id 
      }).lean();
      
      if (general) {
        const genData = general.data || {};
        officerLevel = genData.officer_level || 0;
        genPermission = genData.permission || 'normal';
        
        // 권한 레벨 계산
        if (officerLevel >= 12) {
          permission = 2; // 군주
        } else if (officerLevel >= 5) {
          permission = 2; // 수뇌
        } else if (officerLevel >= 1) {
          permission = 1; // 일반
        }
        
        if (genPermission === 'ambassador') {
          permission = 4; // 외교권자
        } else if (genPermission === 'auditor') {
          permission = 3; // 감찰권자
        }
        
        // 관리자 권한 확인
        isAdmin = req.user.grade >= 4 || genPermission === 'admin';
      }
    }
    
    // 조건부 표시 변수
    const hasSecretPermission = permission >= 1 || officerLevel >= 2;
    const hasNPCControl = officerLevel >= 5 || genPermission === 'ambassador';
    
    // 전체 메뉴 구성
    const menu = [
      // 1. 게임 (메인)
      {
        type: 'item',
        name: '게임',
        url: '/game'
      },
      
      // 2. 정보 (드롭다운)
      {
        type: 'multi',
        name: '정보',
        subMenu: [
          { type: 'item', name: '내 정보', url: '/info/me' },
          { type: 'item', name: '장수 정보', url: '/info/general' },
          { type: 'item', name: '장수 목록', url: '/info/generals' },
          { type: 'item', name: '국가 정보', url: '/info/nation' },
          { type: 'item', name: '도시 정보', url: '/info/city' },
          { type: 'item', name: '현재 도시', url: '/info/current-city' },
          { type: 'item', name: '관직 정보', url: '/info/officer' },
          { type: 'item', name: '토너먼트', url: '/info/tournament' },
          { type: 'item', name: '배팅', url: '/info/betting' },
          { type: 'item', name: '내 상관', url: '/my-boss-info' },
          { type: 'item', name: '내 장수', url: '/my-gen-info' }
        ]
      },
      
      // 3. 국가 (드롭다운)
      {
        type: 'multi',
        name: '국가',
        subMenu: [
          { type: 'item', name: '국가 장수', url: '/nation/generals' },
          { type: 'item', name: '내무부', url: '/nation/stratfinan' },
          { type: 'item', name: '국가 배팅', url: '/nation/betting' }
        ]
      },
      
      // 4. 전투 (드롭다운)
      {
        type: 'multi',
        name: '전투',
        subMenu: [
          { type: 'item', name: '전투 센터', url: '/battle-center' },
          { type: 'item', name: '시뮬레이터', url: '/battle-simulator' }
        ]
      },
      
      // 5. 외교
      {
        type: 'split',
        name: '외교',
        main: { name: '외교', url: '/diplomacy' },
        subMenu: [
          { type: 'item', name: '외교 처리', url: '/diplomacy/process' }
        ]
      },
      
      // 6. 사회 (드롭다운)
      {
        type: 'multi',
        name: '사회',
        subMenu: [
          { type: 'item', name: '게시판', url: '/board' },
          ...(hasSecretPermission ? [{ type: 'item', name: '기밀 게시판', url: '/board/secret' }] : []),
          { type: 'item', name: '제왕', url: '/chief' },
          { type: 'item', name: '역사', url: '/history' }
        ]
      },
      
      // 7. 경제 (드롭다운)
      {
        type: 'multi',
        name: '경제',
        subMenu: [
          { type: 'item', name: '경매', url: '/auction', enabled: sessionData.auction_enabled !== false },
          { type: 'item', name: '배팅', url: '/betting', enabled: sessionData.is_betting_active || false },
          { type: 'item', name: '유산', url: '/inherit' }
        ].filter(item => item.enabled !== false)
      },
      
      // 8. 군사 (드롭다운)
      {
        type: 'multi',
        name: '군사',
        subMenu: [
          { type: 'item', name: '부대', url: '/troop' },
          ...(hasNPCControl ? [{ type: 'item', name: 'NPC 제어', url: '/npc-control' }] : [])
        ]
      },
      
      // 9. 기타 (드롭다운)
      {
        type: 'multi',
        name: '기타',
        subMenu: [
          { type: 'item', name: '투표', url: '/vote' },
          { type: 'item', name: '토너먼트', url: '/tournament' },
          { type: 'item', name: '토너먼트 센터', url: '/tournament-center' },
          { type: 'item', name: '세계 정보', url: '/world' }
        ]
      },
      
      // 10. 맵 (드롭다운)
      {
        type: 'multi',
        name: '맵',
        subMenu: [
          { type: 'item', name: '최근 맵', url: '/map/recent' },
          { type: 'item', name: '캐시 맵', url: '/map/cached' }
        ]
      },
      
      // 11. 명령 처리
      {
        type: 'item',
        name: '명령',
        url: '/processing'
      },
      
      // 12. 기록 (드롭다운)
      {
        type: 'multi',
        name: '기록',
        subMenu: [
          { type: 'item', name: '명예의 전당', url: '/archive/hall-of-fame' },
          { type: 'item', name: '최고 장수', url: '/archive/best-general' },
          { type: 'item', name: '장수 목록', url: '/archive/gen-list' },
          { type: 'item', name: 'NPC 목록', url: '/archive/npc-list' },
          { type: 'item', name: '국가 목록', url: '/archive/kingdom-list' },
          { type: 'item', name: '황제 목록', url: '/archive/emperior' },
          { type: 'item', name: '교통 정보', url: '/archive/traffic' }
        ]
      }
    ];
    
    // 13. 관리자 메뉴 (조건부)
    if (isAdmin) {
      menu.push({
        type: 'multi',
        name: '관리자',
        subMenu: [
          { type: 'item', name: '게임 관리', url: '/admin/game' },
          { type: 'item', name: '시간 제어', url: '/admin/time-control' },
          { type: 'item', name: '정보 조회', url: '/admin/info' },
          { type: 'item', name: '회원 관리', url: '/admin/member' },
          { type: 'item', name: '장수 관리', url: '/admin/general' },
          { type: 'item', name: '외교 관리', url: '/admin/diplomacy' },
          { type: 'item', name: '강제 재합류', url: '/admin/force-rehall' }
        ]
      });
    }
    
    res.json({
      success: true,
      result: true,
      menu,
      version: 2,
      user: {
        permission,
        officerLevel,
        isAdmin
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/get-const:
 *   get:
 *     summary: 글로벌 상수 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 상수 정보
 */
router.get('/get-const', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { default: GameConstants } = await import('../utils/game-constants');
    
    // 게임 상수 반환
    const constants = {
      MAX_TURN: GameConstants.MAX_TURN || 30,
      MAX_GENERAL: GameConstants.MAX_GENERAL || 500,
      MAX_NATION: GameConstants.MAX_NATION || 55,
      DEFAULT_STAT_MIN: GameConstants.DEFAULT_STAT_MIN || 30,
      DEFAULT_STAT_MAX: GameConstants.DEFAULT_STAT_MAX || 100,
      DEFAULT_STAT_TOTAL: GameConstants.DEFAULT_STAT_TOTAL || 200,
      DEFAULT_START_YEAR: GameConstants.DEFAULT_START_YEAR || 180,
      DEFAULT_GOLD: GameConstants.DEFAULT_GOLD || 1000,
      DEFAULT_RICE: GameConstants.DEFAULT_RICE || 1000,
      MAX_LEVEL: GameConstants.MAX_LEVEL || 255
    };
    
    res.json({
      result: true,
      data: constants,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/get-nation-list:
 *   get:
 *     summary: 국가 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 국가 목록
 */
router.get('/get-nation-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = (req.query.session_id || req.query.serverID || 'sangokushi_default') as string;
    const result = await GetNationListService.execute({ session_id: sessionId }, req.user);
    if (result.success && result.nations) {
      res.json({
        result: true,
        nationList: result.nations
      });
    } else {
      res.json({
        result: false,
        nationList: {},
        reason: result.message || '국가 목록을 조회할 수 없습니다'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/general-list:
 *   post:
 *     summary: 전체 장수 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 장수 목록
 */
router.post('/general-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || req.body.serverID || req.query.serverID || 'sangokushi_default';
    
    const { General } = await import('../models');
    const generals = await (General as any).find({ session_id: sessionId })
      .sort({ 'data.experience': -1 })
      .limit(1000)
      .lean();
    
    const generalList = generals.map((g: any) => {
      const genData = g.data || {};
      return {
        no: genData.no || g.no,
        name: g.name || genData.name || '',
        nation: genData.nation || 0,
        city: genData.city || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0,
        experience: genData.experience || 0,
        explevel: genData.explevel || 0,
        npc: genData.npc || 0
      };
    });
    
    res.json({
      result: true,
      generalList
    });
  } catch (error) {
    next(error);
  }
});

export default router;
