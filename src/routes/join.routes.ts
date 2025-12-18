import { Router } from 'express';
import { optionalAuth, authenticate } from '../middleware/auth';
import { GetJoinInfoService } from '../services/general/GetJoinInfo.service';
import { JoinService } from '../services/general/Join.service';
import { validate, generalJoinSchema, preventMongoInjection } from '../middleware/validation.middleware';
import { General, KVStorage } from '../models';

const router = Router();

/**
 * @swagger
 * /api/join/get-nations:
 *   post:
 *     summary: 장수 생성 가능한 국가 목록 조회
 *     tags: [Join]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverID:
 *                 type: string
 *               session_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 국가 목록 조회 성공
 */
router.post('/get-nations', optionalAuth, async (req, res) => {
  try {
    // serverID를 session_id로 매핑 (프론트엔드 호환성)
    const params = {
      ...req.body,
      ...req.query,
      session_id: req.body.session_id || req.query.session_id || req.body.serverID || req.query.serverID || 'sangokushi_default',
    };
    
    const result = await GetJoinInfoService.execute(params, req.user);
    
    // GetJoinInfoService는 nations를 반환하므로 형식 맞춤
    if (result.result && result.nations) {
      res.json({
        result: true,
        nations: result.nations,
        statLimits: result.statLimits,
        cities: result.cities || [],
      });
    } else {
      res.json({
        result: false,
        nations: [],
        reason: result.reason || '국가 목록을 불러올 수 없습니다',
      });
    }
  } catch (error: any) {
    res.status(400).json({
      result: false,
      nations: [],
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/join/create-general:
 *   post:
 *     summary: 장수 생성
 *     tags: [Join]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - nation
 *             properties:
 *               name:
 *                 type: string
 *               nation:
 *                 type: number
 *               icon:
 *                 type: number
 *               npcType:
 *                 type: number
 *               serverID:
 *                 type: string
 *               session_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 장수 생성 성공
 */
router.post('/create-general', optionalAuth, preventMongoInjection('body'), validate(generalJoinSchema), async (req, res) => {
  try {
    // serverID를 session_id로 매핑
    const params = {
      ...req.body,
      session_id: req.body.session_id || req.body.serverID || 'sangokushi_default',
    };
    
    const result = await JoinService.execute(params, req.user);
    
    if (result.success) {
      res.json({
        result: true,
        reason: result.message || '장수 생성 성공',
        general: result.general,
      });
    } else {
      res.status(400).json({
        result: false,
        reason: result.message || '장수 생성에 실패했습니다',
      });
    }
  } catch (error: any) {
    res.status(400).json({
      result: false,
      reason: error.message,
    });
  }
});

/**
 * @swagger
 * /api/join/select-pool:
 *   get:
 *     summary: 선택 가능한 장수 풀 조회
 *     description: |
 *       NPC 선택 모드에서 선택 가능한 장수 목록을 조회합니다.
 *       유저에게 할당된 장수 후보들을 반환합니다.
 *       
 *       **기능:**
 *       - 랜덤 선택된 14명의 NPC 후보 반환
 *       - 각 후보의 능력치, 특기 정보 포함
 *       - 유효기간(validUntil) 내에만 선택 가능
 *       
 *       **요구사항:**
 *       - npcmode가 2인 서버에서만 동작
 *       - 로그인 필수
 *     tags: [Join]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *     responses:
 *       200:
 *         description: 선택 풀 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 pick:
 *                   type: array
 *                   description: 선택 가능한 장수 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       no:
 *                         type: number
 *                       name:
 *                         type: string
 *                       leadership:
 *                         type: number
 *                       strength:
 *                         type: number
 *                       intel:
 *                         type: number
 *                       specialDomestic:
 *                         type: string
 *                       specialWar:
 *                         type: string
 *                 validUntil:
 *                   type: string
 *                   format: date-time
 *                   description: 선택 유효 기간
 *       400:
 *         description: 선택 불가능한 상태
 */
router.get('/select-pool', authenticate, async (req, res) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '로그인이 필요합니다'
      });
    }

    // 게임 환경 확인
    const gameStor = await KVStorage.findOne({ 
      session_id: sessionId, 
      storage_id: 'game_env' 
    });
    
    const npcmode = gameStor?.data?.npcmode || gameStor?.value?.npcmode || 0;
    
    if (npcmode !== 2) {
      return res.json({
        result: false,
        reason: '선택 가능한 서버가 아닙니다'
      });
    }

    // 이미 장수가 있는지 확인
    const existingGeneral = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    }).select('no data.aux').lean();

    if (existingGeneral) {
      const aux = (existingGeneral as any).data?.aux || {};
      const nextChange = aux.next_change;
      if (nextChange && new Date(nextChange) > new Date()) {
        return res.json({
          result: false,
          reason: '아직 다시 고를 수 없습니다'
        });
      }
    }

    // 기존 토큰 확인
    const now = new Date();
    const selectPool = await KVStorage.findOne({
      session_id: sessionId,
      storage_id: `select_pool_${userId}`
    });

    if (selectPool && selectPool.data?.validUntil && new Date(selectPool.data.validUntil) > now) {
      return res.json({
        result: true,
        pick: selectPool.data.pick || [],
        validUntil: selectPool.data.validUntil
      });
    }

    // 새로운 선택 풀 생성 (NPC 중에서 랜덤 선택)
    const availableNPCs = await General.find({
      session_id: sessionId,
      'data.npc': 2,  // 빙의 가능한 NPC
      'data.owner': { $lte: 0 }  // 소유자 없음
    })
    .select('no name data')
    .limit(100)
    .lean();

    if (!availableNPCs || availableNPCs.length === 0) {
      return res.json({
        result: false,
        reason: '선택 가능한 장수가 없습니다'
      });
    }

    // 14명 랜덤 선택
    const shuffled = availableNPCs.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(14, shuffled.length));

    const pick = selected.map((gen: any) => {
      const data = gen.data || {};
      return {
        no: data.no || gen.no,
        uniqueName: gen.name,
        name: gen.name || data.name,
        leadership: data.leadership || 50,
        strength: data.strength || 50,
        intel: data.intel || 50,
        dex: [data.leadership || 50, data.strength || 50, data.intel || 50],
        specialDomestic: data.special_domestic || data.specialDomestic || null,
        specialDomesticName: data.special_domestic_name || null,
        specialWar: data.special_war || data.specialWar || null,
        specialWarName: data.special_war_name || null,
        personal: data.personal || null,
        nation: data.nation || 0,
        city: data.city || 0
      };
    });

    // 능력치 합계로 정렬
    pick.sort((a: any, b: any) => {
      const sumA = (a.dex?.[0] || 0) + (a.dex?.[1] || 0) + (a.dex?.[2] || 0);
      const sumB = (b.dex?.[0] || 0) + (b.dex?.[1] || 0) + (b.dex?.[2] || 0);
      return sumA - sumB;
    });

    // 30분 유효
    const validUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    // 토큰 저장
    await KVStorage.findOneAndUpdate(
      { session_id: sessionId, storage_id: `select_pool_${userId}` },
      { 
        $set: { 
          data: { pick, validUntil },
          value: { pick, validUntil }
        }
      },
      { upsert: true }
    );

    res.json({
      result: true,
      pick,
      validUntil
    });
  } catch (error: any) {
    console.error('Error in select-pool:', error);
    res.status(500).json({
      result: false,
      reason: error.message || 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/join/select-npc:
 *   post:
 *     summary: NPC 선택 (빙의)
 *     description: |
 *       선택 풀에서 NPC를 선택하여 플레이어 장수로 등록합니다.
 *       
 *       **기능:**
 *       - 선택된 NPC를 플레이어 장수로 전환
 *       - 빙의 로그 기록
 *       - 선택 토큰 삭제
 *       
 *       **요구사항:**
 *       - npcmode가 1인 서버에서만 동작
 *       - 유효한 선택 토큰 필요
 *     tags: [Join]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pick
 *             properties:
 *               session_id:
 *                 type: string
 *               pick:
 *                 type: number
 *                 description: 선택할 NPC의 장수 번호
 *     responses:
 *       200:
 *         description: NPC 선택 성공
 */
router.post('/select-npc', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const userId = req.user?.userId;
    const pick = parseInt(req.body.pick);

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '로그인이 필요합니다'
      });
    }

    if (!pick) {
      return res.json({
        result: false,
        reason: '장수를 선택하지 않았습니다'
      });
    }

    // 게임 환경 확인
    const gameStor = await KVStorage.findOne({ 
      session_id: sessionId, 
      storage_id: 'game_env' 
    });
    
    const npcmode = gameStor?.data?.npcmode || gameStor?.value?.npcmode || 0;
    const maxgeneral = gameStor?.data?.maxgeneral || gameStor?.value?.maxgeneral || 500;
    const year = gameStor?.data?.year || gameStor?.value?.year || 184;
    const month = gameStor?.data?.month || gameStor?.value?.month || 1;
    
    if (npcmode !== 1) {
      return res.json({
        result: false,
        reason: '빙의 가능한 서버가 아닙니다'
      });
    }

    // 장수 수 확인
    const gencount = await General.countDocuments({
      session_id: sessionId,
      'data.npc': { $lt: 2 }
    });

    if (gencount >= maxgeneral) {
      return res.json({
        result: false,
        reason: '더 이상 등록 할 수 없습니다.'
      });
    }

    // 선택 토큰 확인
    const now = new Date();
    const selectToken = await KVStorage.findOne({
      session_id: sessionId,
      storage_id: `select_npc_token_${userId}`
    });

    if (!selectToken || !selectToken.data?.validUntil || new Date(selectToken.data.validUntil) < now) {
      return res.json({
        result: false,
        reason: '유효한 장수 목록이 없습니다.'
      });
    }

    const pickResult = selectToken.data.pickResult || {};
    if (!pickResult[pick]) {
      return res.json({
        result: false,
        reason: '선택한 장수가 목록에 없습니다.'
      });
    }

    // NPC를 플레이어 장수로 전환
    const targetNPC = await General.findOne({
      session_id: sessionId,
      $or: [
        { no: pick },
        { 'data.no': pick }
      ],
      'data.npc': 2,
      'data.owner': { $lte: 0 }
    });

    if (!targetNPC) {
      return res.json({
        result: false,
        reason: '해당 NPC를 찾을 수 없거나 이미 선택되었습니다.'
      });
    }

    // 업데이트
    const userName = req.user?.name || '플레이어';
    await General.updateOne(
      { _id: targetNPC._id },
      {
        $set: {
          owner: String(userId),
          'data.owner': userId,
          'data.owner_name': userName,
          'data.npc': 1,
          'data.killturn': 6,
          'data.defence_train': 80,
          'data.permission': 'normal',
          'data.aux.pickYearMonth': year * 100 + month
        }
      }
    );

    // 토큰 삭제
    await KVStorage.deleteOne({
      session_id: sessionId,
      storage_id: `select_npc_token_${userId}`
    });

    res.json({
      result: true,
      reason: 'success'
    });
  } catch (error: any) {
    console.error('Error in select-npc:', error);
    res.status(500).json({
      result: false,
      reason: error.message || 'Internal server error'
    });
  }
});

export default router;

