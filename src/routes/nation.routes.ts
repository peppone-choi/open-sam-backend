// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';

import { GeneralListService } from '../services/nation/GeneralList.service';
import { GetGeneralLogService } from '../services/nation/GetGeneralLog.service';
import { GetNationInfoService } from '../services/nation/GetNationInfo.service';
import { SetBillService } from '../services/nation/SetBill.service';
import { SetBlockScoutService } from '../services/nation/SetBlockScout.service';
import { SetBlockWarService } from '../services/nation/SetBlockWar.service';
import { SetNoticeService } from '../services/nation/SetNotice.service';
import { SetRateService } from '../services/nation/SetRate.service';
import { SetScoutMsgService } from '../services/nation/SetScoutMsg.service';
import { SetSecretLimitService } from '../services/nation/SetSecretLimit.service';
import { SetTroopNameService } from '../services/nation/SetTroopName.service';
import { GetNationStratFinanService } from '../services/nation/GetNationStratFinan.service';
import { Diplomacy } from '../models/diplomacy.model';
import { KVStorage } from '../models/kv-storage.model';
import GameConstants from '../utils/game-constants';
import { generalRepository } from '../repositories/general.repository';
import { nationRepository } from '../repositories/nation.repository';
import { cityRepository } from '../repositories/city.repository';

const router = Router();

function toPlain<T>(doc: T | null | undefined): any | null {
  if (!doc) {
    return null;
  }
  return typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc;
}

/**
 * @swagger
 * /api/nation/general-list:
 *   post:
 *     summary: 국가 소속 장수 목록 조회
 *     description: |
 *       현재 국가에 소속된 모든 장수들의 정보를 조회합니다. 수뇌부는 더 상세한 정보를 볼 수 있습니다.
 *       
 *       **주요 기능:**
 *       - 국가 소속 장수 전체 목록 조회
 *       - 권한에 따른 정보 필터링 (일반 사관 vs 수뇌부)
 *       - 부대 정보 포함 (부대장, 부대명)
 *       - 장수의 능력치, 관직, 행동력 등 표시
 *       
 *       **권한 시스템:**
 *       - permission_level 0: 일반 유저 (기본 정보만)
 *       - permission_level 1: 사관년도 충족 (관직 정보 제한적 공개)
 *       - permission_level 2: 수뇌부 (officer_level >= 5, 모든 정보)
 *       - permission_level 3: 감찰권자 (auditor)
 *       - permission_level 4: 외교권자 (ambassador)
 *       
 *       **사용 시나리오:**
 *       1. **국가 관리 페이지**: 군주나 수뇌부가 전체 장수 현황 파악
 *          - 누가 어느 도시에 있는지
 *          - 각 장수의 행동력(turntime) 확인
 *          - 부대 편성 상황 확인
 *       
 *       2. **부대 편성**: 부대장이 부대원 선택 시 후보자 목록
 *          - 같은 국가 장수만 부대 편성 가능
 *          - 능력치 확인하여 적합한 장수 선발
 *       
 *       3. **외교/감찰**: 특별 권한자가 국가 내 장수 관리
 *          - 의심스러운 활동 감시
 *          - 외교 임무 수행자 선정
 *       
 *       4. **일반 사관**: 자신의 국가 동료 확인
 *          - 같이 전투할 장수 찾기
 *          - 국가 세력 파악
 *       
 *       **응답 데이터:**
 *       - list: 장수 배열 (능력치, 위치, 관직, 행동력 등)
 *       - troops: 부대 정보 (부대장 ID, 부대명)
 *       - permission: 요청자의 권한 레벨
 *       - env: 게임 환경 (연도, 월, 턴 정보)
 *       
 *       **주의사항:**
 *       - 국가에 소속되어 있어야 함 (nation !== 0)
 *       - 권한에 따라 일부 정보 숨김 처리
 *       - officer_level은 권한 없으면 1 또는 실제값만 표시
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *           examples:
 *             basic:
 *               summary: 기본 조회 (기본 세션)
 *               value: {}
 *             specific_session:
 *               summary: 특정 세션 조회
 *               value:
 *                 session_id: sangokushi_custom
 *     responses:
 *       200:
 *         description: 장수 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 permission:
 *                   type: number
 *                   description: 요청자 권한 레벨 (0-4)
 *                   example: 2
 *                 list:
 *                   type: array
 *                   description: 국가 소속 장수 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       no:
 *                         type: number
 *                         example: 1001
 *                       name:
 *                         type: string
 *                         example: 조조
 *                       nation:
 *                         type: number
 *                         example: 1
 *                       npc:
 *                         type: number
 *                         description: 0=유저, 1=NPC, 2=특수NPC
 *                         example: 0
 *                       injury:
 *                         type: number
 *                         description: 부상도 (100=사망)
 *                         example: 0
 *                       leadership:
 *                         type: number
 *                         description: 통솔력
 *                         example: 95
 *                       strength:
 *                         type: number
 *                         description: 무력
 *                         example: 72
 *                       intel:
 *                         type: number
 *                         description: 지력
 *                         example: 92
 *                       explevel:
 *                         type: number
 *                         description: 경험 레벨
 *                         example: 50
 *                       dedlevel:
 *                         type: number
 *                         description: 헌신 레벨
 *                         example: 30
 *                       gold:
 *                         type: number
 *                         example: 10000
 *                       rice:
 *                         type: number
 *                         example: 5000
 *                       officer_level:
 *                         type: number
 *                         description: 관직 레벨 (5이상=수뇌부)
 *                         example: 12
 *                       turntime:
 *                         type: number
 *                         description: 행동력
 *                         example: 1800
 *                       city:
 *                         type: number
 *                         description: 위치한 도시 ID
 *                         example: 1
 *                       troop:
 *                         type: number
 *                         description: 소속 부대장 ID (0=무소속)
 *                         example: 1002
 *                 troops:
 *                   type: array
 *                   description: 국가 내 부대 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                         description: 부대장 장수 ID
 *                         example: 1002
 *                       name:
 *                         type: string
 *                         example: 천자호위대
 *                       turntime:
 *                         type: number
 *                         example: 2000
 *                 env:
 *                   type: object
 *                   properties:
 *                     year:
 *                       type: number
 *                       example: 184
 *                     month:
 *                       type: number
 *                       example: 3
 *                     turntime:
 *                       type: number
 *                       example: 1800
 *                     turnterm:
 *                       type: number
 *                       example: 600
 *                 myGeneralID:
 *                   type: number
 *                   description: 요청한 장수의 ID
 *                   example: 1001
 *             examples:
 *               senior_officer:
 *                 summary: 수뇌부가 조회한 경우 (전체 정보)
 *                 value:
 *                   success: true
 *                   result: true
 *                   permission: 2
 *                   list:
 *                     - no: 1001
 *                       name: 조조
 *                       nation: 1
 *                       npc: 0
 *                       injury: 0
 *                       leadership: 95
 *                       strength: 72
 *                       intel: 92
 *                       officer_level: 12
 *                       turntime: 1800
 *                       city: 1
 *                     - no: 1002
 *                       name: 하후돈
 *                       leadership: 85
 *                       officer_level: 7
 *                   troops:
 *                     - id: 1002
 *                       name: 천자호위대
 *                   env:
 *                     year: 184
 *                     month: 3
 *               normal_member:
 *                 summary: 일반 사관이 조회 (제한된 정보)
 *                 value:
 *                   success: true
 *                   permission: 0
 *                   list:
 *                     - no: 1001
 *                       name: 조조
 *                       officer_level: 1
 *                       leadership: 95
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               not_in_nation:
 *                 summary: 국가 미소속
 *                 value:
 *                   success: false
 *                   message: 국가에 소속되어 있지 않습니다
 *               general_not_found:
 *                 summary: 장수 없음
 *                 value:
 *                   success: false
 *                   message: 장수를 찾을 수 없습니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/general-list', authenticate, asyncHandler(async (req, res) => {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/get-general-log:
 *   get:
 *     summary: 장수 행동/전투 기록 조회
 *     description: |
 *       국가 소속 장수의 행동 기록, 전투 결과, 전투 상세 로그를 조회합니다. 수뇌부나 감찰권자만 접근 가능합니다.
 *       
 *       **주요 기능:**
 *       - 장수의 과거 행동 기록 조회
 *       - 전투 결과 및 상세 전투 로그 확인
 *       - 일반 히스토리 (이동, 명령 등) 조회
 *       - 페이징 지원 (reqTo로 이전 로그 불러오기)
 *       
 *       **로그 타입:**
 *       - generalHistory: 일반 역사 기록 (이동, 임관, 관직 변경 등)
 *       - generalAction: 개인 행동 기록 (훈련, 개간, 상업 등 명령 실행)
 *       - battleResult: 전투 결과 요약
 *       - battleDetail: 전투 상세 턴별 기록
 *       
 *       **권한 요구사항:**
 *       - 최소 permission_level 1 이상 (사관년도 충족 또는 수뇌부)
 *       - generalAction은 유저 장수 본인이거나 수뇌부만 조회 가능
 *       - 같은 국가 소속 장수만 조회 가능
 *       
 *       **사용 시나리오:**
 *       1. **감찰**: 의심스러운 장수의 행동 감시
 *          - 스파이 의심 시 최근 행동 확인
 *          - 비정상적인 자원 이동 추적
 *       
 *       2. **전투 분석**: 전투 패배 원인 분석
 *          - 턴별 전투 상세 로그 확인
 *          - 어떤 기술이 사용되었는지
 *          - 병력 손실 과정 분석
 *       
 *       3. **수뇌부 관리**: 국가 구성원 활동 모니터링
 *          - 장수들이 명령을 제대로 수행하는지
 *          - 전투 참여 여부 확인
 *       
 *       4. **본인 기록 확인**: 자신의 과거 행동 리뷰
 *          - 어떤 전투에 참여했는지
 *          - 성장 과정 돌아보기
 *       
 *       **페이징:**
 *       - 한 번에 최대 30개 로그 반환
 *       - reqTo에 마지막 로그 ID를 전달하면 그 이전 로그 조회
 *       - 무한 스크롤 UI 구현 가능
 *       
 *       **주의사항:**
 *       - 같은 국가 소속만 조회 가능
 *       - 유저 장수의 개인 행동은 본인 또는 수뇌부만
 *       - NPC 장수는 누구나 조회 가능 (권한 있으면)
 *     tags: [Nation]
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
 *         name: targetGeneralID
 *         required: true
 *         schema:
 *           type: number
 *         description: 조회할 대상 장수 ID
 *         example: 1005
 *       - in: query
 *         name: reqType
 *         schema:
 *           type: string
 *           enum: [generalHistory, generalAction, battleResult, battleDetail]
 *         description: 로그 타입
 *         example: generalAction
 *       - in: query
 *         name: reqTo
 *         schema:
 *           type: number
 *         description: 페이징용 마지막 로그 ID (이전 로그 조회)
 *         example: 5000
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
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 reqType:
 *                   type: string
 *                   example: generalAction
 *                 generalID:
 *                   type: number
 *                   example: 1005
 *                 log:
 *                   type: array
 *                   description: 로그 항목 배열 (최대 30개)
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                         example: 5012
 *                       general_id:
 *                         type: number
 *                         example: 1005
 *                       log_type:
 *                         type: string
 *                         example: action
 *                       message:
 *                         type: string
 *                         example: 보병 100명 훈련 완료
 *                       data:
 *                         type: object
 *                         example: { action: "훈련", type: "soldier", amount: 100 }
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *             examples:
 *               action_log:
 *                 summary: 행동 기록 조회
 *                 value:
 *                   success: true
 *                   result: true
 *                   reqType: generalAction
 *                   generalID: 1005
 *                   log:
 *                     - id: 5012
 *                       general_id: 1005
 *                       log_type: action
 *                       message: 보병 100명 훈련 완료
 *                       created_at: 2024-11-01T10:30:00Z
 *                     - id: 5011
 *                       log_type: action
 *                       message: 개간 진행 - 농업 +50
 *               battle_result:
 *                 summary: 전투 결과 조회
 *                 value:
 *                   success: true
 *                   reqType: battleResult
 *                   generalID: 1005
 *                   log:
 *                     - id: 4500
 *                       log_type: battle_result
 *                       message: 낙양 공격전 승리
 *                       data:
 *                         result: win
 *                         casualties: 50
 *                         enemy_casualties: 200
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               different_nation:
 *                 summary: 다른 국가 장수
 *                 value:
 *                   success: false
 *                   message: 같은 국가의 장수가 아닙니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다
 *               no_permission_for_user_log:
 *                 summary: 유저 개인 로그 권한 없음
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다. 유저 장수의 개인 기록은 수뇌만 열람 가능합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/get-general-log', authenticate, asyncHandler(async (req, res) => {
    const result = await GetGeneralLogService.execute(req.query, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/get-nation-info:
 *   get:
 *     summary: 국가 정보 조회
 *     description: |
 *       현재 장수가 소속된 국가의 정보를 조회합니다. full 파라미터로 간단/상세 정보 선택 가능합니다.
 *       
 *       **주요 기능:**
 *       - 국가 기본 정보 (이름, 색상, 수도, 국고, 세율 등)
 *       - 간단 모드: 국가명, 색상, 수도, 장수수, 국고만
 *       - 상세 모드: 공고문, 세율, 사관제한, 정찰/선전 차단 여부, 부대 정보 등
 *       - 재야 장수는 "재야" 정보 반환
 *       
 *       **국가 정보 항목:**
 *       - nation: 국가 ID (0=재야)
 *       - name: 국가명
 *       - color: 국가 색상 코드
 *       - capital: 수도 도시 ID
 *       - gennum: 소속 장수 수
 *       - gold: 국고 (금)
 *       - rice: 국고 (쌀)
 *       - bill: 공고 금액 (장수 가입 시 지급)
 *       - rate: 세율 (5-30%)
 *       - secretlimit: 사관 제한 (헌신년도)
 *       - scout: 임관 차단 (0=허용, 1=차단)
 *       - war: 선전포고 차단 (0=허용, 1=차단)
 *       - level: 국가 레벨
 *       - type: 국가 타입
 *       
 *       **사용 시나리오:**
 *       1. **게임 UI 헤더**: 국가명과 색상 표시
 *          - full=false로 가벼운 정보만 조회
 *          - 매 페이지마다 필요한 기본 정보
 *       
 *       2. **국가 관리 페이지**: 수뇌부가 국가 현황 확인
 *          - full=true로 모든 정보 조회
 *          - 국고, 세율, 정책 등 확인
 *          - 부대 편성 현황 파악
 *       
 *       3. **임관 시스템**: 신규 가입자에게 국가 정보 제공
 *          - 어떤 국가인지 소개
 *          - 공고 금액 얼마인지
 *          - 임관 차단 여부 확인
 *       
 *       4. **재야 장수**: 국가 없는 상태 확인
 *          - nation === 0이면 재야
 *          - 임관 가능한 국가 찾기
 *       
 *       **부대 정보 (full=true):**
 *       - troops 객체로 부대장 ID -> 부대명 매핑
 *       - 부대 편성 UI에 사용
 *       
 *       **주의사항:**
 *       - 재야는 항상 고정된 정보 반환
 *       - full=false는 성능 최적화용 (DB 쿼리 최소화)
 *       - 국가 정보는 인증된 사용자만 조회 가능
 *     tags: [Nation]
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
 *         name: full
 *         schema:
 *           type: boolean
 *         description: 전체 정보 조회 여부 (false=간단 정보만)
 *         example: true
 *     responses:
 *       200:
 *         description: 국가 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 isFull:
 *                   type: boolean
 *                   description: 전체 정보 여부
 *                   example: true
 *                 nation:
 *                   type: object
 *                   properties:
 *                     nation:
 *                       type: number
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 위나라
 *                     color:
 *                       type: number
 *                       example: 0xFF0000
 *                     capital:
 *                       type: number
 *                       example: 1
 *                     gennum:
 *                       type: number
 *                       description: 소속 장수 수
 *                       example: 25
 *                     gold:
 *                       type: number
 *                       example: 100000
 *                     rice:
 *                       type: number
 *                       example: 50000
 *                     bill:
 *                       type: number
 *                       description: 공고 금액 (20-200)
 *                       example: 100
 *                     rate:
 *                       type: number
 *                       description: 세율 (5-30)
 *                       example: 15
 *                     secretlimit:
 *                       type: number
 *                       description: 사관 제한 (헌신년도)
 *                       example: 3
 *                     scout:
 *                       type: number
 *                       description: 임관 차단 (0=허용, 1=차단)
 *                       example: 0
 *                     war:
 *                       type: number
 *                       description: 선전포고 차단 (0=허용, 1=차단)
 *                       example: 0
 *                     level:
 *                       type: number
 *                       example: 5
 *                     type:
 *                       type: string
 *                       example: Kingdom
 *                 troops:
 *                   type: object
 *                   description: 부대장 ID -> 부대명 매핑 (full=true일 때만)
 *                   example:
 *                     "1002": "천자호위대"
 *                     "1005": "청주군"
 *                 impossibleStrategicCommandLists:
 *                   type: array
 *                   description: 사용 불가능한 전략 명령 목록
 *             examples:
 *               full_info:
 *                 summary: 전체 정보 조회 (full=true)
 *                 value:
 *                   success: true
 *                   result: true
 *                   isFull: true
 *                   nation:
 *                     nation: 1
 *                     name: 위나라
 *                     color: 16711680
 *                     capital: 1
 *                     gennum: 25
 *                     gold: 100000
 *                     rice: 50000
 *                     bill: 100
 *                     rate: 15
 *                     secretlimit: 3
 *                     scout: 0
 *                     war: 0
 *                     level: 5
 *                     type: Kingdom
 *                   troops:
 *                     "1002": "천자호위대"
 *                     "1005": "청주군"
 *               simple_info:
 *                 summary: 간단 정보 조회 (full=false)
 *                 value:
 *                   success: true
 *                   result: true
 *                   nation:
 *                     nation: 1
 *                     name: 위나라
 *                     color: 16711680
 *                     capital: 1
 *                     gennum: 25
 *                     gold: 100000
 *                     rice: 50000
 *                     level: 5
 *                     type: Kingdom
 *               ronin:
 *                 summary: 재야 장수
 *                 value:
 *                   success: true
 *                   result: true
 *                   nation:
 *                     nation: 0
 *                     name: 재야
 *                     color: 0
 *                     capital: 0
 *                     gennum: 0
 *                     gold: 0
 *                     rice: 0
 *                     level: 0
 *                     type: None
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/get-nation-info', authenticate, asyncHandler(async (req, res) => {
    const result = await GetNationInfoService.execute(req.query, req.user);
    res.json(result);
  }));

// 별칭 (프론트엔드 호환)
router.post('/info', authenticate, asyncHandler(async (req, res) => {
    // POST 요청도 GET과 동일하게 처리 (query 또는 body에서 파라미터 추출)
    const params = { ...req.query, ...req.body };
    const result = await GetNationInfoService.execute(params, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/strat_finan:
 *   post:
 *     summary: 국가 재정 예상 조회 (전략)
 *     description: 국가의 예상 수입/지출 정보를 조회합니다.
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/strat_finan', authenticate, asyncHandler(async (req, res) => {
    const result = await GetNationStratFinanService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-bill:
 *   post:
 *     summary: 공고 금액 설정
 *     description: |
 *       국가의 공고 금액을 설정합니다. 신규 장수가 임관할 때 지급되는 초기 자금입니다. 수뇌부 또는 전략권자만 설정 가능합니다.
 *       
 *       **주요 기능:**
 *       - 공고 금액 설정 (20-200 범위)
 *       - 신규 임관 장수에게 지급되는 초기 자금
 *       - 국가 재정 관리의 일부
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'strategic' (전략권자)
 *       
 *       **공고 금액 의미:**
 *       - 신규 장수 유치 수단
 *       - 높을수록 신규 장수 유입 증가
 *       - 너무 높으면 국고 부담
 *       - 적정선 유지 필요 (보통 50-100)
 *       
 *       **사용 시나리오:**
 *       1. **신규 장수 모집**: 전쟁 전 병력 확보
 *          - 공고 금액을 올려 장수 유치
 *          - 경쟁국보다 높게 설정
 *       
 *       2. **재정 긴축**: 국고 부족 시 절약
 *          - 공고 금액을 최소(20)로 설정
 *          - 기존 장수 유지에 집중
 *       
 *       3. **세력 확장기**: 적극적 영입
 *          - 공고 금액을 최대(200)로 설정
 *          - 빠른 성장 추구
 *       
 *       4. **정책 조정**: 상황에 따른 유연한 운영
 *          - 전쟁 중: 낮게 (자원 절약)
 *          - 평화 시: 높게 (세력 확장)
 *       
 *       **검증 규칙:**
 *       - 최소 20, 최대 200
 *       - 정수만 가능
 *       - 국가 소속 필수
 *       
 *       **주의사항:**
 *       - 실시간 반영 (다음 임관부터 적용)
 *       - 기존 장수에게는 영향 없음
 *       - 국고에서 실제 지급되므로 잔액 확인 필요
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               amount:
 *                 type: number
 *                 minimum: 20
 *                 maximum: 200
 *                 description: 공고 금액 (20-200)
 *                 example: 100
 *           examples:
 *             high_recruitment:
 *               summary: 적극 모집 (높은 공고)
 *               value:
 *                 amount: 150
 *             normal:
 *               summary: 일반 공고
 *               value:
 *                 amount: 80
 *             low_budget:
 *               summary: 긴축 재정 (낮은 공고)
 *               value:
 *                 amount: 30
 *     responses:
 *       200:
 *         description: 공고 금액 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 공고 금액이 100으로 설정되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               invalid_range:
 *                 summary: 범위 초과
 *                 value:
 *                   success: false
 *                   message: 공고 금액은 20~200 사이여야 합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다. 장수 이상이거나 전략권자여야 합니다
 *               not_in_nation:
 *                 summary: 국가 미소속
 *                 value:
 *                   success: false
 *                   message: 국가에 소속되어 있어야 합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-bill', authenticate, asyncHandler(async (req, res) => {
    const result = await SetBillService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-block-scout:
 *   post:
 *     summary: 임관 차단 설정
 *     description: |
 *       국가의 임관(신규 가입) 허용/차단을 설정합니다. 수뇌부 또는 외교권자만 설정 가능합니다.
 *       
 *       **주요 기능:**
 *       - 임관 허용/차단 토글
 *       - 신규 장수 가입 제어
 *       - 국가 폐쇄/개방 정책 관리
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **임관 차단 효과:**
 *       - value=true: 임관 차단 (신규 가입 불가)
 *       - value=false: 임관 허용 (신규 가입 가능)
 *       - 재야 장수가 국가 가입 시도 시 확인
 *       
 *       **사용 시나리오:**
 *       1. **스파이 방지**: 의심스러운 시기 임관 차단
 *          - 전쟁 직전 스파이 유입 방지
 *          - 중요 작전 전 보안 강화
 *       
 *       2. **내부 정비**: 기존 인원만으로 운영
 *          - 국가 재정비 기간
 *          - 신규 관리 부담 감소
 *       
 *       3. **선별 모집**: 특정 장수만 영입
 *          - 임관 차단 후 개별 초대
 *          - 검증된 인원만 수용
 *       
 *       4. **일반 운영**: 상시 모집
 *          - 임관 허용 상태 유지
 *          - 세력 확장 추구
 *       
 *       **제약 사항:**
 *       - 세션 설정(block_change_scout)에 따라 변경 불가능할 수 있음
 *       - 서버 관리자가 임관 고정 설정 가능
 *       
 *       **주의사항:**
 *       - 즉시 반영됨
 *       - 차단 중에도 초대는 가능할 수 있음 (시스템 설정 따름)
 *       - 기존 소속 장수에게는 영향 없음
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               value:
 *                 type: boolean
 *                 description: true=차단, false=허용
 *                 example: true
 *           examples:
 *             block:
 *               summary: 임관 차단
 *               value:
 *                 value: true
 *             allow:
 *               summary: 임관 허용
 *               value:
 *                 value: false
 *     responses:
 *       200:
 *         description: 임관 차단 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *             examples:
 *               blocked:
 *                 summary: 차단 설정
 *                 value:
 *                   success: true
 *                   result: true
 *                   message: 임관이 차단되었습니다
 *               allowed:
 *                 summary: 허용 설정
 *                 value:
 *                   success: true
 *                   result: true
 *                   message: 임관이 허용되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               cannot_change:
 *                 summary: 변경 불가능 (서버 설정)
 *                 value:
 *                   success: false
 *                   message: 임관 설정을 바꿀 수 없도록 설정되어 있습니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-block-scout', authenticate, asyncHandler(async (req, res) => {
    const result = await SetBlockScoutService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-block-war:
 *   post:
 *     summary: 선전포고 차단 설정
 *     description: |
 *       국가의 선전포고 허용/차단을 설정합니다. 다른 국가의 선전포고를 막을 수 있습니다. 수뇌부 또는 외교권자만 설정 가능하며, 잔여 횟수 제한이 있습니다.
 *       
 *       **주요 기능:**
 *       - 선전포고 허용/차단 토글
 *       - 다른 국가의 공격 선포 방지
 *       - 잔여 횟수 차감 (한정된 자원)
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **선전포고 차단 효과:**
 *       - value=true: 선전포고 차단 (전쟁 불가)
 *       - value=false: 선전포고 허용 (전쟁 가능)
 *       - 타국이 전쟁 선포 시도 시 차단
 *       
 *       **잔여 횟수 시스템:**
 *       - available_war_setting_cnt: 잔여 설정 가능 횟수
 *       - 매 설정마다 1회 차감
 *       - 0이 되면 더 이상 변경 불가
 *       - 게임 진행에 따라 회복될 수 있음
 *       
 *       **사용 시나리오:**
 *       1. **전쟁 회피**: 준비되지 않은 상태에서 보호
 *          - 내정 집중 기간
 *          - 병력 재정비 중
 *          - 외교 협상 진행 중
 *       
 *       2. **전략적 타이밍**: 특정 시점에만 전쟁
 *          - 차단 -> 준비 -> 허용 -> 선제공격
 *          - 적의 공격 타이밍 제어
 *       
 *       3. **신생국 보호**: 초반 성장기 보호
 *          - 건국 초기 선전포고 차단
 *          - 안정적 세력 구축
 *       
 *       4. **외교 카드**: 협상 수단
 *          - "차단 해제할테니 동맹"
 *          - 정치적 레버리지
 *       
 *       **잔여 횟수 관리:**
 *       - 신중하게 사용 필요
 *       - 불필요한 토글 자제
 *       - 중요한 순간에 대비
 *       
 *       **주의사항:**
 *       - 잔여 횟수 0이면 변경 불가
 *       - 차단 중에도 자신은 선전포고 가능
 *       - 이미 진행 중인 전쟁은 영향 없음
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               value:
 *                 type: boolean
 *                 description: true=차단, false=허용
 *                 example: true
 *           examples:
 *             block:
 *               summary: 선전포고 차단
 *               value:
 *                 value: true
 *             allow:
 *               summary: 선전포고 허용
 *               value:
 *                 value: false
 *     responses:
 *       200:
 *         description: 선전포고 차단 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 availableCnt:
 *                   type: number
 *                   description: 설정 후 잔여 횟수
 *                   example: 2
 *                 message:
 *                   type: string
 *             examples:
 *               blocked:
 *                 summary: 차단 설정
 *                 value:
 *                   success: true
 *                   result: true
 *                   availableCnt: 2
 *                   message: 선전포고가 차단되었습니다
 *               allowed:
 *                 summary: 허용 설정
 *                 value:
 *                   success: true
 *                   result: true
 *                   availableCnt: 1
 *                   message: 선전포고가 허용되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               no_remaining:
 *                 summary: 잔여 횟수 부족
 *                 value:
 *                   success: false
 *                   message: 잔여 횟수가 부족합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-block-war', authenticate, asyncHandler(async (req, res) => {
    const result = await SetBlockWarService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-notice:
 *   post:
 *     summary: 국가 공지 설정
 *     description: |
 *       국가 공지사항을 작성/수정합니다. 모든 국가 구성원에게 보여지는 중요 메시지입니다. 수뇌부 또는 외교권자만 작성 가능합니다.
 *       
 *       **주요 기능:**
 *       - 국가 공지 작성/수정
 *       - 작성자 정보 포함 (이름, ID)
 *       - 작성 시간 기록
 *       - 최대 16,384자 (긴 글 가능)
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **공지 용도:**
 *       - 국가 정책 안내
 *       - 전쟁 계획 공유
 *       - 중요 공지사항
 *       - 규칙 및 가이드
 *       - 이벤트 안내
 *       
 *       **사용 시나리오:**
 *       1. **전쟁 준비**: 전투 계획 공유
 *          - "3일 후 낙양 공격 예정"
 *          - "병력 집결 위치: 허창"
 *          - "참가 장수는 댓글로 의사 표시"
 *       
 *       2. **국가 규칙**: 내부 룰 공지
 *          - "국고 무단 사용 금지"
 *          - "전투 전 보고 필수"
 *          - "신규 장수 환영 인사"
 *       
 *       3. **외교 안내**: 동맹/적대 관계 공지
 *          - "촉나라와 동맹 체결"
 *          - "오나라와 전쟁 상태"
 *          - "중립국 목록"
 *       
 *       4. **이벤트**: 국가 행사 안내
 *          - "무술대회 개최"
 *          - "건국 기념일 이벤트"
 *          - "신규 장수 지원"
 *       
 *       **저장 정보:**
 *       - date: 작성 시간
 *       - msg: 공지 내용
 *       - author: 작성자 이름
 *       - authorID: 작성자 장수 ID
 *       
 *       **표시 위치:**
 *       - 국가 메인 페이지
 *       - 로그인 후 국가 대시보드
 *       - 장수 목록 상단
 *       
 *       **주의사항:**
 *       - 덮어쓰기 방식 (이전 공지 삭제됨)
 *       - 빈 문자열("")로 공지 삭제 가능
 *       - HTML 태그 사용 시 주의 (XSS 방지)
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - msg
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               msg:
 *                 type: string
 *                 maxLength: 16384
 *                 description: 공지 내용 (최대 16384자)
 *                 example: |
 *                   [국가 공지]
 *                   
 *                   3일 후 낙양 공격을 계획하고 있습니다.
 *                   모든 장수는 허창에 병력을 집결시켜 주세요.
 *                   
 *                   - 집결 기한: 184년 3월 10일
 *                   - 집결 장소: 허창
 *                   - 참가 장수: 댓글로 의사 표시
 *                   
 *                   위나라의 영광을 위하여!
 *           examples:
 *             war_notice:
 *               summary: 전쟁 공지
 *               value:
 *                 msg: |
 *                   [긴급 공지]
 *                   낙양 공격전 참가자 모집
 *                   일시: 184년 3월 15일
 *                   집결지: 허창
 *             rules:
 *               summary: 국가 규칙
 *               value:
 *                 msg: |
 *                   [국가 규칙]
 *                   1. 국고 무단 사용 금지
 *                   2. 전투 전 수뇌부 보고
 *                   3. 신규 장수 환영
 *             delete:
 *               summary: 공지 삭제
 *               value:
 *                 msg: ""
 *     responses:
 *       200:
 *         description: 공지 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 국가 공지가 설정되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               too_long:
 *                 summary: 길이 초과
 *                 value:
 *                   success: false
 *                   message: 공지는 최대 16384자까지 가능합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-notice', authenticate, asyncHandler(async (req, res) => {
    const result = await SetNoticeService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-rate:
 *   post:
 *     summary: 세율 설정
 *     description: |
 *       국가의 세율을 설정합니다. 세율은 장수들의 농업/상업 수익에서 국가로 귀속되는 비율입니다. 수뇌부 또는 외교권자만 설정 가능합니다.
 *       
 *       **주요 기능:**
 *       - 세율 설정 (5-30% 범위)
 *       - 장수 수익의 국가 귀속 비율 결정
 *       - 국가 재정과 장수 만족도 균형
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **세율 효과:**
 *       - 장수가 농업/상업 시 수익의 rate% 국고로
 *       - 나머지 (100-rate)%는 장수가 보유
 *       - 높을수록 국고 증가, 장수 불만 증가
 *       - 낮을수록 장수 만족, 국고 감소
 *       
 *       **세율 전략:**
 *       - **낮은 세율 (5-10%)**: 장수 유치형
 *         - 신규 장수 유입 증가
 *         - 기존 장수 만족도 상승
 *         - 국고 수입 감소
 *       
 *       - **중간 세율 (15-20%)**: 균형형
 *         - 적당한 국고 수입
 *         - 장수 불만 낮음
 *         - 안정적 운영
 *       
 *       - **높은 세율 (25-30%)**: 국고 중심형
 *         - 국고 빠른 증가
 *         - 전쟁 물자 확보
 *         - 장수 이탈 위험
 *       
 *       **사용 시나리오:**
 *       1. **전쟁 준비**: 높은 세율로 국고 확충
 *          - 30%로 설정
 *          - 무기/병력 대량 구매
 *          - 전쟁 후 낮춤
 *       
 *       2. **평화 시기**: 낮은 세율로 세력 확장
 *          - 5-10%로 설정
 *          - 신규 장수 유치
 *          - 내정 집중
 *       
 *       3. **위기 대응**: 상황별 조정
 *          - 국고 부족 시 일시 인상
 *          - 안정 시 인하
 *       
 *       4. **외교 카드**: 타국과 차별화
 *          - 경쟁국보다 낮은 세율
 *          - 장수 빼오기
 *       
 *       **장수 반응:**
 *       - 세율 높으면 이탈 가능성
 *       - 세율 낮으면 충성도 상승
 *       - 급격한 변경은 불만 유발
 *       
 *       **주의사항:**
 *       - 즉시 반영 (다음 농업/상업부터)
 *       - 기존 수익에는 영향 없음
 *       - 너무 자주 변경하면 혼란
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               amount:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 30
 *                 description: 세율 (5-30%)
 *                 example: 15
 *           examples:
 *             low_tax:
 *               summary: 낮은 세율 (장수 유치)
 *               value:
 *                 amount: 8
 *             normal_tax:
 *               summary: 일반 세율 (균형)
 *               value:
 *                 amount: 15
 *             high_tax:
 *               summary: 높은 세율 (국고 확충)
 *               value:
 *                 amount: 28
 *     responses:
 *       200:
 *         description: 세율 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 세율이 15%로 설정되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               invalid_range:
 *                 summary: 범위 초과
 *                 value:
 *                   success: false
 *                   message: 세율은 5~30 사이여야 합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-rate', authenticate, asyncHandler(async (req, res) => {
    const result = await SetRateService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-scout-msg:
 *   post:
 *     summary: 임관 메시지 설정
 *     description: |
 *       임관(신규 가입) 시 표시되는 환영 메시지를 설정합니다. 국가 소개, 규칙, 환영 인사 등을 담을 수 있습니다. 수뇌부 또는 외교권자만 설정 가능합니다.
 *       
 *       **주요 기능:**
 *       - 임관 환영 메시지 설정
 *       - 신규 장수에게 자동 표시
 *       - 국가 첫인상 결정
 *       - 최대 1,000자
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **메시지 용도:**
 *       - 국가 환영 인사
 *       - 기본 규칙 안내
 *       - 연락 방법 (디스코드 등)
 *       - 국가 정책 간단 소개
 *       - 주요 인물 소개
 *       
 *       **사용 시나리오:**
 *       1. **신규 장수 환영**: 친근한 메시지
 *          - "위나라에 오신 것을 환영합니다!"
 *          - "궁금한 점은 군주에게 문의하세요"
 *       
 *       2. **규칙 안내**: 핵심 룰 전달
 *          - "국고 무단 사용 금지"
 *          - "전투 시 보고 필수"
 *          - "무례한 언행 주의"
 *       
 *       3. **외부 커뮤니티**: 디스코드 등
 *          - "디스코드 주소: discord.gg/wei"
 *          - "카카오톡 오픈채팅: xxx"
 *       
 *       4. **국가 비전**: 목표 공유
 *          - "천하통일을 목표로 합니다"
 *          - "내정 중심 운영"
 *          - "PvP 적극 참여"
 *       
 *       **표시 시점:**
 *       - 임관 신청 시 확인 창
 *       - 임관 승인 후 환영 메시지
 *       - 국가 정보 조회 시
 *       
 *       **메시지 작성 팁:**
 *       - 간결하게 (1000자 제한)
 *       - 중요한 정보 우선
 *       - 친근한 어조
 *       - 연락처 포함
 *       
 *       **주의사항:**
 *       - 빈 문자열("")로 메시지 삭제 가능
 *       - 덮어쓰기 방식
 *       - 기존 가입자에게는 영향 없음
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - msg
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               msg:
 *                 type: string
 *                 maxLength: 1000
 *                 description: 임관 메시지 (최대 1000자)
 *                 example: |
 *                   위나라에 오신 것을 환영합니다!
 *                   
 *                   국가 규칙:
 *                   1. 국고 무단 사용 금지
 *                   2. 전투 시 보고 필수
 *                   
 *                   디스코드: discord.gg/wei
 *           examples:
 *             welcome:
 *               summary: 환영 메시지
 *               value:
 *                 msg: |
 *                   위나라에 오신 것을 환영합니다!
 *                   궁금한 점은 조조에게 문의하세요.
 *             detailed:
 *               summary: 상세 안내
 *               value:
 *                 msg: |
 *                   [위나라 임관 안내]
 *                   
 *                   환영합니다! 위나라는 천하통일을 목표로 합니다.
 *                   
 *                   규칙:
 *                   - 국고 사용 전 허가 필요
 *                   - 전투 참여 시 사전 보고
 *                   - 예의 바른 언행
 *                   
 *                   연락처:
 *                   - 디스코드: discord.gg/wei
 *                   - 군주: 조조
 *                   
 *                   함께 천하를 평정합시다!
 *             delete:
 *               summary: 메시지 삭제
 *               value:
 *                 msg: ""
 *     responses:
 *       200:
 *         description: 임관 메시지 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 임관 메시지가 설정되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               too_long:
 *                 summary: 길이 초과
 *                 value:
 *                   success: false
 *                   message: 임관 메시지는 최대 1000자까지 가능합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-scout-msg', authenticate, asyncHandler(async (req, res) => {
    const result = await SetScoutMsgService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-secret-limit:
 *   post:
 *     summary: 사관 제한 설정
 *     description: |
 *       사관(국가 기밀) 열람에 필요한 최소 헌신년도를 설정합니다. 높을수록 오래 봉사한 장수만 기밀 정보에 접근 가능합니다. 수뇌부 또는 외교권자만 설정 가능합니다.
 *       
 *       **주요 기능:**
 *       - 사관 열람 최소 헌신년도 설정 (1-99년)
 *       - 국가 기밀 보안 수준 조절
 *       - 신참과 고참 구분
 *       
 *       **권한 요구사항:**
 *       - officer_level >= 5 (수뇌부) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **헌신년도란:**
 *       - 장수가 국가에 소속된 게임 내 연수
 *       - dedlevel 필드로 관리
 *       - 시간이 지날수록 자동 증가
 *       - 충성도와 경험의 척도
 *       
 *       **사관 정보 (제한 대상):**
 *       - 장수들의 상세 관직
 *       - 개인 행동 기록
 *       - 국가 기밀 로그
 *       - 전략 계획
 *       - 장수 목록 상세 정보
 *       
 *       **설정 전략:**
 *       - **낮은 제한 (1-3년)**: 개방적
 *         - 신규 장수도 정보 접근
 *         - 빠른 적응 가능
 *         - 스파이 위험 증가
 *       
 *       - **중간 제한 (5-10년)**: 균형
 *         - 적당한 경력자만 접근
 *         - 보안과 개방성 균형
 *         - 일반적 운영
 *       
 *       - **높은 제한 (15-99년)**: 폐쇄적
 *         - 오랜 충성자만 접근
 *         - 보안 최우선
 *         - 신규 장수 불만 가능
 *       
 *       **사용 시나리오:**
 *       1. **전쟁 시기**: 보안 강화
 *          - 사관 제한 15년으로 상향
 *          - 스파이 정보 누설 방지
 *          - 전략 기밀 보호
 *       
 *       2. **평화 시기**: 개방적 운영
 *          - 사관 제한 3년으로 하향
 *          - 신규 장수 포용
 *          - 활발한 소통
 *       
 *       3. **스파이 적발 후**: 일시 강화
 *          - 보안 사고 후 긴급 조치
 *          - 신뢰 회복까지 유지
 *       
 *       4. **신생국**: 낮은 제한
 *          - 모든 구성원 협력 필요
 *          - 정보 공유 활성화
 *       
 *       **영향받는 기능:**
 *       - /general-list 상세 정보
 *       - /get-general-log 조회 권한
 *       - 국가 기밀 문서 열람
 *       - 전략 회의 참여
 *       
 *       **주의사항:**
 *       - 즉시 반영됨
 *       - 기존 권한 보유자는 유지
 *       - 너무 높으면 신규 이탈
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 99
 *                 description: 사관 제한 년수 (1-99년)
 *                 example: 5
 *           examples:
 *             low:
 *               summary: 낮은 제한 (개방적)
 *               value:
 *                 amount: 2
 *             normal:
 *               summary: 일반 제한 (균형)
 *               value:
 *                 amount: 5
 *             high:
 *               summary: 높은 제한 (보안 중시)
 *               value:
 *                 amount: 15
 *     responses:
 *       200:
 *         description: 사관 제한 설정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 사관 제한이 5년으로 설정되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               invalid_range:
 *                 summary: 범위 초과
 *                 value:
 *                   success: false
 *                   message: 사관 제한은 1~99 사이여야 합니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-secret-limit', authenticate, asyncHandler(async (req, res) => {
    const result = await SetSecretLimitService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/set-troop-name:
 *   post:
 *     summary: 부대 이름 변경
 *     description: |
 *       부대의 이름을 변경합니다. 부대장 본인 또는 외교권자만 변경 가능합니다.
 *       
 *       **주요 기능:**
 *       - 부대명 설정/변경
 *       - 부대 정체성 확립
 *       - 최대 18자 (한글 9자 정도)
 *       
 *       **권한 요구사항:**
 *       - 부대장 본인 (generalId === troopID) 또는
 *       - permission === 'ambassador' (외교권자)
 *       
 *       **부대 시스템:**
 *       - troop_leader: 부대장 장수 ID
 *       - 부대장과 같은 ID로 부대 식별
 *       - 여러 장수가 하나의 부대에 소속
 *       - 부대 단위로 전투 참여
 *       
 *       **부대명 용도:**
 *       - 부대 식별
 *       - 전투 시 표시
 *       - 국가 내 조직도
 *       - 역할 명시
 *       
 *       **사용 시나리오:**
 *       1. **부대 창설**: 부대 생성 후 이름 짓기
 *          - "천자호위대"
 *          - "청주별동대"
 *          - "맹호군"
 *       
 *       2. **역할 명시**: 부대 임무 표시
 *          - "선봉대" - 공격 담당
 *          - "방어대" - 수도 방어
 *          - "정찰대" - 정보 수집
 *       
 *       3. **지역 표시**: 담당 지역 명시
 *          - "낙양수비대"
 *          - "허창방어군"
 *          - "장안주둔군"
 *       
 *       4. **특수 부대**: 특별한 역할
 *          - "친위대" - 군주 호위
 *          - "정예기병" - 주력 부대
 *          - "신병훈련대"
 *       
 *       **네이밍 팁:**
 *       - 간결하게 (18자 제한)
 *       - 역할 명시
 *       - 위엄 있게
 *       - 한자 활용
 *       
 *       **부대장 vs 외교권자:**
 *       - 부대장: 자기 부대만 변경 가능
 *       - 외교권자: 모든 부대 변경 가능
 *       - 외교권자는 조직 개편 권한
 *       
 *       **검증:**
 *       - 부대가 존재해야 함
 *       - 같은 국가 소속이어야 함
 *       - troopID는 부대장 장수 ID
 *       
 *       **주의사항:**
 *       - 즉시 반영됨
 *       - 부대원들에게도 보임
 *       - 빈 이름 불가
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - troopID
 *               - troopName
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               troopID:
 *                 type: number
 *                 description: 부대장 장수 ID
 *                 example: 1002
 *               troopName:
 *                 type: string
 *                 maxLength: 18
 *                 description: 부대 이름 (최대 18자)
 *                 example: 천자호위대
 *           examples:
 *             elite:
 *               summary: 정예 부대
 *               value:
 *                 troopID: 1002
 *                 troopName: 천자호위대
 *             regional:
 *               summary: 지역 부대
 *               value:
 *                 troopID: 1005
 *                 troopName: 낙양수비대
 *             special:
 *               summary: 특수 부대
 *               value:
 *                 troopID: 1008
 *                 troopName: 청룡기병대
 *     responses:
 *       200:
 *         description: 부대 이름 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 부대 이름이 천자호위대(으)로 변경되었습니다
 *       400:
 *         description: 잘못된 요청
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
 *             examples:
 *               too_long:
 *                 summary: 이름 길이 초과
 *                 value:
 *                   success: false
 *                   message: 부대 이름은 최대 18자까지 가능합니다
 *               not_found:
 *                 summary: 부대 없음
 *                 value:
 *                   success: false
 *                   message: 부대를 찾을 수 없습니다
 *               insufficient_permission:
 *                 summary: 권한 부족
 *                 value:
 *                   success: false
 *                   message: 권한이 부족합니다. 본인 부대이거나 외교권자만 변경 가능합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/set-troop-name', authenticate, asyncHandler(async (req, res) => {
    const result = await SetTroopNameService.execute(req.body, req.user);
    res.json(result);
  }));

/**
 * @swagger
 * /api/nation/generals:
 *   post:
 *     summary: 국가 장수 목록 조회
 *     description: 국가에 소속된 모든 장수 목록을 조회합니다.
 *     tags: [Nation]
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
 *     responses:
 *       200:
 *         description: 장수 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 generals:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/generals', authenticate, asyncHandler(async (req, res) => {
    // GeneralListService 재사용
    const result = await GeneralListService.execute(req.body, req.user);
    if (result.success && result.list) {
      res.json({
        result: true,
        generals: result.list
      });
    } else {
      res.json({
        result: false,
        generals: [],
        reason: result.message || '장수 목록을 조회할 수 없습니다'
      });
    }
  }));

/**
 * @swagger
 * /api/nation/stratfinan:
 *   post:
 *     summary: 국가 전략/재정 정보 조회
 *     description: 국가의 전략 정보와 재정 상태를 조회합니다.
 *     tags: [Nation]
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
 *     responses:
 *       200:
 *         description: 전략/재정 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 stratFinan:
 *                   type: object
 */
router.post('/stratfinan', authenticate, asyncHandler(async (req, res) => {
    const sessionId = req.body.session_id || 'sangokushi_default';

    const ownerId = req.user?.userId ? String(req.user.userId) : null;
    if (!ownerId) {
      return res.json({ result: false, reason: '장수를 찾을 수 없습니다' });
    }

    const generalDoc: any = await generalRepository.findBySessionAndOwner(sessionId, ownerId);
    const general = toPlain(generalDoc);
    if (!general) {
      return res.json({ result: false, reason: '장수를 찾을 수 없습니다' });
    }

    const nationId = general.data?.nation || general.nation || 0;
    if (nationId === 0) {
      return res.json({ result: false, reason: '국가에 소속되어있지 않습니다' });
    }

    const officerLevel = general.data?.officer_level || 0;
    const permission = general.data?.permission || 0;

    // 권한 확인 (수뇌부 또는 외교권자)
    if (officerLevel < 5 && permission !== 4) {
      return res.json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다' });
    }

    const nationDoc: any = await nationRepository.findByNationNum(sessionId, nationId);
    const nation = toPlain(nationDoc);
    if (!nation) {
      return res.json({ result: false, reason: '국가를 찾을 수 없습니다' });
    }

    // Session 환경 조회 (year, month)
    const sessionKV: any = await KVStorage.findOne({ session_id: sessionId, storage_id: 'game_env' });
    const year = sessionKV?.data?.year || sessionKV?.value?.year || 0;
    const month = sessionKV?.data?.month || sessionKV?.value?.month || 0;

    const rawNationList: any[] = (await nationRepository.findBySession(sessionId)) || [];
    const allNations = rawNationList.map(toPlain).filter(Boolean);

    const sessionCities: any[] = (await cityRepository.findBySession(sessionId)) || [];
    const cityCntMap: Record<number, number> = {};
    sessionCities.forEach((city: any) => {
      const cityNation = city.nation ?? city.data?.nation ?? 0;
      cityCntMap[cityNation] = (cityCntMap[cityNation] || 0) + 1;
    });

    // 외교 관계 조회
    const diplomacyList: any[] = await Diplomacy.find({ session_id: sessionId, me: nationId });
    const dipStateMap: Record<number, { state: number; term: number }> = {};
    diplomacyList.forEach((dip: any) => {
      dipStateMap[dip.you] = { state: dip.state, term: dip.term };
    });

    // 국가 목록 구성 (PHP getAllNationStaticInfo() 정렬에 맞춘 요약 정보)
    const nationsList = allNations.map((n: any) => {
      const staticNationID = n.nation;
      const cityCnt = cityCntMap[staticNationID] || 0;
      const gennum = n.gennum ?? n.data?.gennum ?? 0;
      const power = n.power ?? n.data?.power ?? 0;
      let diplomacy;
      if (staticNationID === nationId) {
        diplomacy = { state: 7, term: null };
      } else {
        const dipState = dipStateMap[staticNationID];
        diplomacy = {
          state: dipState?.state !== undefined ? dipState.state : 0,
          term: dipState?.term || 0
        };
      }

      return {
        nation: n.nation,
        name: n.name,
        color: n.color,
        cityCnt,
        gennum,
        power,
        diplomacy
      };
    });

    // 국가 KVStorage 조회
    const nationKV: any = await KVStorage.findOne({ session_id: sessionId, storage_id: `nation_${nationId}` });
    const nationMsg = nationKV?.data?.nationNotice?.msg || nationKV?.value?.notice?.msg || '';
    const scoutMsg = nationKV?.data?.scout_msg || nationKV?.value?.scout_msg || '';
    const availableWarSettingCnt = nationKV?.data?.available_war_setting_cnt || nationKV?.value?.available_war_setting_cnt || 0;

    // 정책 데이터 구성
    const policy = {
      rate: nation.rate || 10,
      bill: nation.data?.bill || 100,
      secretLimit: nation.data?.secretlimit || 1,
      blockScout: (nation.data?.scout || 0) !== 0,
      blockWar: (nation.data?.war || 0) !== 0
    };

    // 전쟁 금지 설정 횟수
    const warSettingCnt = {
      remain: availableWarSettingCnt,
      inc: GameConstants.WAR_BLOCK_SETTING_INC,
      max: GameConstants.WAR_BLOCK_SETTING_MAX
    };

    // 재정 계산
    const { getGoldIncome, getRiceIncome, getWallIncome, getWarGoldIncome, getOutcome } = await import('../utils/income-util');

    const cityList: any[] = sessionCities.filter(
      (city: any) => (city.nation ?? city.data?.nation ?? 0) === nationId
    );

    // 관직자 수 집계 (officer_level IN (2,3,4) AND city = officer_city)
    const officersCnt: Record<number, number> = {};
    const generalsForOfficers: any[] = await generalRepository
      .findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $in: [2, 3, 4] }
      })
      .select('data')
      .lean();

    for (const general of generalsForOfficers) {
      const officerLevel = general.data?.officer_level || 0;
      const officerCity = general.data?.officer_city || 0;
      const generalCity = general.data?.city || 0;

      if (officerLevel >= 2 && officerLevel <= 4 && officerCity === generalCity && officerCity > 0) {
        officersCnt[officerCity] = (officersCnt[officerCity] || 0) + 1;
      }
    }

    // 국가 정보
    const nationLevel = nation.data?.level || 0;
    const taxRate = nation.data?.rate_tmp || nation.rate || 10;
    const capitalId = nation.data?.capital || nation.capital || 0;
    const nationType = nation.data?.type || nation.type || 'none';
    const billRate = nation.data?.bill || nation.bill || 100;

    // 금 수입 계산
    const cityGoldIncome = getGoldIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    // 전쟁 금 수입 계산
    const warGoldIncome = getWarGoldIncome(nationType, cityList);

    // 쌀 수입 계산
    const cityRiceIncome = getRiceIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    // 성벽 쌀 수입 계산
    const wallRiceIncome = getWallIncome(
      nationId,
      nationLevel,
      taxRate,
      capitalId,
      nationType,
      cityList,
      officersCnt
    );

    // 지출 계산
    const generalsForOutcome: any[] = await generalRepository
      .findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      })
      .select('data')
      .lean();

    const outcome = getOutcome(billRate, generalsForOutcome);

    const income = {
      gold: { city: cityGoldIncome, war: warGoldIncome },
      rice: { city: cityRiceIncome, wall: wallRiceIncome }
    };

    // 편집 권한 확인
    const editable = officerLevel >= 5 || permission === 4;

    res.json({
      result: true,
      stratFinan: {
        // 기본 환경 데이터
        year,
        month,
        nationID: nationId,
        officerLevel,
        editable,

        // 외교 관계
        nationsList,

        // 국가 메시지
        nationMsg,
        scoutMsg,

        // 자원
        gold: nation.gold || 0,
        rice: nation.rice || 0,

        // 정책
        policy,

        // 전쟁 금지 설정
        warSettingCnt,

        // 재정 (TODO)
        income,
        outcome
      }
    });
  }));

/**
 * @swagger
 * /api/nation/betting:
 *   post:
 *     summary: 국가 배팅 정보 조회
 *     description: 국가 관련 배팅 정보를 조회합니다.
 *     tags: [Nation]
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
 *     responses:
 *       200:
 *         description: 배팅 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 bettings:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/betting', authenticate, asyncHandler(async (req, res) => {
    // GetBettingListService 재사용
    const { GetBettingListService } = await import('../services/betting/GetBettingList.service');
    const result = await GetBettingListService.execute(req.body, req.user);
    if (result.result && result.bettingList) {
      // 국가 관련 배팅만 필터링 (선택사항)
      res.json({
        result: true,
        bettings: result.bettingList
      });
    } else {
      res.json({
        result: false,
        bettings: [],
        reason: result.reason || '배팅 정보를 조회할 수 없습니다'
      });
    }
  }));

export default router;
