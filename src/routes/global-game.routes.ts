import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { sessionMiddleware } from '../common/middleware/session.middleware';

const router: import('express').Router = Router();

// 세션 미들웨어 적용
router.use(sessionMiddleware);

/**
 * @swagger
 * /api/global/map:
 *   post:
 *     summary: 전역 맵 정보 조회 (PHP GlobalGetMap 대응)
 *     description: |
 *       게임 전체 지도 정보를 조회합니다.
 *       PHP 버전의 GlobalGetMap.php 에 대응합니다.
 *     tags: [Global]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverID:
 *                 type: string
 *                 description: 서버 ID
 *               neutralView:
 *                 type: number
 *                 description: 중립 시야 (0 또는 1)
 *               showMe:
 *                 type: number
 *                 description: 자신 위치 표시 (0 또는 1)
 *     responses:
 *       200:
 *         description: 전역 맵 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: boolean
 *                 map:
 *                   type: array
 *                   description: 맵 데이터
 */
router.post('/map', authenticate, async (req, res) => {
  try {
    const { serverID, neutralView, showMe } = req.body;

    // TODO: 실제 맵 데이터 조회 로직 구현
    // 현재는 더미 데이터로 응답
    const response = {
      success: true,
      result: true,
      map: [
        {
          id: 1,
          name: '테스트도시',
          x: 100,
          y: 100,
          nation: 1,
          nationName: '테스트국가',
          nationColor: '#FF0000',
          level: 1,
          population: 10000,
          agriculture: 50,
          commerce: 50,
          technology: 50,
          defense: 50,
          wall: 50,
          general: 1
        }
      ]
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error in global/map:', error);
    res.status(500).json({ 
      success: false, 
      result: false, 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/global/menu:
 *   post:
 *     summary: 전역 메뉴 정보 조회 (PHP GlobalGetMenu 대응)
 *     description: |
 *       게임 메뉴 정보를 조회합니다.
 *       PHP 버전의 GlobalGetMenu.php 에 대응합니다.
 *     tags: [Global]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverID:
 *                 type: string
 *                 description: 서버 ID
 *     responses:
 *       200:
 *         description: 전역 메뉴 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 menu:
 *                   type: array
 *                   description: 메뉴 항목들
 */
router.post('/menu', authenticate, async (req, res) => {
  try {
    const { serverID } = req.body || {};

    // TODO: 실제 메뉴 데이터 조회 로직 구현
    // 현재는 더미 메뉴 데이터로 응답
    const response = {
      success: true,
      menu: [
        {
          id: 'battle',
          name: '전투',
          url: '/battle',
          icon: '⚔️',
          order: 1
        },
        {
          id: 'diplomacy',
          name: '외교',
          url: '/diplomacy',
          icon: '🤝',
          order: 2
        },
        {
          id: 'troop',
          name: '병력',
          url: '/troop',
          icon: '👥',
          order: 3
        },
        {
          id: 'city',
          name: '도시',
          url: '/info/city',
          icon: '🏰',
          order: 4
        },
        {
          id: 'general',
          name: '장수',
          url: '/info/general',
          icon: '👤',
          order: 5
        },
        {
          id: 'nation',
          name: '국가',
          url: '/nation',
          icon: '🏛️',
          order: 6
        },
        {
          id: 'board',
          name: '게시판',
          url: '/board',
          icon: '📋',
          order: 7
        },
        {
          id: 'history',
          name: '역사',
          url: '/history',
          icon: '📚',
          order: 8
        }
      ]
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error in global/menu:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/global/const:
 *   get:
 *     summary: 게임 상수 조회 (PHP GlobalGetConst 대응)
 *     description: |
 *       게임 상수(설정값)들을 조회합니다.
 *       PHP 버전의 GlobalGetConst.php 에 대응합니다.
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 게임 상수 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     gameConst:
 *                       type: object
 *                       description: 게임 상수
 */
router.get('/const', async (req, res) => {
  try {
    // TODO: 실제 게임 상수 조회 로직 구현
    // 현재는 더미 상수 데이터로 응답
    const response = {
      result: true,
      data: {
        gameConst: {
          turnTerm: 60,
          maxGeneral: 200,
          maxNation: 12,
          startYear: 188,
          maxCityLevel: 5,
          maxGeneralLevel: 10,
          maxTechnology: 100,
          maxWall: 100,
          maxPopulation: 100000,
          maxAgriculture: 100,
          maxCommerce: 100,
          maxDefense: 100,
          maxCrew: 10000,
          maxGold: 999999,
          maxRice: 999999,
          maxExperience: 1000,
          maxInjury: 100
        }
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error in global/const:', error);
    res.status(500).json({ 
      result: false, 
      message: error.message 
    });
  }
});

export default router;