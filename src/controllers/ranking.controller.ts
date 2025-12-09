import { Request, Response } from 'express';
import { Nation, INation } from '../models/nation.model';
import { WorldHistory, IWorldHistory } from '../models/world_history.model';
import { logger } from '../common/logger';
import { Hall } from '../models/hall.model';

/**
 * 랭킹 및 역사 조회 컨트롤러
 */
export class RankingController {

  /**
   * @swagger
   * /ranking/generals:
   *   get:
   *     summary: 역대 장수 랭킹 조회
   *     tags: [Ranking]
   *     description: |
   *       명예의 전당(Hall) 컬렉션을 기준으로 장수 랭킹을 조회합니다.
   *       기본 정렬은 `killnum`(사살 횟수) 내림차순이며, page/limit 기반 페이지네이션을 지원합니다.
   *     parameters:
   *       - in: query
   *         name: session_id
   *         schema:
   *           type: string
   *         description: 세션 ID (생략 시 최신 Hall 데이터의 server_id를 사용)
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [experience, dedication, firenum, warnum, killnum, winrate, killcrew, killrate, occupied, merit_official, emperor]
   *         description: 정렬 기준 (Hall.type)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: 페이지 번호(1부터, 기본 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: 페이지당 개수(1~100, 기본 20)
   *     responses:
   *       200:
   *         description: 장수 랭킹 목록
   */
  public async getGeneralRanking(req: Request, res: Response): Promise<void> {
    try {
      const rawSessionId = req.query.session_id as string;
      const sortParam = (req.query.sort as string) || 'killnum';
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

      const sortKey = sortParam.toLowerCase();
      const sortMap: Record<string, string> = {
        experience: 'experience',
        dedication: 'dedication',
        firenum: 'firenum',
        warnum: 'warnum',
        killnum: 'killnum',
        winrate: 'winrate',
        killcrew: 'killcrew',
        killrate: 'killrate',
        occupied: 'occupied',
        merit_official: 'merit_official',
        emperor: 'emperor'
      };

      const hallType = sortMap[sortKey];
      if (!hallType) {
        res.status(400).json({
          success: false,
          message: '지원하지 않는 정렬 기준입니다.',
          allowed: Object.keys(sortMap)
        });
        return;
      }

      let sessionId = rawSessionId;
      if (!sessionId) {
        const latestHall = await Hall.findOne({ type: hallType }).sort({ _id: -1 }).select('server_id').lean();
        sessionId = latestHall?.server_id;
      }

      const filter: any = { type: hallType };
      if (sessionId) {
        filter.server_id = sessionId;
      }

      const total = await Hall.countDocuments(filter);
      const entries = await Hall.find(filter)
        .sort({ value: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const data = entries.map((entry, index) => ({
        rank: (page - 1) * limit + index + 1,
        generalNo: entry.general_no,
        type: entry.type,
        value: entry.value,
        season: entry.season,
        scenario: entry.scenario,
        owner: entry.owner,
        serverId: entry.server_id,
        aux: entry.aux
      }));

      res.status(200).json({
        success: true,
        sort: hallType,
        session_id: sessionId,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        data
      });
    } catch (error) {
      logger.error('장수 랭킹 조회 중 오류 발생', { error });
      res.status(500).json({
        success: false,
        message: '장수 랭킹을 조회하는 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * @swagger
   * /ranking/nations:
   *   get:
   *     summary: 국가 랭킹 조회
   *     tags: [Ranking]
   *     description: 현재 세션의 국가 랭킹을 조회합니다. 국력(rate) 내림차순으로 정렬됩니다.
   *     responses:
   *       200:
   *         description: 국가 랭킹 목록
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 nations:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Nation'
   */
  public async getNationRanking(req: Request, res: Response): Promise<void> {
    try {
      // 1. 세션 ID 가져오기 (헤더 또는 세션에서)
      // 여기서는 req.sessionID 또는 헤더에서 가져온다고 가정. 
      // 하지만 현재 코드 베이스에서는 req.session 객체에 접근하거나, 
      // 명시적인 session_id 파라미터가 없을 수 있음.
      // 보통 Nation 조회시 session_id가 필요함.
      // 임시로 DB에서 가장 최근 session_id를 찾거나, 미들웨어에서 주입된 값을 사용.
      
      // 여기서는 일반적인 방법으로, req.body나 query에서 받거나, 없으면 전체 검색 후 필터링
      // 하지만 Nation 모델을 보면 session_id가 필수임.
      // 기존 NationController를 참고하면 session_id를 어떻게 얻는지 알 수 있음.
      // 일단은 쿼리 파라미터로 session_id를 받을 수 있도록 하고, 없으면 에러 처리 보단
      // 현재 활성화된 세션을 찾아야 할 수도 있음.
      // 편의상 여기서는 session_id가 없으면 가장 최근 세션의 국가들을 가져오도록 구현.

      let sessionId = req.query.session_id as string;

      if (!sessionId) {
          // 가장 최근에 생성된 Nation의 session_id를 찾음 (임시 방편)
          // @ts-ignore - mongoose union type compatibility
          const latestNation = await Nation.findOne().sort({ createdAt: -1 }).select('session_id');
          if (latestNation) {
              sessionId = latestNation.session_id;
          }
      }

      const query = sessionId ? { session_id: sessionId } : {};

      // 멸망하지 않은 국가만 조회할지 여부는 기획에 따라 다름.
      // level > 0 인 국가만 조회 (0은 재야/공백지 일 수 있음)
      
      // @ts-ignore - mongoose union type compatibility
      const nations = await Nation.find({
        ...query,
        level: { $gt: 0 } 
      })
      .sort({ rate: -1, gennum: -1, gold: -1 }) // 국력 > 장수 수 > 금 순으로 정렬
      .lean();

      res.status(200).json({
        success: true,
        nations
      });

    } catch (error) {
      logger.error('국가 랭킹 조회 중 오류 발생', { error });
      res.status(500).json({
        success: false,
        message: '국가 랭킹을 조회하는 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * @swagger
   * /ranking/history:
   *   get:
   *     summary: 역대 연혁 조회
   *     tags: [Ranking]
   *     description: 현재 세션의 연혁(역사 기록)을 조회합니다.
   *     parameters:
   *       - in: query
   *         name: session_id
   *         schema:
   *           type: string
   *         description: 세션 ID (생략 시 최신 세션)
   *       - in: query
   *         name: nation_id
   *         schema:
   *           type: integer
   *         description: 특정 국가의 역사만 조회 (0이면 전역 역사, 생략 시 전체)
   *     responses:
   *       200:
   *         description: 연혁 목록
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 history:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/WorldHistory'
   */
  public async getHistory(req: Request, res: Response): Promise<void> {
    try {
      let sessionId = req.query.session_id as string;
      const nationId = req.query.nation_id ? parseInt(req.query.nation_id as string, 10) : undefined;

      if (!sessionId) {
        // 가장 최근 History의 session_id 찾기
        // @ts-ignore - mongoose union type compatibility
        const latestHistory = await WorldHistory.findOne().sort({ created_at: -1 }).select('session_id');
        if (latestHistory) {
          sessionId = latestHistory.session_id;
        }
      }

      const query: any = {};
      if (sessionId) {
        query.session_id = sessionId;
      }
      
      if (nationId !== undefined) {
        query.nation_id = nationId;
      }

      // 최신순(연도 역순) 또는 과거순 정렬. 보통 연혁은 과거 -> 현재 순으로 보여주거나
      // 최신 사건을 위로 보여줌. 여기서는 최신 사건을 먼저 보여주도록(내림차순) 설정.
      // @ts-ignore - mongoose union type compatibility
      const history = await WorldHistory.find(query)
        .sort({ year: -1, month: -1, _id: -1 })
        .limit(1000) // 너무 많은 데이터 방지
        .lean();

      res.status(200).json({
        success: true,
        history
      });

    } catch (error) {
      logger.error('연혁 조회 중 오류 발생', { error });
      res.status(500).json({
        success: false,
        message: '연혁을 조회하는 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

