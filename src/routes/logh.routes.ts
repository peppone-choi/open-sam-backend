/**
 * LOGH API Routes
 * 은하영웅전설 REST API 엔드포인트
 */

import { Router } from 'express';
import { Fleet } from '../models/logh/Fleet.model';
import { Planet } from '../models/logh/Planet.model';
import { StarSystem } from '../models/logh/StarSystem.model';
import { MapGrid } from '../models/logh/MapGrid.model';
import { TacticalMap } from '../models/logh/TacticalMap.model';
import { RealtimeMovementService } from '../services/logh/RealtimeMovement.service';
import { RealtimeCombatService } from '../services/logh/RealtimeCombat.service';
import { GameLoopManager } from '../services/logh/GameLoop.service';
import { LoghCommander } from '../models/logh/Commander.model';
import { CommanderWrapper } from '../models/logh/CommanderWrapper';
import { CommandRegistry } from '../core/command/CommandRegistry';
import galaxyRouter from './logh/galaxy.route';
import { LOGH_MESSAGES } from '../constants/messages';

const router = Router();
router.use('/galaxy', galaxyRouter);

/**
 * 세션 정보 가져오기 (미들웨어에서 설정)
 */
function getSessionId(req: any): string {
  return req.session?.id || req.query.sessionId || 'default';
}

// ==================== 맵 & 데이터 ====================

/**
 * GET /api/logh/map/grid
 * 전략 맵 그리드 데이터
 */
router.get('/map/grid', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const mapGrid = await MapGrid.findOne({ session_id: sessionId });

    if (!mapGrid) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.mapGridNotFound,
      });
    }

    res.json({
      success: true,
      data: {
        gridSize: mapGrid.gridSize,
        grid: mapGrid.grid,
        statistics: mapGrid.statistics,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/planets
 * 모든 행성 목록
 */
router.get('/planets', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const planets = await Planet.find({ session_id: sessionId });

    res.json({
      success: true,
      data: planets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/systems
 * 모든 성계 목록
 */
router.get('/systems', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const systems = await StarSystem.find({ session_id: sessionId });

    res.json({
      success: true,
      data: systems,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== 함대 관리 ====================

/**
 * GET /api/logh/fleets
 * 모든 함대 목록
 */
router.get('/fleets', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { faction } = req.query;

    const query: any = { session_id: sessionId };
    if (faction) {
      query.faction = faction;
    }

    const fleets = await Fleet.find(query);

    res.json({
      success: true,
      data: fleets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/fleets/:fleetId
 * 특정 함대 정보
 */
router.get('/fleets/:fleetId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { fleetId } = req.params;

    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.fleetNotFound,
      });
    }

    res.json({
      success: true,
      data: fleet,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/fleets
 * 함대 생성
 * 
 * @body {
 *   name: string,           // 함대 이름
 *   faction: 'empire' | 'alliance',  // 진영
 *   planetId?: string,      // 출발 행성 ID (planetId 또는 x,y 중 하나 필수)
 *   x?: number,             // 또는 그리드 X 좌표
 *   y?: number,             // 그리드 Y 좌표
 *   commanderId?: string,   // 사령관 ID (옵션)
 *   ships?: { [type: string]: number }  // 함선 구성 (옵션, 기본값 있음)
 * }
 */
router.post('/fleets', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { name, faction, planetId, x, y, commanderId, ships } = req.body;

    // 필수 필드 검증
    if (!name || !faction) {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.nameFactionRequired,
      });
    }

    if (!['empire', 'alliance'].includes(faction)) {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.invalidFaction,
      });
    }

    // 위치 결정: 행성 ID 또는 좌표
    let strategicPosition: { x: number; y: number };

    if (planetId) {
      // 행성에서 출발
      const planet = await Planet.findOne({
        session_id: sessionId,
        planetId,
      });

      if (!planet) {
        return res.status(404).json({
          success: false,
          message: LOGH_MESSAGES.planetNotFound(planetId),
        });
      }

      strategicPosition = planet.gridCoordinates;
    } else if (typeof x === 'number' && typeof y === 'number') {
      // 직접 좌표 지정
      strategicPosition = { x, y };
    } else {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.coordinatesRequired,
      });
    }

    // 고유 fleetId 생성
    const fleetId = `fleet_${faction}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 기본 함선 구성 (제공되지 않은 경우)
    const defaultShips = faction === 'empire' 
      ? { 'SS75-I': 100, 'PK86-I': 50, 'SK80-I': 30 }  // 제국: 표준전함, 고속전함, 순항함
      : { '787-I': 100, '795-I': 50, '796-I': 30 };     // 동맹: 표준전함, 순항함, 구축함

    const shipComposition = ships || defaultShips;

    // 총 함선 수 계산
    const totalShips = Object.values(shipComposition).reduce((sum: number, count: any) => sum + count, 0);

    // 함대 생성
    const fleet = await Fleet.create({
      session_id: sessionId,
      fleetId,
      name,
      faction,
      commanderId: commanderId || null,
      strategicPosition,
      tacticalPosition: null,
      destination: null,
      status: 'idle',
      isInCombat: false,
      tacticalMapId: null,
      ships: shipComposition,
      totalShips,
      morale: 100,
      supplies: 10000,
      formation: 'standard',
      speed: 20000,
    });

    res.json({
      success: true,
      message: LOGH_MESSAGES.fleetCreated(strategicPosition.x, strategicPosition.y),
      data: fleet,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== 함대 이동 (전략 맵) ====================

/**
 * POST /api/logh/fleets/:fleetId/move
 * 함대 이동 명령 (전략 맵)
 */
router.post('/fleets/:fleetId/move', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { fleetId } = req.params;
    const { x, y } = req.body;

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.invalidCoordinates,
      });
    }

    const result = await RealtimeMovementService.setFleetDestination(
      sessionId,
      fleetId,
      { x, y }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/fleets/:fleetId/cancel-move
 * 이동 취소
 */
router.post('/fleets/:fleetId/cancel-move', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { fleetId } = req.params;

    const result = await RealtimeMovementService.cancelMovement(
      sessionId,
      fleetId
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== 전투 (전술 맵) ====================

/**
 * GET /api/logh/tactical-maps
 * 활성 전술 맵 목록
 */
router.get('/tactical-maps', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const tacticalMaps = await TacticalMap.find({
      session_id: sessionId,
      status: 'active',
    });

    res.json({
      success: true,
      data: tacticalMaps,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/tactical-maps/:tacticalMapId
 * 특정 전술 맵 정보
 */
router.get('/tactical-maps/:tacticalMapId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { tacticalMapId } = req.params;

    const tacticalMap = await TacticalMap.findOne({
      session_id: sessionId,
      tacticalMapId,
    });

    if (!tacticalMap) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.tacticalMapNotFound,
      });
    }

    // 참여 함대 정보도 함께 반환
    const fleets = await Fleet.find({
      session_id: sessionId,
      tacticalMapId,
    });

    res.json({
      success: true,
      data: {
        tacticalMap,
        fleets,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/fleets/:fleetId/tactical-move
 * 함대 이동 명령 (전술 맵)
 */
router.post('/fleets/:fleetId/tactical-move', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { fleetId } = req.params;
    const { x, y } = req.body;

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.invalidCoordinates,
      });
    }

    const result = await RealtimeCombatService.moveFleetTactical(
      sessionId,
      fleetId,
      x,
      y
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/fleets/:fleetId/formation
 * 진형 변경
 */
router.post('/fleets/:fleetId/formation', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { fleetId } = req.params;
    const { formation } = req.body;

    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.fleetNotFound,
      });
    }

    fleet.formation = formation;
    await fleet.save();

    res.json({
      success: true,
      message: `진형이 ${formation}으로 변경되었습니다.`,
      data: fleet,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== 커맨더 관리 ====================

/**
 * GET /api/logh/commanders
 * 모든 커맨더 목록
 */
router.get('/commanders', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { faction } = req.query;

    const query: any = { session_id: sessionId };
    if (faction) {
      query.faction = faction;
    }

    const commanders = await LoghCommander.find(query);

    res.json({
      success: true,
      data: commanders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/commanders/:commanderNo
 * 특정 커맨더 정보
 */
router.get('/commanders/:commanderNo', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const commanderNo = parseInt(req.params.commanderNo);

    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commander) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.commanderNotFound,
      });
    }

    res.json({
      success: true,
      data: commander,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/commanders/:commanderNo/execute-command
 * 커맨드 실행
 * 
 * @body {
 *   commandType: string,  // 'move_fleet', 'issue_operation', etc.
 *   params: any           // 커맨드별 파라미터
 * }
 */
router.post('/commanders/:commanderNo/execute-command', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const commanderNo = parseInt(req.params.commanderNo);
    const { commandType, params } = req.body;

    if (!commandType) {
      return res.status(400).json({
        success: false,
        message: LOGH_MESSAGES.commandTypeRequired,
      });
    }

    // 커맨더 조회
    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commander) {
      return res.status(404).json({
        success: false,
        message: LOGH_MESSAGES.commanderNotFound,
      });
    }

    // 커맨드 클래스 가져오기
    const CommandClass = CommandRegistry.getLogh(commandType);
    if (!CommandClass) {
      return res.status(404).json({
        success: false,
        message: `Unknown command type: ${commandType}`,
      });
    }

    // 커맨드 인스턴스 생성
    const commandInstance = new CommandClass();

    // 실행 컨텍스트 생성
    const wrapper = new CommanderWrapper(commander);
    const context = {
      commander: wrapper,
      env: {
        session_id: sessionId,
        ...params,
      },
      session: { id: sessionId },
    };

    // 실행 가능 여부 체크
    const checkResult = await commandInstance.checkConditionExecutable(context);
    if (checkResult !== null) {
      return res.status(400).json({
        success: false,
        message: checkResult,
      });
    }

    // 커맨드 즉시 실행
    const result = await commandInstance.execute(context);

    if (result.success) {
      // 소요 시간이 있으면 activeCommands에 추가
      const requiredTurns = commandInstance.getRequiredTurns?.() || 0;
      if (requiredTurns > 0) {
        // 게임시간 기준으로 턴을 밀리초로 변환
        // 1턴 = 1 게임시간 = 실시간 2.5초 (24배속 기준)
        const durationMs = requiredTurns * 2500;
        wrapper.startCommand(commandType, durationMs, params);
      }

      await commander.save();
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/commands/available
 * 사용 가능한 커맨드 목록
 */
router.get('/commands/available', async (req, res) => {
  try {
    const commandTypes = CommandRegistry.getAllLoghTypes();

    const commands = commandTypes.map((type) => {
      const CommandClass = CommandRegistry.getLogh(type);
      const instance = new CommandClass();

      return {
        type,
        name: instance.getName(),
        displayName: instance.getDisplayName(),
        description: instance.getDescription(),
        category: instance.getCategory(),
        requiredCP: instance.getRequiredCommandPoints(),
        requiredTurns: instance.getRequiredTurns(),
      };
    });

    res.json({
      success: true,
      data: commands,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== 게임 루프 제어 ====================

/**
 * POST /api/logh/game-loop/start
 * 게임 루프 시작
 */
router.post('/game-loop/start', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    GameLoopManager.startLoop(sessionId);

    res.json({
      success: true,
      message: LOGH_MESSAGES.gameLoopStarted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/logh/game-loop/stop
 * 게임 루프 정지
 */
router.post('/game-loop/stop', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    GameLoopManager.stopLoop(sessionId);

    res.json({
      success: true,
      message: LOGH_MESSAGES.gameLoopStopped,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/logh/game-loop/status
 * 게임 루프 상태 확인
 */
router.get('/game-loop/status', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const loop = GameLoopManager.getLoop(sessionId);
    const status = loop.getStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
