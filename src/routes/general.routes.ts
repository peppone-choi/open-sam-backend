import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';

import { BuildNationCandidateService } from '../services/general/BuildNationCandidate.service';
import { DieOnPrestartService } from '../services/general/DieOnPrestart.service';
import { DropItemService } from '../services/general/DropItem.service';
import { GetCommandTableService } from '../services/general/GetCommandTable.service';
import { GetFrontInfoService } from '../services/general/GetFrontInfo.service';
import { GetGeneralLogService } from '../services/general/GetGeneralLog.service';
import { GetBossInfoService } from '../services/general/GetBossInfo.service';
import { AdjustIconService } from '../services/general/AdjustIcon.service';
import { GetSelectPoolService } from '../services/general/GetSelectPool.service';
import { SelectPickedGeneralService } from '../services/general/SelectPickedGeneral.service';
import { UpdatePickedGeneralService } from '../services/general/UpdatePickedGeneral.service';
import { GetSelectNpcTokenService } from '../services/general/GetSelectNpcToken.service';
import { SelectNpcService } from '../services/general/SelectNpc.service';
import { InstantRetreatService } from '../services/general/InstantRetreat.service';
import { JoinService } from '../services/general/Join.service';
import { GetJoinInfoService } from '../services/general/GetJoinInfo.service';
import { VacationService } from '../services/general/Vacation.service';
import { SetMySettingService } from '../services/general/SetMySetting.service';

const router = Router();

/**
 * @swagger
 * /api/general/build-nation-candidate:
 *   post:
 *     summary: 장수가 국가 설립 후보자로 등록 (사전 거병)
 *     description: |
 *       게임 시작 전 재야 장수가 자신의 국가를 세우기 위해 후보로 등록합니다.
 *       
 *       **기능:**
 *       - 재야(nation: 0) 장수만 신청 가능
 *       - 게임 시작 전(turntime < opentime)에만 가능
 *       - 시나리오 설정에서 허용된 경우에만 사용 가능
 *       - 신청 후 게임 시작 시 자동으로 국가 설립
 *       
 *       **사용 시나리오:**
 *       1. 혼자 시작하고 싶을 때 - 타국에 소속되지 않고 독립
 *       2. 자신만의 세력 구축 - 처음부터 군주로 플레이
 *       3. 역사 재현 - 특정 시나리오의 독립 세력 플레이
 *       
 *       **필요 조건:**
 *       - 장수가 재야 상태여야 함
 *       - 게임 시작 전이어야 함
 *       - availableInstantAction.buildNationCandidate = true
 *       
 *       **주의사항:**
 *       - 이미 국가에 소속된 경우 실패
 *       - 게임 시작 후에는 사용 불가
 *       - 한 번 신청하면 취소 불가
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
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *           example:
 *             session_id: sangokushi_default
 *     responses:
 *       200:
 *         description: 국가 설립 후보 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 국가 설립 후보로 등록되었습니다
 *       400:
 *         description: 등록 실패 (조건 불충족)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 이미 국가에 소속되어있습니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/build-nation-candidate', authenticate, async (req, res) => {
  try {
    const result = await BuildNationCandidateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/die-on-prestart:
 *   post:
 *     summary: 게임 시작 전 장수 사망 처리
 *     description: |
 *       시나리오 시작 시점 이전에 이미 사망한 장수를 설정합니다.
 *       
 *       **기능:**
 *       - 역사적으로 이미 사망한 장수 사전 처리
 *       - 시나리오 일관성 유지
 *       - 게임 밸런스 조정
 *       
 *       **사용 시나리오:**
 *       1. 정사 모드 - 시나리오 시작 시점 이전 사망 장수 처리
 *       2. 커스텀 시나리오 - 특정 장수 제외
 *       3. 밸런스 조정 - 강력한 장수 사전 제거
 *       
 *       **처리 내용:**
 *       - 장수 상태를 '사망'으로 변경
 *       - 보유 병력 및 아이템 제거
 *       - 담당 도시가 있으면 다른 장수에게 이관
 *       
 *       **주의사항:**
 *       - 게임 시작 전에만 사용 가능
 *       - 한 번 사망 처리하면 복구 불가
 *       - 군주인 경우 국가도 함께 영향받을 수 있음
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - general_id
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               general_id:
 *                 type: number
 *                 description: 사망 처리할 장수 ID
 *                 example: 42
 *           example:
 *             session_id: sangokushi_default
 *             general_id: 42
 *     responses:
 *       200:
 *         description: 사망 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 처리 실패
 *       401:
 *         description: 인증 실패
 */
router.post('/die-on-prestart', authenticate, async (req, res) => {
  try {
    const result = await DieOnPrestartService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/drop-item:
 *   post:
 *     summary: 장수가 보유한 아이템 버리기
 *     description: |
 *       무기, 방어구, 서적 등의 아이템을 버립니다. 버린 아이템은 현재 위치한 도시에 남겨집니다.
 *       
 *       **기능:**
 *       - 보유 아이템을 도시로 이동
 *       - 장수 인벤토리에서 제거
 *       - 다른 장수가 획득 가능하도록 설정
 *       
 *       **사용 시나리오:**
 *       1. 더 좋은 아이템 획득 - 약한 아이템 정리
 *       2. 다른 장수에게 양보 - 팀플레이 전략
 *       3. 인벤토리 정리 - 필요 없는 아이템 제거
 *       
 *       **아이템 타입:**
 *       - 무기: 검, 창, 도끼 등
 *       - 방어구: 갑옷, 투구 등
 *       - 서적: 병법서, 기술서 등
 *       - 말: 적토마, 적로 등
 *       
 *       **주의사항:**
 *       - 버린 아이템은 즉시 회수 불가
 *       - 장착 중인 아이템도 버릴 수 있음
 *       - 희귀 아이템은 신중하게 판단
 *       - 도시에 남은 아이템은 다른 장수가 습득 가능
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - item_id
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               item_id:
 *                 type: string
 *                 description: 버릴 아이템 ID
 *                 example: item_sword_001
 *               item_type:
 *                 type: string
 *                 enum: [weapon, armor, book, horse]
 *                 description: 아이템 종류
 *                 example: weapon
 *           examples:
 *             drop_weapon:
 *               summary: 무기 버리기
 *               value:
 *                 session_id: sangokushi_default
 *                 item_id: item_sword_001
 *                 item_type: weapon
 *             drop_book:
 *               summary: 서적 버리기
 *               value:
 *                 session_id: sangokushi_default
 *                 item_id: item_book_sunzi
 *                 item_type: book
 *     responses:
 *       200:
 *         description: 아이템 버리기 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 dropped_item:
 *                   type: object
 *       400:
 *         description: 아이템 없음 또는 버리기 실패
 *       401:
 *         description: 인증 실패
 */
router.post('/drop-item', authenticate, async (req, res) => {
  try {
    const result = await DropItemService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-command-table:
 *   get:
 *     summary: 장수가 사용 가능한 명령 목록 조회
 *     description: |
 *       현재 장수의 상태와 위치에 따라 실행 가능한 모든 명령을 카테고리별로 반환합니다.
 *       
 *       **기능:**
 *       - 명령 카테고리별 분류 (내정, 군사, 인사, 외교 등)
 *       - 각 명령의 실행 조건 포함
 *       - 비용 및 소요 시간 정보
 *       - 현재 실행 가능 여부 표시
 *       
 *       **사용 시나리오:**
 *       1. UI 명령 메뉴 구성 - 사용 가능한 명령만 표시
 *       2. 명령 선택 도움 - 조건과 효과 확인
 *       3. 전략 수립 - 가능한 행동 파악
 *       
 *       **명령 카테고리:**
 *       - **내정**: 농업개발, 상업발전, 기술개발, 성벽보수
 *       - **군사**: 훈련, 모병, 징병, 정찰, 이동, 공격
 *       - **인사**: 등용, 추방, 임명, 포상
 *       - **외교**: 동맹, 선전포고, 휴전, 조공
 *       - **특수**: 계략, 암살, 방화 등
 *       
 *       **반환 정보:**
 *       - command_id: 명령 식별자
 *       - name: 명령 이름
 *       - category: 카테고리
 *       - cost: 필요 자원 (금, 쌀, 병력 등)
 *       - duration: 소요 턴 수
 *       - available: 현재 실행 가능 여부
 *       - requirements: 필요 조건
 *       - description: 효과 설명
 *       
 *       **주의사항:**
 *       - 장수의 관직과 권한에 따라 목록 달라짐
 *       - 소속 도시의 상태에 영향받음
 *       - 국가 정책에 따라 제한될 수 있음
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [all, internal, military, personnel, diplomacy, special]
 *         description: 필터링할 카테고리 (생략시 all)
 *         example: military
 *     responses:
 *       200:
 *         description: 명령 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: boolean
 *                 commandTable:
 *                   type: object
 *                   properties:
 *                     internal:
 *                       type: array
 *                       description: 내정 명령
 *                       items:
 *                         type: object
 *                     military:
 *                       type: array
 *                       description: 군사 명령
 *                       items:
 *                         type: object
 *                     personnel:
 *                       type: array
 *                       description: 인사 명령
 *                       items:
 *                         type: object
 *             example:
 *               success: true
 *               result: true
 *               commandTable:
 *                 internal:
 *                   - command_id: agriculture
 *                     name: 농업개발
 *                     cost: { gold: 1000 }
 *                     duration: 1
 *                     available: true
 *                 military:
 *                   - command_id: train
 *                     name: 훈련
 *                     cost: { gold: 500 }
 *                     duration: 1
 *                     available: true
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 */
router.get('/get-command-table', optionalAuth, async (req, res) => {
  try {
    const result = await GetCommandTableService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-front-info:
 *   get:
 *     summary: 전선(전투 지역) 정보 조회
 *     description: |
 *       장수가 위치한 지역의 전선 상황과 인접 적대 세력 정보를 조회합니다.
 *       
 *       **기능:**
 *       - 인접한 적대 국가 목록
 *       - 각 전선의 아군/적군 병력
 *       - 전투 발생 가능성
 *       - 방어/공격 우선순위
 *       
 *       **사용 시나리오:**
 *       1. 전투 준비 - 어느 방향에서 적이 올지 파악
 *       2. 방어 계획 - 취약한 전선 강화
 *       3. 공격 계획 - 유리한 전선 선택
 *       
 *       **반환 정보:**
 *       - adjacent_enemies: 인접 적대 국가
 *       - front_status: 각 전선 상황
 *       - troop_comparison: 병력 비교
 *       - threat_level: 위협 수준
 *       
 *       **주의사항:**
 *       - 정찰 명령 실행 여부에 따라 정확도 달라짐
 *       - 동맹 국가는 포함되지 않음
 *       - 실시간 업데이트되지 않을 수 있음
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 전선 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 frontInfo:
 *                   type: object
 *       401:
 *         description: 인증 실패
 */
router.get('/get-front-info', optionalAuth, async (req, res) => {
  try {
    // serverID를 session_id로 매핑 (프론트엔드 호환성)
    const params = {
      ...req.query,
      session_id: req.query.session_id || req.query.serverID || 'sangokushi_default',
    };
    const result = await GetFrontInfoService.execute(params, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-general-log:
 *   get:
 *     summary: 장수 활동 로그 조회
 *     description: |
 *       장수의 최근 활동 기록을 시간 순서대로 조회합니다.
 *       
 *       **기능:**
 *       - 실행한 명령 내역
 *       - 전투 참여 기록
 *       - 아이템 획득/손실
 *       - 능력치 변화
 *       - 관직 변경
 *       
 *       **사용 시나리오:**
 *       1. 활동 리뷰 - 지난 턴 작업 확인
 *       2. 문제 파악 - 예상과 다른 결과 원인 추적
 *       3. 전략 분석 - 효과적인 명령 패턴 발견
 *       
 *       **로그 타입:**
 *       - command: 명령 실행
 *       - battle: 전투 참여
 *       - item: 아이템 변화
 *       - status: 상태 변화
 *       - achievement: 업적 달성
 *       
 *       **주의사항:**
 *       - 최근 100개 기록만 조회
 *       - 오래된 기록은 자동 삭제될 수 있음
 *     tags: [General]
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         example: sangokushi_default
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 조회할 로그 개수
 *       - in: query
 *         name: log_type
 *         schema:
 *           type: string
 *           enum: [all, command, battle, item, status]
 *         description: 필터링할 로그 타입
 *     responses:
 *       200:
 *         description: 로그 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: 잘못된 요청
 */
router.get('/get-general-log', async (req, res) => {
  try {
    const result = await GetGeneralLogService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/instant-retreat:
 *   post:
 *     summary: 즉시 후퇴 (전투 중 탈출)
 *     description: |
 *       전투 중인 장수가 즉시 전장에서 후퇴합니다.
 *       
 *       **기능:**
 *       - 진행 중인 전투에서 즉시 이탈
 *       - 보유 병력의 일부 손실
 *       - 안전한 아군 도시로 귀환
 *       
 *       **사용 시나리오:**
 *       1. 불리한 전투 - 병력 손실 최소화
 *       2. 긴급 상황 - 다른 급한 일 처리
 *       3. 함정 회피 - 적의 매복 탈출
 *       
 *       **후퇴 패널티:**
 *       - 병력 10-30% 손실
 *       - 사기 하락
 *       - 일정 시간 명령 제한
 *       - 명성 감소
 *       
 *       **후퇴 불가 조건:**
 *       - 포위된 상태
 *       - 도주 경로 차단
 *       - 함정에 빠진 상태
 *       
 *       **주의사항:**
 *       - 후퇴는 즉시 실행됨 (취소 불가)
 *       - 일부 병력과 아이템 손실 가능
 *       - 전투 결과는 패배로 기록
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
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               battle_id:
 *                 type: string
 *                 description: 후퇴할 전투 ID
 *                 example: battle_001
 *     responses:
 *       200:
 *         description: 후퇴 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 casualties:
 *                   type: object
 *                   description: 손실 병력
 *       400:
 *         description: 후퇴 불가
 *       401:
 *         description: 인증 실패
 */
router.post('/instant-retreat', authenticate, async (req, res) => {
  try {
    const result = await InstantRetreatService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/join:
 *   post:
 *     summary: 새 장수 생성 및 게임 참여
 *     description: |
 *       새로운 장수를 생성하여 게임에 참여합니다.
 *       
 *       **기능:**
 *       - 장수 이름, 능력치, 외형 설정
 *       - 초기 스탯 분배 (통솔, 무력, 지력)
 *       - 초기 위치 선택
 *       - 특성 및 스킬 선택
 *       
 *       **사용 시나리오:**
 *       1. 처음 게임 시작 - 자신만의 장수 생성
 *       2. 추가 장수 - 멀티 플레이
 *       3. 상속 시스템 - 이전 장수의 유산 계승
 *       
 *       **스탯 분배:**
 *       - 총 포인트: 180-240 (난이도에 따라)
 *       - 통솔(leadership): 병력 지휘 능력
 *       - 무력(strength): 전투 능력
 *       - 지력(intel): 계략 및 내정 능력
 *       - 각 능력치 최소: 30, 최대: 100
 *       
 *       **상속 옵션:**
 *       - inheritSpecial: 특수 능력 상속
 *       - inheritTurntimeZone: 턴 시간대 유지
 *       - inheritCity: 도시 계승
 *       - inheritBonusStat: 보너스 스탯 상속
 *       
 *       **제한 사항:**
 *       - 한 세션당 최대 장수 수 제한
 *       - 이름 중복 불가
 *       - 금지된 단어 사용 불가
 *       - 특정 시기에만 참여 가능
 *       
 *       **주의사항:**
 *       - 스탯 분배는 신중하게 (변경 어려움)
 *       - 초기 위치가 게임에 큰 영향
 *       - 상속 옵션은 이전 장수 있을 때만 사용
 *     tags: [General]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - leadership
 *               - strength
 *               - intel
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 12
 *                 description: 장수 이름
 *                 example: 조자룡
 *               leadership:
 *                 type: integer
 *                 minimum: 30
 *                 maximum: 100
 *                 description: 통솔력
 *                 example: 85
 *               strength:
 *                 type: integer
 *                 minimum: 30
 *                 maximum: 100
 *                 description: 무력
 *                 example: 90
 *               intel:
 *                 type: integer
 *                 minimum: 30
 *                 maximum: 100
 *                 description: 지력
 *                 example: 75
 *               pic:
 *                 type: string
 *                 description: 초상화 ID
 *                 example: pic_001
 *               character:
 *                 type: string
 *                 enum: [brave, wise, loyal, ambitious]
 *                 description: 성격 타입
 *                 example: brave
 *               inheritSpecial:
 *                 type: boolean
 *                 description: 특수 능력 상속 여부
 *                 example: false
 *               inheritTurntimeZone:
 *                 type: boolean
 *                 description: 턴 시간대 상속 여부
 *                 example: true
 *               inheritCity:
 *                 type: boolean
 *                 description: 도시 상속 여부
 *                 example: false
 *               inheritBonusStat:
 *                 type: number
 *                 description: 보너스 스탯 상속
 *                 example: 0
 *           examples:
 *             new_general:
 *               summary: 신규 장수 생성
 *               value:
 *                 session_id: sangokushi_default
 *                 name: 조자룡
 *                 leadership: 85
 *                 strength: 90
 *                 intel: 75
 *                 pic: pic_zhao_yun
 *                 character: brave
 *                 inheritSpecial: false
 *             inherited_general:
 *               summary: 상속 장수 생성
 *               value:
 *                 session_id: sangokushi_default
 *                 name: 조통
 *                 leadership: 70
 *                 strength: 75
 *                 intel: 80
 *                 inheritSpecial: true
 *                 inheritCity: true
 *                 inheritBonusStat: 10
 *     responses:
 *       200:
 *         description: 장수 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 general:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     name:
 *                       type: string
 *                     nation:
 *                       type: number
 *                     city:
 *                       type: number
 *             example:
 *               success: true
 *               general:
 *                 id: 1001
 *                 name: 조자룡
 *                 nation: 0
 *                 city: 1
 *       400:
 *         description: 생성 실패 (조건 불충족)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *               examples:
 *                 duplicate_name:
 *                   value:
 *                     success: false
 *                     message: 이미 존재하는 이름입니다
 *                 invalid_stats:
 *                   value:
 *                     success: false
 *                     message: 능력치 합이 허용 범위를 초과합니다
 *       500:
 *         description: 서버 오류
 */
router.get('/get-join-info', optionalAuth, async (req, res) => {
  try {
    const result = await GetJoinInfoService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/join', authenticate, async (req, res) => {
  try {
    const result = await JoinService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-boss-info:
 *   get:
 *     summary: 상급자 정보 조회
 *     description: |
 *       현재 장수의 상급자(부대장, 도시 수뇌, 국가 수뇌) 정보를 조회합니다.
 *       
 *       **상급자 우선순위:**
 *       1. 부대장 (troop_leader) - 부대에 소속되어 있고 본인이 부대장이 아닌 경우
 *       2. 도시 수뇌 (city_officer) - 도시에 임명된 수뇌
 *       3. 국가 수뇌 (nation_chief) - 국가 수뇌부 장수
 *       4. 군주 (emperor) - 본인이 군주인 경우 상급자 없음
 *       
 *       **사용 시나리오:**
 *       - 조직 구조 파악
 *       - 보고 체계 확인
 *       - 상급자에게 메시지 전송
 *       - 계층 구조 표시
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 상급자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: boolean
 *                 bossInfo:
 *                   type: object
 *                   properties:
 *                     hasBoss:
 *                       type: boolean
 *                       description: 상급자 존재 여부
 *                     bossType:
 *                       type: string
 *                       enum: [troop_leader, city_officer, nation_chief, emperor]
 *                       description: 상급자 타입
 *                     bossGeneral:
 *                       type: object
 *                       description: 상급자 장수 정보
 *                       properties:
 *                         no:
 *                           type: number
 *                         name:
 *                           type: string
 *                         picture:
 *                           type: string
 *                         officer_level:
 *                           type: number
 *                         leadership:
 *                           type: number
 *                         strength:
 *                           type: number
 *                         intel:
 *                           type: number
 *                     bossCity:
 *                       type: object
 *                       description: 상급자가 있는 도시 정보
 *                       properties:
 *                         id:
 *                           type: number
 *                         name:
 *                           type: string
 *                     bossNation:
 *                       type: object
 *                       description: 상급자가 있는 국가 정보
 *                       properties:
 *                         nation:
 *                           type: number
 *                         name:
 *                           type: string
 *                         color:
 *                           type: number
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 */
router.get('/get-boss-info', authenticate, async (req, res) => {
  try {
    const result = await GetBossInfoService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/adjust-icon:
 *   post:
 *     summary: 장수 아이콘 조정
 *     description: |
 *       회원 정보의 아이콘을 현재 세션의 장수들에게 동기화합니다.
 *       
 *       **기능:**
 *       - 회원 테이블의 picture, imgsvr를 장수에게 적용
 *       - NPC가 아닌 장수만 업데이트
 *       
 *       **사용 시나리오:**
 *       - 회원이 프로필 사진을 변경했을 때
 *       - 장수 아이콘을 회원 아이콘과 동기화할 때
 *     tags: [General]
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
 *                 description: 게임 세션 ID
 *     responses:
 *       200:
 *         description: 아이콘 동기화 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *                 affected:
 *                   type: number
 *                   description: 업데이트된 장수 수
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 */
router.post('/adjust-icon', authenticate, async (req, res) => {
  try {
    const result = await AdjustIconService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-select-pool:
 *   get:
 *     summary: 장수 선택 풀 조회 (npcmode==2 전용)
 *     description: |
 *       장수 선택 풀을 조회합니다. npcmode가 2인 경우에만 사용 가능합니다.
 *       
 *       **기능:**
 *       - 기존 토큰이 있으면 반환
 *       - 없으면 새로 생성 (14개 장수)
 *       - dex 합계로 정렬
 *       
 *       **사용 시나리오:**
 *       - 장수 선택 화면에서 사용 가능한 장수 목록 표시
 *       - 새로고침으로 다시 뽑기
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 선택 풀 조회 성공
 */
router.get('/get-select-pool', authenticate, async (req, res) => {
  try {
    const result = await GetSelectPoolService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/select-picked-general:
 *   post:
 *     summary: 선택된 장수 생성 (npcmode==2 전용)
 *     description: |
 *       선택 풀에서 장수를 선택하여 실제 장수를 생성합니다.
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
 *               pick:
 *                 type: string
 *                 description: 선택한 장수의 unique_name
 *               leadership:
 *                 type: number
 *               strength:
 *                 type: number
 *               intel:
 *                 type: number
 *               personal:
 *                 type: string
 *               use_own_picture:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 장수 생성 성공
 */
router.post('/select-picked-general', authenticate, async (req, res) => {
  try {
    const result = await SelectPickedGeneralService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/update-picked-general:
 *   post:
 *     summary: 선택된 장수 업데이트 (npcmode==2 전용)
 *     description: |
 *       기존 장수를 다른 선택으로 변경합니다.
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
 *               pick:
 *                 type: string
 *                 description: 새로운 장수의 unique_name
 *     responses:
 *       200:
 *         description: 장수 업데이트 성공
 */
router.post('/update-picked-general', authenticate, async (req, res) => {
  try {
    const result = await UpdatePickedGeneralService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-select-npc-token:
 *   get:
 *     summary: NPC 선택 토큰 조회 (npcmode==1 전용)
 *     description: |
 *       NPC 선택 토큰을 조회하거나 생성합니다. npcmode가 1인 경우에만 사용 가능합니다.
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: keep
 *         schema:
 *           type: array
 *           items:
 *             type: number
 *     responses:
 *       200:
 *         description: NPC 토큰 조회 성공
 */
router.get('/get-select-npc-token', authenticate, async (req, res) => {
  try {
    const result = await GetSelectNpcTokenService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/select-npc:
 *   post:
 *     summary: NPC 선택 및 빙의 (npcmode==1 전용)
 *     description: |
 *       NPC 장수를 선택하여 빙의합니다.
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
 *               pick:
 *                 type: number
 *                 description: NPC 장수 번호
 *     responses:
 *       200:
 *         description: NPC 선택 성공
 */
router.post('/select-npc', authenticate, async (req, res) => {
  try {
    const result = await SelectNpcService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/vacation:
 *   post:
 *     summary: 휴가 모드 설정
 *     description: |
 *       장수의 턴 처리를 3배로 늦추는 휴가 모드 설정
 *       PHP: j_vacation.php
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 휴가 모드 설정 성공
 */
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
 * /api/general/set-my-setting:
 *   post:
 *     summary: 사용자 설정 저장
 *     description: |
 *       장수의 개인 설정을 저장합니다 (defence_train, use_treatment 등)
 *       PHP: j_set_my_setting.php
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
 *               defence_train:
 *                 type: number
 *                 description: 방어 훈련도 (40-999)
 *               use_treatment:
 *                 type: number
 *                 description: 치료 사용률 (10-100)
 *               use_auto_nation_turn:
 *                 type: number
 *                 description: 자동 국가 턴 사용 여부
 *               tnmt:
 *                 type: number
 *                 description: 토너먼트 참여 여부 (0-1)
 *     responses:
 *       200:
 *         description: 설정 저장 성공
 */
router.post('/set-my-setting', authenticate, async (req, res) => {
  try {
    const result = await SetMySettingService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
