import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { sessionMiddleware } from '../common/middleware/session.middleware';

const router: import('express').Router = Router();

// 세션 미들웨어 적용
router.use(sessionMiddleware);

/**
 * @swagger
 * /api/general/front-info:
 *   post:
 *     summary: 게임 프론트 정보 조회 (PHP GeneralGetFrontInfo 대응)
 *     description: |
 *       게임 메인 화면에 필요한 전반적인 정보를 조회합니다.
 *       PHP 버전의 GeneralGetFrontInfo.php 에 대응합니다.
 *     tags: [General]
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
 *               lastNationNoticeDate:
 *                 type: string
 *                 description: 마지막으로 확인한 국가 공지 날짜
 *               lastGeneralRecordID:
 *                 type: number
 *                 description: 마지막으로 확인한 장수 기록 ID
 *               lastPersonalHistoryID:
 *                 type: number
 *                 description: 마지막으로 확인한 개인 기록 ID
 *               lastGlobalHistoryID:
 *                 type: number
 *                 description: 마지막으로 확인한 전역 기록 ID
 *     responses:
 *       200:
 *         description: 게임 프론트 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: boolean
 *                 global:
 *                   type: object
 *                   description: 전역 정보
 *                 general:
 *                   type: object
 *                   description: 장수 정보
 *                 recentRecord:
 *                   type: array
 *                   description: 최근 기록
 */
router.get('/get-front-info', authenticate, async (req, res) => {
  try {
    const {
      serverID,
      lastNationNoticeDate,
      lastGeneralRecordID,
      lastPersonalHistoryID,
      lastGlobalHistoryID
    } = req.query as any;

    // TODO: 실제 데이터베이스에서 데이터 조회 로직 구현
    // 현재는 더미 데이터로 응답
    const response = {
      success: true,
      result: true,
      global: {
        serverName: serverID,
        scenarioText: '삼국지 시나리오',
        extendedGeneral: 1,
        isFiction: 0,
        npcMode: 1,
        joinMode: 'full',
        startyear: 188,
        year: 200,
        month: 1,
        autorunUser: {
          limit_minutes: 30,
          options: {}
        },
        turnterm: 60,
        lastExecuted: new Date().toISOString(),
        lastVoteID: 0,
        develCost: 1000,
        noticeMsg: 0,
        onlineNations: null,
        onlineUserCnt: 0,
        apiLimit: 100,
        auctionCount: 0,
        isTournamentActive: false,
        isTournamentApplicationOpen: false,
        isBettingActive: false,
        isLocked: false,
        tournamentType: null,
        tournamentState: 0,
        tournamentTime: '',
        genCount: [],
        generalCntLimit: 200,
        serverCnt: 1,
        lastVote: null
      },
      general: {
        no: 1,
        name: '테스트장수',
        officerLevel: 1,
        officerLevelText: '군주',
        city: 1,
        permission: 0b1111111111111111,
        leadership: 80,
        strength: 80,
        intel: 80,
        nation: 1,
        nationName: '테스트국가',
        personal: 0,
        gold: 10000,
        rice: 10000,
        crew: 1000,
        train: 50,
        atmos: 50,
        weapon: 1,
        weaponName: '검',
        crewtype: 12,
        crewtypeName: '보병',
        age: 30,
        dext: 50,
        dexterity: 50,
        experience: 0,
        injury: 0,
        killturn: 0,
        killnum: 0,
        deadturn: 0,
        deadnum: 0,
        leadershipBonus: 0,
        strengthBonus: 0,
        intelBonus: 0,
        nationLevel: 1,
        nationColor: '#FF0000',
        imgsvr: 0,
        picture: 'default.png'
      },
      recentRecord: [],
      city: {
        name: '테스트도시',
        level: 1,
        population: 10000,
        agriculture: 50,
        commerce: 50,
        technology: 50,
        defense: 50,
        wall: 50
      },
      map: [],
      command: [],
      reservedCommand: [],
      reservedCommandCnt: 0,
      myCity: 1,
      myNation: 1,
      spyList: {},
      shownByGeneralList: [],
      startYear: 188,
      year: 200,
      month: 1,
      version: 1
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error in general/front-info:', error);
    res.status(500).json({
      success: false,
      result: false,
      message: error.message
    });
  }
});

export default router;