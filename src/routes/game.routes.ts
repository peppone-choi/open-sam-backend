// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { Session } from '../models/session.model';
import { General, Nation } from '../models';
import { authenticate, optionalAuth } from '../middleware/auth';
import { SelectNpcService } from '../services/general/SelectNpc.service';
import { SelectPickedGeneralService } from '../services/general/SelectPickedGeneral.service';
import { SetMySettingService } from '../services/game/SetMySetting.service';
import { VacationService } from '../services/game/Vacation.service';
import { ServerBasicInfoService } from '../services/game/ServerBasicInfo.service';
import { SetGeneralPermissionService } from '../services/game/SetGeneralPermission.service';
import { RaiseEventService } from '../services/game/RaiseEvent.service';
import { GetMyBossInfoService } from '../services/game/GetMyBossInfo.service';
import { ManageOfficerService } from '../services/game/ManageOfficer.service';
import { KickGeneralService } from '../services/nation/KickGeneral.service';
import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { generalRecordRepository } from '../repositories/general-record.repository';
import { worldHistoryRepository } from '../repositories/world-history.repository';
import { GetFrontInfoService } from '../services/general/GetFrontInfo.service';
import { cityRepository } from '../repositories/city.repository';

const router = Router();

/**
 * @swagger
 * /api/game/session/{sessionId}/config:
 *   get:
 *     summary: 세션 전체 설정 조회 (완전 동적 게임 시스템)
 *     description: |
 *       특정 게임 세션의 전체 설정을 조회합니다. 이 시스템은 완전히 동적으로 설계되어 어떤 종류의 게임도 지원할 수 있습니다.
 *       
 *       **완전 동적 시스템:**
 *       - 게임 모드에 따라 리소스, 속성, 명령이 다름
 *       - 삼국지: gold, rice, troops, leadership, strength, intel
 *       - 판타지: mana, gems, magic_power, dragon_count
 *       - SF: energy, minerals, tech_level, fleet_size
 *       
 *       **설정 구성 요소:**
 *       - game_mode: 게임 모드 식별자 (sangokushi, fantasy, sci-fi 등)
 *       - resources: 자원 종류 및 제약 (gold, rice, mana 등)
 *       - attributes: 장수/유닛 속성 (leadership, strength, intel, magic 등)
 *       - field_mappings: DB 필드와 개념 매핑
 *       - commands: 사용 가능한 명령 목록
 *       - game_constants: 게임 상수 (경험치 배율, 성장률 등)
 *       
 *       **사용 시나리오:**
 *       1. **게임 초기화**: 클라이언트가 게임 규칙 로드
 *          - 어떤 자원이 있는지
 *          - 어떤 명령을 실행할 수 있는지
 *          - UI에 표시할 필드 결정
 *       
 *       2. **멀티 게임 모드**: 하나의 코드로 여러 게임
 *          - 삼국지 모드 vs 판타지 모드
 *          - 세션별로 다른 규칙
 *       
 *       3. **동적 UI 렌더링**: 설정 기반 UI 생성
 *          - resources 목록으로 자원 표시 UI
 *          - commands 목록으로 명령 버튼 생성
 *          - attributes로 스탯 표시
 *       
 *       4. **게임 커스터마이징**: 관리자가 새 게임 모드 생성
 *          - 코드 수정 없이 DB 설정만 변경
 *          - 새로운 자원/속성 추가
 *       
 *       **응답 구조:**
 *       - session_id: 세션 ID
 *       - name: 세션 표시 이름
 *       - game_mode: 게임 모드 (sangokushi, fantasy 등)
 *       - resources: { gold: {min, max}, rice: {min, max} }
 *       - attributes: { leadership: {min, max}, strength: {min, max} }
 *       - field_mappings: DB 필드 매핑
 *       - commands: 명령 목록 및 설정
 *       - game_constants: 게임 상수
 *       
 *       **주의사항:**
 *       - 세션이 없으면 404 오류
 *       - 전체 설정이 반환되므로 캐싱 권장
 *       - 게임 시작 시 한 번만 조회하고 재사용
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 세션 설정 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_id:
 *                   type: string
 *                   example: sangokushi_default
 *                 name:
 *                   type: string
 *                   example: 삼국지 기본 서버
 *                 game_mode:
 *                   type: string
 *                   description: 게임 모드 식별자
 *                   example: sangokushi
 *                 resources:
 *                   type: object
 *                   description: 자원 종류 및 제약
 *                   example:
 *                     gold:
 *                       min: 0
 *                       max: 999999999
 *                       display_name: 금
 *                     rice:
 *                       min: 0
 *                       max: 999999999
 *                       display_name: 쌀
 *                 attributes:
 *                   type: object
 *                   description: 장수/유닛 속성
 *                   example:
 *                     leadership:
 *                       min: 1
 *                       max: 150
 *                       display_name: 통솔
 *                     strength:
 *                       min: 1
 *                       max: 150
 *                       display_name: 무력
 *                     intel:
 *                       min: 1
 *                       max: 150
 *                       display_name: 지력
 *                 field_mappings:
 *                   type: object
 *                   description: DB 필드 매핑
 *                 commands:
 *                   type: object
 *                   description: 사용 가능한 명령 목록
 *                 game_constants:
 *                   type: object
 *                   description: 게임 상수
 *             examples:
 *               sangokushi:
 *                 summary: 삼국지 모드 설정
 *                 value:
 *                   session_id: sangokushi_default
 *                   name: 삼국지 기본 서버
 *                   game_mode: sangokushi
 *                   resources:
 *                     gold: {min: 0, max: 999999999, display_name: 금}
 *                     rice: {min: 0, max: 999999999, display_name: 쌀}
 *                   attributes:
 *                     leadership: {min: 1, max: 150, display_name: 통솔}
 *                     strength: {min: 1, max: 150, display_name: 무력}
 *                     intel: {min: 1, max: 150, display_name: 지력}
 *               fantasy:
 *                 summary: 판타지 모드 설정 (예시)
 *                 value:
 *                   session_id: fantasy_world
 *                   name: 판타지 월드
 *                   game_mode: fantasy
 *                   resources:
 *                     mana: {min: 0, max: 10000, display_name: 마나}
 *                     gems: {min: 0, max: 999999, display_name: 젬}
 *                   attributes:
 *                     magic_power: {min: 1, max: 200, display_name: 마력}
 *                     dragon_count: {min: 0, max: 10, display_name: 드래곤 수}
 *       404:
 *         description: 세션을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 세션을 찾을 수 없습니다
 *       500:
 *         description: 서버 오류
 */
router.get('/session/:sessionId/config', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }

    // 전체 설정 반환
    res.json({
      session_id: session.session_id,
      name: session.name,
      game_mode: session.game_mode,
      resources: session.resources,
      attributes: session.attributes,
      field_mappings: session.field_mappings,
      commands: session.commands,
      game_constants: session.game_constants
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/const:
 *   get:
 *     summary: 게임 상수 조회 (하위 호환성)
 *     description: |
 *       게임 상수(game_constants)만 조회하는 간소화된 엔드포인트입니다. PHP 버전과의 하위 호환성을 위해 제공됩니다.
 *       
 *       **게임 상수 종류:**
 *       - 경험치 배율 (exp_multiplier)
 *       - 성장률 (growth_rate)
 *       - 전투 보정값 (battle_modifier)
 *       - 최대 턴 수 (max_turns)
 *       - 자원 생산 계수 (resource_production)
 *       - 건물 건설 시간 (building_time)
 *       
 *       **사용 시나리오:**
 *       1. **게임 로직 계산**: 클라이언트 측 계산
 *          - 예상 경험치 계산
 *          - 자원 생산량 예측
 *          - 전투 시뮬레이션
 *       
 *       2. **UI 표시**: 정보 제공
 *          - "경험치 2배 이벤트"
 *          - "자원 생산 +50%"
 *       
 *       3. **PHP 호환**: 기존 클라이언트 지원
 *          - 점진적 마이그레이션
 *          - 레거시 지원
 *       
 *       **전체 설정 vs 상수만:**
 *       - 전체: /session/{sessionId}/config
 *       - 상수만: /const (이 엔드포인트)
 *       - 상수만 필요하면 이 엔드포인트 사용 권장
 *       
 *       **주의사항:**
 *       - session_id 생략 시 기본 세션 사용
 *       - 세션이 없으면 빈 객체 반환
 *       - 캐싱 권장 (변경 빈도 낮음)
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: 게임 세션 ID (생략 시 기본 세션)
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 게임 상수 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: 게임 상수 객체 (세션별로 구조가 다를 수 있음)
 *             examples:
 *               sangokushi_constants:
 *                 summary: 삼국지 게임 상수
 *                 value:
 *                   exp_multiplier: 1.0
 *                   max_turns: 30
 *                   battle_modifier: 1.2
 *                   resource_production_rate: 100
 *                   turn_duration_seconds: 600
 *               empty:
 *                 summary: 세션 없을 때
 *                 value: {}
 *       500:
 *         description: 서버 오류
 */
router.get('/const', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string || 'sangokushi_default';
    const session = await Session.findOne({ session_id: sessionId });

    res.json(session?.game_constants || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/turn:
 *   get:
 *     summary: 현재 턴 정보 조회
 *     description: |
 *       현재 게임의 턴 정보(턴 수, 연도, 월)를 조회합니다. 게임 시간 시스템의 핵심 정보입니다.
 *       
 *       **턴 시스템:**
 *       - turn: 현재 턴 번호 (1부터 시작)
 *       - year: 게임 내 연도 (184년부터 시작 - 삼국지)
 *       - month: 게임 내 월 (1-12)
 *       - 매 턴마다 모든 명령 실행
 *       
 *       **턴 진행 방식:**
 *       - 실시간: 일정 시간마다 자동 진행 (예: 10분)
 *       - 수동: 관리자가 수동으로 턴 진행
 *       - 조건부: 모든 플레이어 준비 시 진행
 *       
 *       **사용 시나리오:**
 *       1. **UI 표시**: 현재 시간 표시
 *          - "184년 3월 - 턴 15"
 *          - 다음 턴까지 남은 시간
 *       
 *       2. **명령 타이밍**: 턴 기반 행동
 *          - 현재 턴 확인
 *          - 미래 턴 예약
 *          - 과거 턴 기록 조회
 *       
 *       3. **이벤트 판단**: 시간 기반 이벤트
 *          - "겨울(12월)에는 병력 손실"
 *          - "봄(3월)에 농업 보너스"
 *       
 *       4. **폴링**: 턴 변경 감지
 *          - 주기적으로 조회
 *          - 턴 변경 시 UI 갱신
 *       
 *       **TODO:**
 *       - 현재 하드코딩된 값 (turn: 1, year: 184, month: 1)
 *       - Session 모델에서 실제 턴 정보 조회로 개선 필요
 *       - 턴 진행 시스템 구현 필요
 *       
 *       **주의사항:**
 *       - 현재 고정값 반환 (개발 중)
 *       - 실제 구현 시 Session.data 사용
 *       - 캐싱 시 TTL 짧게 설정 (턴 변경 감지)
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 현재 턴 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 turn:
 *                   type: number
 *                   description: 현재 턴 번호
 *                   example: 1
 *                 year:
 *                   type: number
 *                   description: 게임 내 연도
 *                   example: 184
 *                 month:
 *                   type: number
 *                   description: 게임 내 월 (1-12)
 *                   example: 1
 *             examples:
 *               early_game:
 *                 summary: 게임 초반
 *                 value:
 *                   turn: 1
 *                   year: 184
 *                   month: 1
 *               mid_game:
 *                 summary: 게임 중반 (예시)
 *                 value:
 *                   turn: 156
 *                   year: 185
 *                   month: 9
 *       500:
 *         description: 서버 오류
 */
router.get('/turn', async (req, res) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const session = await Session.findOne({ session_id: sessionId });

    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    }

    const sessionData = session.data || {};
    const now = new Date();

    // turntime이 없으면 현재 시간으로 설정
    const turntime = sessionData.turntime
      ? new Date(sessionData.turntime)
      : now;

    // turnDate를 호출하여 최신 년/월 계산
    // turnDate는 gameEnv 객체를 직접 수정하므로 복사본을 만들어 사용
    const gameEnvCopy = { ...sessionData };
    const turnInfo = ExecuteEngineService.turnDate(turntime, gameEnvCopy);

    // 년/월 또는 starttime이 변경되었으면 DB에 저장
    if (gameEnvCopy.year !== sessionData.year || gameEnvCopy.month !== sessionData.month || gameEnvCopy.starttime !== sessionData.starttime) {
      const starttimeChanged = gameEnvCopy.starttime !== sessionData.starttime;
      sessionData.year = gameEnvCopy.year;
      sessionData.month = gameEnvCopy.month;
      if (starttimeChanged) {
        sessionData.starttime = gameEnvCopy.starttime;
        console.log(`[${new Date().toISOString()}] ✅ Saved corrected starttime to DB: ${sessionData.starttime}`);
      }
      session.data = sessionData;
      await session.save();
    }

    res.json({
      turn: turnInfo.turn,
      year: turnInfo.year,
      month: turnInfo.month,
      turntime: turntime.toISOString(),
      turnterm: sessionData.turnterm || 60
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/ranking:
 *   get:
 *     summary: 랭킹 조회
 *     description: |
 *       게임 내 장수/국가 랭킹을 조회합니다. 다양한 기준으로 순위를 매길 수 있습니다.
 *       
 *       **랭킹 종류 (계획):**
 *       - 장수 랭킹:
 *         - 종합 능력치 (통솔+무력+지력)
 *         - 경험치
 *         - 헌신도
 *         - 전투 승수
 *       
 *       - 국가 랭킹:
 *         - 영토 수
 *         - 총 병력
 *         - 국고 규모
 *         - 장수 수
 *       
 *       - 특화 랭킹:
 *         - 통솔 1위
 *         - 무력 1위
 *         - 지력 1위
 *         - 재산 1위
 *       
 *       **사용 시나리오:**
 *       1. **경쟁 요소**: 플레이어 간 경쟁 유도
 *          - 1등 목표 설정
 *          - 순위 변동 확인
 *       
 *       2. **명예 시스템**: 업적 표시
 *          - "무력 1위 장수"
 *          - "최강 국가"
 *       
 *       3. **보상 지급**: 순위 기반 보상
 *          - 1위 특별 아이템
 *          - 상위 10% 버프
 *       
 *       4. **통계 확인**: 게임 현황 파악
 *          - 강자 식별
 *          - 세력 균형 확인
 *       
 *       **필터/정렬 (계획):**
 *       - type: general | nation
 *       - criteria: total_stats | exp | wealth
 *       - limit: 상위 N명
 *       
 *       **TODO:**
 *       - 현재 빈 배열 반환 (구현 예정)
 *       - General/Nation 모델에서 집계
 *       - 캐싱 시스템 구현 (성능 최적화)
 *       
 *       **주의사항:**
 *       - 현재 개발 중 (빈 배열 반환)
 *       - 실시간 랭킹은 서버 부하 주의
 *       - 주기적 업데이트 + 캐싱 권장
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [general, nation]
 *         description: 랭킹 타입 (장수/국가)
 *         example: general
 *       - in: query
 *         name: criteria
 *         schema:
 *           type: string
 *         description: 정렬 기준
 *         example: total_stats
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: 조회할 순위 수
 *         example: 100
 *     responses:
 *       200:
 *         description: 랭킹 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ranking:
 *                   type: array
 *                   description: 랭킹 목록 (현재 빈 배열)
 *                   items:
 *                     type: object
 *             examples:
 *               current:
 *                 summary: 현재 상태 (개발 중)
 *                 value:
 *                   ranking: []
 *               future_general:
 *                 summary: 장수 랭킹 (예정)
 *                 value:
 *                   ranking:
 *                     - rank: 1
 *                       name: 여포
 *                       total_stats: 285
 *                       leadership: 95
 *                       strength: 100
 *                       intel: 90
 *                     - rank: 2
 *                       name: 조조
 *                       total_stats: 279
 *               future_nation:
 *                 summary: 국가 랭킹 (예정)
 *                 value:
 *                   ranking:
 *                     - rank: 1
 *                       nation: 위나라
 *                       territories: 15
 *                       total_troops: 50000
 *                       generals: 25
 *       500:
 *         description: 서버 오류
 */
router.get('/ranking', async (req, res) => {
  try {
    const sessionId = req.query.session_id as string || req.query.serverID as string || 'sangokushi_default';

    // 장수 랭킹 (경험치 기준)
    const generals = await General.find({ session_id: sessionId })
      .sort({ 'data.experience': -1, 'data.explevel': -1 })
      .limit(100)
      .lean();

    const ranking = generals.map((g: any, index: number) => {
      const genData = g.data || {};
      return {
        rank: index + 1,
        generalId: genData.no || g.no,
        name: g.name || genData.name || '',
        nation: genData.nation || 0,
        experience: genData.experience || 0,
        explevel: genData.explevel || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0
      };
    });

    res.json({
      result: true,
      ranking
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/cities:
 *   get:
 *     summary: 도시 목록 조회 (완전 동적)
 *     description: |
 *       게임 세션의 모든 도시 목록을 조회합니다. 도시 데이터 구조는 세션 설정에 따라 완전히 동적입니다.
 *       
 *       **완전 동적 도시 시스템:**
 *       - 삼국지 모드: 농업, 상업, 수비, 병력, 성벽
 *       - 판타지 모드: 마나타워, 드래곤둥지, 마법방어
 *       - SF 모드: 에너지생산, 우주정거장, 레이저방어
 *       
 *       **도시 데이터 구조:**
 *       - city: 도시 ID (고유 번호)
 *       - name: 도시 이름
 *       - data: 동적 데이터 (세션 설정에 따라 다름)
 *         - 삼국지: {agriculture, commerce, defense, wall, nation}
 *         - 판타지: {mana_tower, dragon_nest, magic_defense}
 *       
 *       **사용 시나리오:**
 *       1. **맵 표시**: 전체 도시 목록
 *          - 월드맵에 모든 도시 표시
 *          - 색상으로 소속 국가 구분
 *       
 *       2. **영토 확인**: 국가별 도시
 *          - 위나라 소속 도시 필터
 *          - 무주공산 도시 찾기
 *       
 *       3. **전략 수립**: 공격 목표 선정
 *          - 농업 높은 도시 우선
 *          - 방어 낮은 도시 선택
 *       
 *       4. **통계 분석**: 게임 현황
 *          - 총 도시 수
 *          - 국가별 영토 분포
 *       
 *       **동적 처리 방법:**
 *       ```javascript
 *       // 클라이언트에서
 *       const config = await fetch('/api/game/session/xxx/config');
 *       const cities = await fetch('/api/game/cities?session=xxx');
 *       
 *       // config.field_mappings를 보고 cities.data 해석
 *       cities.forEach(city => {
 *         const agriculture = city.data[config.field_mappings.agriculture];
 *         // 동적으로 필드 접근
 *       });
 *       ```
 *       
 *       **주의사항:**
 *       - data 구조는 세션마다 다름
 *       - 반드시 세션 설정 먼저 조회 필요
 *       - 대량 데이터일 수 있으므로 페이징 고려
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: session
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *       - in: query
 *         name: nation
 *         schema:
 *           type: number
 *         description: 국가 ID로 필터 (선택)
 *         example: 1
 *     responses:
 *       200:
 *         description: 도시 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       city:
 *                         type: number
 *                         description: 도시 ID
 *                       name:
 *                         type: string
 *                         description: 도시 이름
 *                       data:
 *                         type: object
 *                         description: 동적 도시 데이터
 *             examples:
 *               sangokushi:
 *                 summary: 삼국지 모드 도시들
 *                 value:
 *                   cities:
 *                     - city: 1
 *                       name: 낙양
 *                       data:
 *                         agriculture: 10000
 *                         commerce: 8000
 *                         defense: 5000
 *                         wall: 3000
 *                         nation: 1
 *                     - city: 2
 *                       name: 장안
 *                       data:
 *                         agriculture: 9000
 *                         commerce: 9500
 *                         nation: 2
 *               fantasy:
 *                 summary: 판타지 모드 도시들 (예시)
 *                 value:
 *                   cities:
 *                     - city: 1
 *                       name: Mystic Tower
 *                       data:
 *                         mana_tower: 15
 *                         dragon_nest: 3
 *                         magic_defense: 8000
 *       500:
 *         description: 서버 오류
 */
router.get('/cities', async (req, res) => {
  try {
    const sessionId = req.query.session as string || 'sangokushi_default';

    const cities = (await cityRepository.findBySession(sessionId)) || [];

    res.json({
      cities: cities.map(c => ({
        city: c.city,
        name: c.name,
        data: c.data || {}
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/cities/{id}:
 *   get:
 *     summary: 도시 상세 정보 조회 (완전 동적)
 *     description: |
 *       특정 도시의 상세 정보를 조회합니다. 데이터 구조는 세션 설정에 따라 완전히 동적입니다.
 *       
 *       **도시 상세 정보:**
 *       - 기본 정보: city ID, name
 *       - 동적 데이터: 세션별로 다른 구조
 *       - 실시간 정보: 현재 상태
 *       
 *       **삼국지 모드 예시:**
 *       - agriculture: 농업 개발도
 *       - commerce: 상업 개발도
 *       - defense: 방어력
 *       - wall: 성벽
 *       - nation: 소속 국가
 *       - troops: 주둔 병력
 *       - officer: 태수 (장수 ID)
 *       
 *       **사용 시나리오:**
 *       1. **도시 관리**: 태수가 도시 현황 확인
 *          - 현재 개발도 확인
 *          - 다음에 무엇을 개발할지 결정
 *       
 *       2. **공격 계획**: 적 도시 정찰
 *          - 방어력 확인
 *          - 병력 규모 파악
 *          - 공격 가능 여부 판단
 *       
 *       3. **내정 명령**: 개발 명령 실행
 *          - 농업 개발 -> agriculture 증가
 *          - 상업 개발 -> commerce 증가
 *       
 *       4. **UI 표시**: 도시 상세 화면
 *          - 모든 정보 표시
 *          - 실행 가능한 명령 표시
 *       
 *       **동적 데이터 활용:**
 *       - 세션 설정의 field_mappings 참조
 *       - data 객체를 동적으로 해석
 *       - UI를 설정 기반으로 렌더링
 *       
 *       **주의사항:**
 *       - city ID는 숫자형
 *       - 존재하지 않는 도시는 404
 *       - data 구조는 세션별로 다름
 *       - 권한 체크 필요 (정찰 명령 여부)
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 도시 ID
 *         example: "1"
 *       - in: query
 *         name: session
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 도시 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 city:
 *                   type: number
 *                   description: 도시 ID
 *                 name:
 *                   type: string
 *                   description: 도시 이름
 *                 data:
 *                   type: object
 *                   description: 동적 도시 데이터 (세션 설정에 따라 구조 다름)
 *             examples:
 *               luoyang:
 *                 summary: 낙양 (삼국지)
 *                 value:
 *                   city: 1
 *                   name: 낙양
 *                   data:
 *                     agriculture: 10000
 *                     commerce: 8000
 *                     defense: 5000
 *                     wall: 3000
 *                     nation: 1
 *                     troops: 5000
 *                     officer: 1001
 *                     population: 50000
 *               changan:
 *                 summary: 장안 (무주공산)
 *                 value:
 *                   city: 2
 *                   name: 장안
 *                   data:
 *                     agriculture: 5000
 *                     commerce: 3000
 *                     defense: 2000
 *                     wall: 1000
 *                     nation: 0
 *                     troops: 1000
 *                     officer: null
 *       404:
 *         description: 도시를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 도시를 찾을 수 없습니다
 *       500:
 *         description: 서버 오류
 */
router.get('/cities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.query.session as string || 'sangokushi_default';

    const cityId = Number(id);
    if (Number.isNaN(cityId)) {
      return res.status(400).json({ error: '잘못된 도시 ID 입니다' });
    }

    const city = await cityRepository.findByCityNum(sessionId, cityId);
    if (!city) {
      return res.status(404).json({ error: '도시를 찾을 수 없습니다' });
    }

    res.json({
      city: city.city,
      name: city.name,
      data: city.data || {}
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/basic-info', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.json({
        result: false,
        generalID: 0,
        myNationID: 0,
        isChief: false,
        officerLevel: 0,
        permission: 0,
      });
    }

    const general: any = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    }).lean();

    if (!general) {
      return res.json({
        result: false,
        generalID: 0,
        myNationID: 0,
        isChief: false,
        officerLevel: 0,
        permission: 0,
      });
    }

    const genData = general.data || {};
    const officerLevel = genData.officer_level || genData.officerLevel || 0;
    const nation = genData.nation || 0;

    // 권한 계산 (간단화)
    let permission = 0;
    if (officerLevel >= 12) {
      permission = 2; // 군주
    } else if (officerLevel >= 5) {
      permission = 2; // 수뇌
    } else if (officerLevel >= 1) {
      permission = 1; // 일반
    }

    // permission 필드 확인
    const genPermission = genData.permission || general.permission || 'normal';
    if (genPermission === 'ambassador') {
      permission = 4; // 외교권자
    } else if (genPermission === 'auditor') {
      permission = 3; // 감찰
    }

    res.json({
      result: true,
      generalID: genData.no || general.no,
      myNationID: nation,
      isChief: officerLevel === 12,
      officerLevel,
      permission,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/general-list', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const type = req.body.type || 7; // 정렬 타입 (기본: 턴)

    // 현재 사용자의 장수 찾기
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다' });
    }

    const myGeneral = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    }).lean();

    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다' });
    }

    const myNation = myGeneral.data?.nation || 0;

    if (myNation === 0) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어 있지 않습니다' });
    }

    // 같은 국가 소속 장수만 조회 (암행부)
    const generals = await General.find({
      session_id: sessionId,
      $or: [
        { 'data.nation': myNation },
        { nation: myNation }
      ]
    }).lean();

    const sessionCities = (await cityRepository.findBySession(sessionId)) || [];
    const cityMap = new Map(sessionCities.map((c: any) => [c.city, c.name]));

    const generalList = generals.map((g: any) => {
      const genData = g.data || {};
      return {
        no: genData.no || g.no,
        name: genData.name || g.name,
        npc: genData.npc || g.npc || 0,
        nation: genData.nation || 0,
        city: genData.city || 0,
        cityName: cityMap.get(genData.city || 0) || '',
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0,
        gold: genData.gold || 0,
        rice: genData.rice || 0,
        crew: genData.crew || 0,
        crewtype: genData.crewtype || 0,
        train: genData.train || 0,
        atmos: genData.atmos || 0,
        injury: genData.injury || 0,
        killturn: genData.killturn || 0,
        turntime: genData.turntime || null,
        officerLevel: genData.officer_level || genData.officerLevel || 0,
        dedKillturn: genData.dedKillturn || 0,
        defence_train: genData.defence_train || 0,
        experience: genData.experience || 0,
        explevel: genData.explevel || 0
      };
    });

    res.json({
      result: true,
      generals: generalList,
      generalList: generalList
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

router.post('/map', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const data = req.body.data || {};

    // GetMapService 사용
    const { GetMapService } = await import('../services/global/GetMap.service');
    const result = await GetMapService.execute({
      session_id: sessionId,
      ...data
    }, req.user);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * 군대 이동 정보 조회
 * POST /api/game/troop-movements
 */
router.post('/troop-movements', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;
    const includeEnemy = req.body.includeEnemy !== false;

    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다' });
    }

    // 사용자의 장수 찾기
    const myGeneral = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    }).lean();

    const viewerNationId = myGeneral?.data?.nation || 0;

    const { GetTroopMovementsService } = await import('../services/general/GetTroopMovements.service');
    const movements = await GetTroopMovementsService.execute({
      sessionId,
      viewerNationId,
      includeEnemy,
    });

    res.json({
      result: true,
      movements,
      count: movements.length,
    });
  } catch (error: any) {
    console.error('[troop-movements] 에러:', error);
    res.status(500).json({ result: false, reason: error.message });
  }
});

router.post('/city-list', authenticate, async (req, res) => {
  try {
    const sessionId = (req.body.session_id as string) || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다' });
    }

    // 사용자의 장수 찾기
    const myGeneral = await General.findOne({
      session_id: sessionId,
      owner: String(userId)
    }).lean();

    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다' });
    }

    const myNation = myGeneral.data?.nation || 0;

    if (myNation === 0) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어 있지 않습니다' });
    }

    const nations = await Nation.find({ session_id: sessionId }).lean();
    const nationMap: Record<number, any> = {};
    nations.forEach((nation: any) => {
      const nationId = nation.data?.nation || nation.nation;
      if (nationId) {
        nationMap[nationId] = {
          nation: nationId,
          name: nation.data?.name || nation.name || '이름 없음',
          color: nation.data?.color || nation.color || 0,
          capital: nation.data?.capital || nation.capital || 0,
          level: nation.data?.level || nation.level || 0,
          type: nation.data?.type || nation.type || 'None'
        };
      }
    });

    // 자기 국가의 도시만 조회
    const sessionCities = (await cityRepository.findBySession(sessionId)) || [];
    const cities = sessionCities.filter((city: any) => {
      const nationId = city.nation ?? city.data?.nation ?? 0;
      return nationId === myNation;
    });

    const cityArgsList = ['city', 'nation', 'name', 'level'];
    const cityList = cities.map((city: any) => {
      const cityData = city.data || city;
      return {
        city: cityData.id || cityData.city || 0,
        name: cityData.name || '도시명 없음',
        level: cityData.level || 1,
        region: cityData.region || 0,
        pop: cityData.pop || 0,
        pop_max: cityData.pop_max || cityData.popMax || 10000,
        agri: cityData.agri || 0,
        agri_max: cityData.agri_max || cityData.agriMax || 10000,
        comm: cityData.comm || 0,
        comm_max: cityData.comm_max || cityData.commMax || 10000,
        secu: cityData.secu || 0,
        secu_max: cityData.secu_max || cityData.secuMax || 10000,
        def: cityData.def || 0,
        def_max: cityData.def_max || cityData.defMax || 10000,
        wall: cityData.wall || 0,
        wall_max: cityData.wall_max || cityData.wallMax || 10000,
        trust: cityData.trust || 0
      };
    });

    res.json({
      result: true,
      nations: nationMap,
      cityArgsList,
      cities: cityList,
      cityList: cityList  // 프론트엔드 호환성
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

router.post('/select-npc', authenticate, async (req, res) => {
  try {
    const result = await SelectNpcService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/select-picked-general', authenticate, async (req, res) => {
  try {
    const result = await SelectPickedGeneralService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/set-my-setting', authenticate, async (req, res) => {
  try {
    const result = await SetMySettingService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/vacation', authenticate, async (req, res) => {
  try {
    const result = await VacationService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/game/server-basic-info:
 *   post:
 *     summary: 서버 기본 정보 조회
 *     description: 서버의 기본 정보를 조회합니다 (j_server_basic_info.php)
 *     tags: [Game]
 */
router.post('/server-basic-info', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;

    const result = await ServerBasicInfoService.execute(sessionId, userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/set-general-permission:
 *   post:
 *     summary: 장수 권한 설정
 *     description: 군주가 장수에게 외교권자/감찰 권한을 부여합니다 (j_general_set_permission.php)
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 */
router.post('/set-general-permission', authenticate, async (req, res) => {
  try {
    const result = await SetGeneralPermissionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/raise-event:
 *   post:
 *     summary: 이벤트 트리거 (관리자)
 *     description: 관리자가 게임 이벤트를 트리거합니다 (j_raise_event.php)
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 */
router.post('/raise-event', authenticate, async (req, res) => {
  try {
    const result = await RaiseEventService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/my-boss-info:
 *   post:
 *     summary: 내 상관 정보 조회
 *     description: 자신의 상관(상급자) 정보를 조회합니다 (j_myBossInfo.php)
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 */
router.post('/my-boss-info', authenticate, async (req, res) => {
  try {
    const result = await GetMyBossInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/officer/appoint:
 *   post:
 *     summary: 관직 임명
 *     description: 수뇌부 또는 도시 관직에 장수를 임명하거나 관직을 비웁니다.
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               officerLevel:
 *                 type: integer
 *                 description: 임명할 관직 레벨 (2~11)
 *               destGeneralID:
 *                 type: integer
 *                 description: 임명할 장수 번호 (0이면 공석 처리)
 *               destCityID:
 *                 type: integer
 *                 description: 도시 관직(2~4) 임명 시 대상 도시 번호
 *     responses:
 *       200:
 *         description: 임명 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/officer/appoint', authenticate, async (req, res) => {
  try {
    const result = await ManageOfficerService.appoint(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/officer/kick:
 *   post:
 *     summary: 장수 추방
 *     description: 수뇌부가 소속 장수를 추방합니다
 *     tags: [Game]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - destGeneralID
 *             properties:
 *               session_id:
 *                 type: string
 *               destGeneralID:
 *                 type: number
 *                 description: 추방할 장수 ID
 *     responses:
 *       200:
 *         description: 추방 결과
 */
router.post('/officer/kick', authenticate, async (req, res) => {
  try {
    const result = await KickGeneralService.execute({
      ...req.body,
      targetGeneralId: req.body.destGeneralID,
    }, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/logs/general:
 */
router.post('/my-boss-info', authenticate, async (req, res) => {
  try {
    const result = await GetMyBossInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/logs/general:
 *   get:
 *     summary: 장수 동향 조회
 *     description: 특정 장수의 행동 기록을 조회합니다
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: generalId
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 */
router.get('/logs/general', async (req, res) => {
  try {
    const { sessionId, generalId, limit = 50 } = req.query;

    if (!sessionId || !generalId) {
      return res.status(400).json({
        result: false,
        reason: 'sessionId and generalId are required'
      });
    }

    const records = await generalRecordRepository.findByFilter(
      {
        session_id: sessionId,
        general_id: parseInt(generalId as string),
        log_type: 'action'
      },
      {
        sort: { created_at: -1 },
        limit: parseInt(limit as string)
      }
    );

    res.json({
      result: true,
      logs: records.map(record => ({
        id: record._id,
        generalId: record.general_id,
        logType: record.log_type,
        year: record.year,
        month: record.month,
        text: record.text,
        timestamp: record.created_at
      }))
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/logs/global:
 *   get:
 *     summary: 중원 정세 조회
 *     description: 전역 이벤트 히스토리를 조회합니다
 *     tags: [Game]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 */
router.get('/logs/global', async (req, res) => {
  try {
    const { sessionId, limit = 50 } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        result: false,
        reason: '세션 식별자가 필요합니다.'
      });
    }

    const histories = await worldHistoryRepository.findByFilter({
      session_id: sessionId,
      nation_id: 0  // 0 = 전역 이벤트
    })
      .sort({ created_at: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json({
      result: true,
      logs: histories.map(history => ({
        id: history._id,
        nationId: history.nation_id,
        year: history.year,
        month: history.month,
        text: history.text,
        timestamp: history.created_at
      }))
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/current-city:
 *   get:
 *     summary: 현재 도시 정보 조회
 *     tags: [Game]
 */
router.get('/current-city', optionalAuth, async (req, res) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'sangokushi_default';
    const userId = req.user?.userId;

    if (!userId) {
      return res.json({ result: false, reason: '로그인이 필요합니다' });
    }

    // 장수 조회
    const general = await General.findOne({
      session_id: sessionId,
      owner: userId.toString()
    }).lean();

    if (!general) {
      return res.json({ result: false, reason: '장수를 찾을 수 없습니다' });
    }

    // 도시 조회
    const cityId = general.data?.city || general.city;
    const city = cityId ? await cityRepository.findByCityNum(sessionId, cityId) : null;

    if (!city) {
      return res.json({ result: false, reason: '도시를 찾을 수 없습니다' });
    }

    // 주둔 장수 목록 조회
    const generals = await General.find({
      session_id: sessionId,
      $or: [
        { 'data.city': cityId },
        { city: cityId }
      ]
    }, {
      no: 1,
      name: 1,
      npc: 1,
      nation: 1,
      crew: 1,
      train: 1,
      atmos: 1,
      defence_train: 1,
      'data.no': 1,
      'data.name': 1,
      'data.npc': 1,
      'data.nation': 1,
      'data.crew': 1,
      'data.train': 1,
      'data.atmos': 1,
      'data.defence_train': 1
    }).lean();

    const formattedGenerals = generals.map(g => ({
      no: g.data?.no || g.no,
      name: g.data?.name || g.name,
      npc: g.data?.npc || g.npc || 0,
      nation: g.data?.nation || g.nation || 0,
      crew: g.data?.crew || g.crew || 0,
      train: g.data?.train || g.train,
      atmos: g.data?.atmos || g.atmos,
      defenceTrain: g.data?.defence_train || g.defence_train
    }));

    const generalNationId = general.data?.nation || general.nation || 0;
    const cityInfo = await GetFrontInfoService.generateCityInfo(sessionId, cityId, generalNationId);
    if (!cityInfo) {
      return res.json({ result: false, reason: '도시 정보를 생성할 수 없습니다' });
    }

    res.json({
      result: true,
      city: {
        ...cityInfo,
        generals: formattedGenerals
      },
      myNation: generalNationId
    });
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/history:
 *   post:
 *     summary: 연감 조회 (특정 년월 게임 기록)
 *     description: 특정 년월의 게임 히스토리(연감)를 조회합니다
 *     tags: [Game]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *               serverID:
 *                 type: string
 *               year:
 *                 type: number
 *               month:
 *                 type: number
 */
router.post('/history', authenticate, async (req, res) => {
  try {
    const { GetHistoryService } = await import('../services/global/GetHistory.service');
    const sessionId = req.body.session_id || req.body.serverID || 'sangokushi_default';
    const serverID = req.body.serverID || sessionId;

    const result = await GetHistoryService.execute({
      session_id: sessionId,
      serverID,
      year: req.body.year,
      month: req.body.month
    }, req.user);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/my-gen-info:
 *   post:
 *     summary: 내 장수 정보 조회
 */
router.post('/my-gen-info', authenticate, async (req, res) => {
  try {
    const { GetGeneralInfoService } = await import('../services/general/GetGeneralInfo.service');
    const result = await GetGeneralInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/game/my-boss-info:
 *   post:
 *     summary: 내 상관 정보 조회
 */
router.post('/my-boss-info', authenticate, async (req, res) => {
  try {
    const { GetBossInfoService } = await import('../services/general/GetBossInfo.service');
    const result = await GetBossInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ result: false, reason: error.message });
  }
});

export default router;
