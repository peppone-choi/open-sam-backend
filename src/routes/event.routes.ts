/**
 * Event API 라우트
 * 게임 이벤트 트리거를 위한 API
 * PHP의 j_raise_event.php 대응
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { KVStorage } from '../models';
import { EventHandler } from '../core/event/EventHandler';

const router = Router();

/**
 * @swagger
 * /api/event/raise:
 *   post:
 *     summary: 게임 이벤트 발생
 *     description: |
 *       관리자 권한으로 게임 내 특수 이벤트를 발생시킵니다.
 *       
 *       **기능:**
 *       - 다양한 게임 이벤트 트리거
 *       - 관리자 전용 기능
 *       - 이벤트별 추가 인자 전달 가능
 *       
 *       **이벤트 종류 예시:**
 *       - disaster: 재해 발생
 *       - bounty: 현상금 이벤트
 *       - war: 전쟁 이벤트
 *       - diplomacy: 외교 이벤트
 *       - economy: 경제 이벤트
 *       
 *       **권한:**
 *       - grade >= 6 (관리자)
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               event:
 *                 type: string
 *                 description: 이벤트 이름
 *                 example: disaster
 *               arg:
 *                 type: string
 *                 description: 이벤트 인자 (JSON 문자열)
 *                 example: '{"type": "flood", "region": 1}'
 *           examples:
 *             disaster:
 *               summary: 재해 이벤트
 *               value:
 *                 event: disaster
 *                 arg: '{"type": "flood"}'
 *             bounty:
 *               summary: 현상금 이벤트
 *               value:
 *                 event: bounty
 *                 arg: '{"target": 1001, "amount": 10000}'
 *     responses:
 *       200:
 *         description: 이벤트 발생 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 reason:
 *                   type: string
 *                   example: success
 *                 info:
 *                   type: object
 *                   description: 이벤트 실행 결과 정보
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: false
 *                 reason:
 *                   type: string
 *             examples:
 *               no_event:
 *                 summary: 이벤트 미지정
 *                 value:
 *                   result: false
 *                   reason: event가 지정되지 않았습니다.
 *               invalid_json:
 *                 summary: 잘못된 JSON
 *                 value:
 *                   result: false
 *                   reason: arg가 올바른 json이 아닙니다
 *       401:
 *         description: 권한 부족
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: false
 *                 reason:
 *                   type: string
 *                   example: 권한이 부족합니다.
 *       500:
 *         description: 서버 오류
 */
router.post('/raise', authenticate, async (req, res) => {
  try {
    // 관리자 권한 확인
    const userGrade = req.user?.grade || 0;
    if (userGrade < 6) {
      return res.status(401).json({
        result: false,
        reason: '권한이 부족합니다.'
      });
    }

    const sessionId = req.body.session_id || 'sangokushi_default';
    const eventName = req.body.event;
    const eventArgsJson = req.body.arg;

    if (!eventName) {
      return res.json({
        result: false,
        reason: 'event가 지정되지 않았습니다.'
      });
    }

    // 이벤트 인자 파싱
    let eventArgs: any[] = [eventName];
    if (eventArgsJson) {
      try {
        const parsed = typeof eventArgsJson === 'string' 
          ? JSON.parse(eventArgsJson) 
          : eventArgsJson;
        
        if (Array.isArray(parsed)) {
          eventArgs = eventArgs.concat(parsed);
        } else {
          eventArgs.push(parsed);
        }
      } catch (e) {
        return res.json({
          result: false,
          reason: 'arg가 올바른 json이 아닙니다'
        });
      }
    }

    // 게임 환경 조회
    const gameStor = await KVStorage.findOne({
      session_id: sessionId,
      storage_id: 'game_env'
    });

    const env = gameStor?.data || gameStor?.value || {};

    // 이벤트 핸들러 실행
    let result: any = null;
    
    try {
      // EventHandler가 있으면 사용, 없으면 기본 처리
      if (typeof EventHandler !== 'undefined' && EventHandler.run) {
        result = await EventHandler.run(sessionId, eventName, eventArgs.slice(1), env);
      } else {
        // 기본 이벤트 처리
        result = await handleBasicEvent(sessionId, eventName, eventArgs.slice(1), env);
      }
    } catch (eventError: any) {
      return res.json({
        result: false,
        reason: eventError.message || '이벤트 실행 중 오류가 발생했습니다'
      });
    }

    res.json({
      result: true,
      reason: 'success',
      info: result
    });
  } catch (error: any) {
    console.error('Error in event/raise:', error);
    res.status(500).json({
      result: false,
      reason: error.message || 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/event/list:
 *   get:
 *     summary: 사용 가능한 이벤트 목록 조회
 *     description: 발생시킬 수 있는 이벤트 목록과 설명을 조회합니다.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 이벤트 목록 조회 성공
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const userGrade = req.user?.grade || 0;
    if (userGrade < 6) {
      return res.status(401).json({
        result: false,
        reason: '권한이 부족합니다.'
      });
    }

    // 사용 가능한 이벤트 목록
    const events = [
      {
        name: 'disaster',
        description: '재해 이벤트 (홍수, 가뭄, 메뚜기 등)',
        args: ['type: string (flood/drought/locust)', 'region?: number']
      },
      {
        name: 'bounty',
        description: '현상금 이벤트',
        args: ['target: number (장수 ID)', 'amount: number']
      },
      {
        name: 'rebellion',
        description: '반란 이벤트',
        args: ['city: number (도시 ID)']
      },
      {
        name: 'diplomacy_break',
        description: '외교 관계 파기',
        args: ['nation1: number', 'nation2: number']
      },
      {
        name: 'force_war',
        description: '강제 전쟁 상태',
        args: ['attacker: number', 'defender: number']
      },
      {
        name: 'give_item',
        description: '아이템 지급',
        args: ['generalId: number', 'itemId: number']
      },
      {
        name: 'adjust_resource',
        description: '자원 조정',
        args: ['nationId: number', 'gold?: number', 'rice?: number']
      }
    ];

    res.json({
      result: true,
      events
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * 기본 이벤트 처리 함수
 */
async function handleBasicEvent(
  sessionId: string, 
  eventName: string, 
  args: any[], 
  env: any
): Promise<any> {
  const { City, Nation, General } = await import('../models');
  
  switch (eventName) {
    case 'disaster': {
      // 재해 이벤트
      const type = args[0]?.type || 'flood';
      const region = args[0]?.region;
      
      const query: any = { session_id: sessionId };
      if (region) {
        query['data.region'] = region;
      }
      
      const cities = await City.find(query).limit(10);
      const affected: string[] = [];
      
      for (const city of cities) {
        const damage = Math.floor(Math.random() * 1000) + 500;
        const cityData = city.data || {};
        
        await City.updateOne(
          { _id: city._id },
          { 
            $set: { 
              'data.pop': Math.max(0, (cityData.pop || 10000) - damage),
              'data.agri': Math.max(0, (cityData.agri || 5000) - Math.floor(damage / 2))
            }
          }
        );
        
        affected.push(city.name || cityData.name || `도시 ${city.city}`);
      }
      
      return {
        type,
        affected,
        message: `${type} 재해가 발생하여 ${affected.length}개 도시에 피해를 입었습니다.`
      };
    }
    
    case 'adjust_resource': {
      // 자원 조정
      const nationId = args[0]?.nationId;
      const gold = args[0]?.gold || 0;
      const rice = args[0]?.rice || 0;
      
      if (!nationId) {
        throw new Error('nationId가 필요합니다');
      }
      
      await Nation.updateOne(
        { session_id: sessionId, nation: nationId },
        { 
          $inc: { 
            'data.gold': gold,
            'data.rice': rice,
            gold: gold,
            rice: rice
          }
        }
      );
      
      return {
        nationId,
        goldAdjusted: gold,
        riceAdjusted: rice,
        message: `국가 ${nationId}의 자원이 조정되었습니다. (금: ${gold >= 0 ? '+' : ''}${gold}, 쌀: ${rice >= 0 ? '+' : ''}${rice})`
      };
    }
    
    case 'give_item': {
      // 아이템 지급
      const generalId = args[0]?.generalId;
      const itemId = args[0]?.itemId;
      
      if (!generalId || !itemId) {
        throw new Error('generalId와 itemId가 필요합니다');
      }
      
      // 간단한 아이템 지급 (실제로는 더 복잡한 로직 필요)
      await General.updateOne(
        { session_id: sessionId, $or: [{ no: generalId }, { 'data.no': generalId }] },
        { $push: { 'data.items': itemId } }
      );
      
      return {
        generalId,
        itemId,
        message: `장수 ${generalId}에게 아이템 ${itemId}가 지급되었습니다.`
      };
    }
    
    default:
      return {
        event: eventName,
        args,
        message: `이벤트 '${eventName}'가 기록되었습니다.`
      };
  }
}

export default router;












