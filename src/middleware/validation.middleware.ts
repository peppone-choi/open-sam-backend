/**
 * Input Validation Middleware
 * 
 * NoSQL Injection 방지를 위한 입력 검증 미들웨어
 * yup 스키마 기반 검증을 제공합니다.
 */

import * as yup from 'yup';
import { Request, Response, NextFunction } from 'express';

/**
 * 안전한 정수 파싱 헬퍼
 * parseInt 결과가 유효한 숫자인지 검증합니다.
 * 
 * @param value - 파싱할 값
 * @param fieldName - 필드 이름 (에러 메시지용)
 * @returns 유효한 정수 또는 에러
 */
export function safeParseInt(value: any, fieldName: string = 'value'): number {
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  
  return parsed;
}

/**
 * 안전한 양의 정수 파싱 헬퍼
 * 
 * @param value - 파싱할 값
 * @param fieldName - 필드 이름 (에러 메시지용)
 * @returns 유효한 양의 정수 또는 에러
 */
export function safeParsePositiveInt(value: any, fieldName: string = 'value'): number {
  const parsed = safeParseInt(value, fieldName);
  
  if (parsed < 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  
  return parsed;
}

/**
 * Validation Schemas
 */

// Admin Routes - General ID 검증
export const adminGeneralSchema = yup.object({
  generalID: yup.number()
    .integer('generalID must be an integer')
    .min(0, 'generalID must be >= 0')
    .required('generalID is required'),
  generalNo: yup.number()
    .integer('generalNo must be an integer')
    .min(0, 'generalNo must be >= 0')
    .optional(),
});

// Admin Routes - Penalty Level 검증
export const adminPenaltySchema = yup.object({
  generalNo: yup.number()
    .integer('generalNo must be an integer')
    .min(0, 'generalNo must be >= 0')
    .required('generalNo is required'),
  penaltyLevel: yup.number()
    .integer('penaltyLevel must be an integer')
    .min(0, 'penaltyLevel must be >= 0')
    .max(10, 'penaltyLevel must be <= 10')
    .required('penaltyLevel is required'),
});

// LOGH Routes - Commander Number 검증
export const loghCommanderSchema = yup.object({
  commanderNo: yup.number()
    .integer('commanderNo must be an integer')
    .min(0, 'commanderNo must be >= 0')
    .required('commanderNo is required'),
});

export const buildNationCandidateSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
});

export const dieOnPrestartSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number().integer().min(0).required('general_id is required'),
});

export const getCommandTableSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  category: yup.string().oneOf(['all', 'internal', 'military', 'personnel', 'diplomacy', 'special']).default('all'),
});

export const getFrontInfoSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
});

export const getGeneralLogSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  limit: yup.number().integer().min(1).max(100).default(50),
  log_type: yup.string().oneOf(['all', 'command', 'battle', 'item', 'status']).default('all'),
});

export const instantRetreatSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  battle_id: yup.string().required('battle_id is required'),
});

export const adjustIconSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
});

export const selectPickedGeneralSchema = yup.object({
  pick: yup.string().required('pick is required'),
  leadership: yup.number().integer().min(30).max(100).optional(),
  strength: yup.number().integer().min(30).max(100).optional(),
  intel: yup.number().integer().min(30).max(100).optional(),
  personal: yup.string().optional(),
  use_own_picture: yup.boolean().optional(),
});

export const updatePickedGeneralSchema = yup.object({
  pick: yup.string().required('pick is required'),
});

export const selectNpcSchema = yup.object({
  pick: yup.number().integer().min(0).required('pick is required'),
});

export const vacationSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
});

// Battle Routes - Battle ID 검증
export const battleIdSchema = yup.object({
  battleId: yup.string()
    .required('battleId is required')
    .matches(/^[a-f0-9-]+$/i, 'battleId must be a valid UUID or ID'),
});

// Battle Routes - General ID 검증
export const battleGeneralIdSchema = yup.object({
  generalId: yup.number()
    .integer('generalId must be an integer')
    .min(0, 'generalId must be >= 0')
    .required('generalId is required'),
});

// Nation ID 검증
export const nationIdSchema = yup.object({
  nationId: yup.number()
    .integer('nationId must be an integer')
    .min(0, 'nationId must be >= 0')
    .required('nationId is required'),
});

// City ID 검증
export const cityIdSchema = yup.object({
  cityId: yup.number()
    .integer('cityId must be an integer')
    .min(0, 'cityId must be >= 0')
    .required('cityId is required'),
});

// User ID 검증 (MongoDB ObjectId 또는 숫자)
export const userIdSchema = yup.object({
  userID: yup.mixed()
    .test('is-valid-id', 'userID must be a valid ObjectId or number', (value) => {
      if (typeof value === 'string') {
        return /^[a-f0-9]{24}$/i.test(value);
      }
      if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0;
      }
      return false;
    })
    .required('userID is required'),
});

// Pagination 검증
export const paginationSchema = yup.object({
  from: yup.number()
    .integer('from must be an integer')
    .min(0, 'from must be >= 0')
    .default(0),
  limit: yup.number()
    .integer('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(500, 'limit must be <= 500')
    .default(100),
});

// Session ID 검증
export const sessionIdSchema = yup.object({
  session_id: yup.string()
    .matches(/^[a-zA-Z0-9_-]+$/, 'session_id must contain only alphanumeric characters, underscores, and hyphens')
    .max(100, 'session_id must be <= 100 characters')
    .default('sangokushi_default'),
});

// ============================================================
// Auth Routes Schemas
// ============================================================

export const authRegisterSchema = yup.object({
  username: yup.string()
    .required('username is required')
    .min(2, 'username must be at least 2 characters')
    .max(50, 'username must be <= 50 characters')
    .matches(/^[a-zA-Z0-9_가-힣]+$/, 'username must contain only letters, numbers, underscores, or Korean characters'),
  password: yup.string()
    .required('password is required')
    .min(6, 'password must be at least 6 characters')
    .max(100, 'password must be <= 100 characters'),
});

export const authLoginSchema = yup.object({
  username: yup.string()
    .required('username is required')
    .max(50, 'username must be <= 50 characters'),
  password: yup.string()
    .required('password is required')
    .max(100, 'password must be <= 100 characters'),
});

// ============================================================
// Command Routes Schemas
// ============================================================

export const commandPushSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number().integer().min(0).optional(),
  amount: yup.number()
    .integer('amount must be an integer')
    .min(-12, 'amount must be >= -12')
    .max(12, 'amount must be <= 12')
    .optional(),
  turn_cnt: yup.number()
    .integer('turn_cnt must be an integer')
    .min(1, 'turn_cnt must be >= 1')
    .max(12, 'turn_cnt must be <= 12')
    .optional(),
});

export const commandReserveSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number().integer().min(0).optional(),
  turn_idx: yup.number()
    .integer('turn_idx must be an integer')
    .min(0, 'turn_idx must be >= 0')
    .max(29, 'turn_idx must be <= 29')
    .required('turn_idx is required'),
  action: yup.string().required('action is required'),
  // arg는 명령마다 구조가 다르므로 mixed로 선언하여 stripUnknown에서 제외
  arg: yup.mixed().optional(),
  brief: yup.string().max(500, 'brief must be <= 500 characters').optional(),
});

export const commandDeleteSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number().integer().min(0).optional(),
  turn_list: yup.array()
    .of(yup.number().integer().min(0).max(29))
    .min(1, 'turn_list must have at least 1 item')
    .required('turn_list is required'),
});

export const commandBulkReserveSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number().integer().min(0).optional(),
  commands: yup.array()
    .of(yup.object({
      action: yup.string().required(),
      arg: yup.object().optional(),
      brief: yup.string().optional(),
    }))
    .max(12, 'commands must have <= 12 items')
    .required('commands is required'),
});

// ============================================================
// General Routes Schemas
// ============================================================

export const generalJoinSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  name: yup.string()
    .required('name is required')
    .min(2, 'name must be at least 2 characters')
    .max(12, 'name must be <= 12 characters'),
  leadership: yup.number()
    .integer('leadership must be an integer')
    .min(30, 'leadership must be >= 30')
    .max(100, 'leadership must be <= 100')
    .required('leadership is required'),
  strength: yup.number()
    .integer('strength must be an integer')
    .min(30, 'strength must be >= 30')
    .max(100, 'strength must be <= 100')
    .required('strength is required'),
  intel: yup.number()
    .integer('intel must be an integer')
    .min(30, 'intel must be >= 30')
    .max(100, 'intel must be <= 100')
    .required('intel is required'),
  pic: yup.string().max(100).optional(),
  character: yup.string().oneOf(['brave', 'wise', 'loyal', 'ambitious']).optional(),
  inheritSpecial: yup.boolean().optional(),
  inheritTurntimeZone: yup.boolean().optional(),
  inheritCity: yup.boolean().optional(),
  inheritBonusStat: yup.number().integer().min(0).optional(),
});

export const generalSettingSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  defence_train: yup.number()
    .integer('defence_train must be an integer')
    .min(40, 'defence_train must be >= 40')
    .max(999, 'defence_train must be <= 999')
    .optional(),
  use_treatment: yup.number()
    .integer('use_treatment must be an integer')
    .min(10, 'use_treatment must be >= 10')
    .max(100, 'use_treatment must be <= 100')
    .optional(),
  use_auto_nation_turn: yup.number().integer().min(0).max(1).optional(),
  tnmt: yup.number()
    .integer('tnmt must be an integer')
    .min(0, 'tnmt must be >= 0')
    .max(1, 'tnmt must be <= 1')
    .optional(),
});

export const generalDropItemSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  item_id: yup.string().required('item_id is required'),
  item_type: yup.string()
    .oneOf(['weapon', 'armor', 'book', 'horse'], 'item_type must be one of: weapon, armor, book, horse')
    .optional(),
});

// ============================================================
// Battle Routes Schemas
// ============================================================

export const battleStartSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  attackerNationId: yup.number()
    .integer('attackerNationId must be an integer')
    .min(0, 'attackerNationId must be >= 0')
    .required('attackerNationId is required'),
  defenderNationId: yup.number()
    .integer('defenderNationId must be an integer')
    .min(0, 'defenderNationId must be >= 0')
    .required('defenderNationId is required'),
  targetCityId: yup.number()
    .integer('targetCityId must be an integer')
    .min(0, 'targetCityId must be >= 0')
    .required('targetCityId is required'),
  attackerGeneralIds: yup.array()
    .of(yup.number().integer().min(0))
    .optional(),
});

export const battleDeploySchema = yup.object({
  generalId: yup.number()
    .integer('generalId must be an integer')
    .min(0, 'generalId must be >= 0')
    .required('generalId is required'),
  position: yup.object({
    x: yup.number()
      .integer('x must be an integer')
      .min(0, 'x must be >= 0')
      .max(20, 'x must be <= 20')
      .required('x is required'),
    y: yup.number()
      .integer('y must be an integer')
      .min(0, 'y must be >= 0')
      .max(20, 'y must be <= 20')
      .required('y is required'),
  }).required('position is required'),
});

export const battleActionSchema = yup.object({
  generalId: yup.number()
    .integer('generalId must be an integer')
    .min(0, 'generalId must be >= 0')
    .required('generalId is required'),
  action: yup.string()
    .oneOf(['MOVE', 'ATTACK', 'SKILL', 'DEFEND', 'WAIT'], 'action must be one of: MOVE, ATTACK, SKILL, DEFEND, WAIT')
    .required('action is required'),
  target: yup.object({
    x: yup.number().integer().min(0).max(20),
    y: yup.number().integer().min(0).max(20),
  }).optional(),
  targetGeneralId: yup.number().integer().min(0).optional(),
  skillId: yup.string().max(100).optional(),
});

export const battleReadySchema = yup.object({
  generalId: yup.number()
    .integer('generalId must be an integer')
    .min(0, 'generalId must be >= 0')
    .required('generalId is required'),
});

export const battleAutoResolveSchema = yup.object({
  attackers: yup.object().required('attackers is required'),
  defenders: yup.object().required('defenders is required'),
  city: yup.object().optional(),
  maxTurns: yup.number().integer().min(1).max(100).optional(),
  seed: yup.string().optional(),
  scenarioId: yup.string().optional(),
});

export const battleSimulateSchema = yup.object({
  units: yup.array().of(yup.object()).required('units is required'),
  year: yup.number().integer().optional(),
  month: yup.number().integer().optional(),
  seed: yup.string().optional(),
  repeatCount: yup.number().integer().min(1).max(1000).optional(),
  terrain: yup.string().optional(),
  isDefenderCity: yup.boolean().optional(),
});

export const battleDetailSchema = yup.object({
  battleID: yup.number() // Note: Route uses battleID (number) but GetBattleState uses battleId (UUID). 
  // Checking route code: router.post('/detail' ... GetBattleDetailService.execute(req.body...
  // The schema in route comments says battleID: number.
    .integer('battleID must be an integer')
    .required('battleID is required'),
});

export const battleCenterQuerySchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  status: yup.string().oneOf(['ongoing', 'finished', 'all']).default('all'),
  limit: yup.number().integer().min(1).max(100).default(50),
});

// ============================================================
// Nation Routes Schemas
// ============================================================

export const nationSetBillSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  amount: yup.number()
    .integer('amount must be an integer')
    .min(20, 'amount must be >= 20')
    .max(200, 'amount must be <= 200')
    .required('amount is required'),
});

export const nationSetRateSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  amount: yup.number()
    .integer('amount must be an integer')
    .min(5, 'amount must be >= 5')
    .max(30, 'amount must be <= 30')
    .required('amount is required'),
});

export const nationSetSecretLimitSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  amount: yup.number()
    .integer('amount must be an integer')
    .min(1, 'amount must be >= 1')
    .max(99, 'amount must be <= 99')
    .required('amount is required'),
});

export const nationSetNoticeSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  msg: yup.string()
    .max(16384, 'msg must be <= 16384 characters')
    .required('msg is required'),
});

export const nationSetScoutMsgSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  msg: yup.string()
    .max(1000, 'msg must be <= 1000 characters')
    .required('msg is required'),
});

export const nationSetTroopNameSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  troopID: yup.number()
    .integer('troopID must be an integer')
    .min(0, 'troopID must be >= 0')
    .required('troopID is required'),
  troopName: yup.string()
    .min(1, 'troopName must be at least 1 character')
    .max(18, 'troopName must be <= 18 characters')
    .required('troopName is required'),
});

export const nationBlockScoutSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  value: yup.boolean().required('value is required'),
});

export const nationBlockWarSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  value: yup.boolean().required('value is required'),
});

// ============================================================
// Troop Routes Schemas
// ============================================================

export const troopJoinSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  troop_id: yup.number()
    .integer('troop_id must be an integer')
    .min(0, 'troop_id must be >= 0')
    .required('troop_id is required'),
});

export const troopKickSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number()
    .integer('general_id must be an integer')
    .min(0, 'general_id must be >= 0')
    .required('general_id is required'),
});

export const troopNewSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  name: yup.string()
    .min(1, 'name must be at least 1 character')
    .max(18, 'name must be <= 18 characters')
    .required('name is required'),
  description: yup.string().max(500, 'description must be <= 500 characters').optional(),
});

export const troopSetNameSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  name: yup.string()
    .min(1, 'name must be at least 1 character')
    .max(18, 'name must be <= 18 characters')
    .required('name is required'),
});

export const troopSetLeaderCandidateSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  general_id: yup.number()
    .integer('general_id must be an integer')
    .min(0, 'general_id must be >= 0')
    .required('general_id is required'),
});

// ============================================================
// Diplomacy Routes Schemas
// ============================================================

export const diplomacySendLetterSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  prevNo: yup.number().integer().min(0).optional(),
  destNationId: yup.number()
    .integer('destNationId must be an integer')
    .min(0, 'destNationId must be >= 0')
    .required('destNationId is required'),
  brief: yup.string()
    .max(200, 'brief must be <= 200 characters')
    .required('brief is required'),
  detail: yup.string()
    .max(5000, 'detail must be <= 5000 characters')
    .optional(),
});

export const diplomacyRespondSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  letterNo: yup.number()
    .integer('letterNo must be an integer')
    .min(0, 'letterNo must be >= 0')
    .required('letterNo is required'),
  action: yup.string()
    .oneOf(['accept', 'reject'], 'action must be one of: accept, reject')
    .required('action is required'),
});

export const diplomacyProcessSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  letterNo: yup.number()
    .integer('letterNo must be an integer')
    .min(0, 'letterNo must be >= 0')
    .required('letterNo is required'),
  action: yup.string().required('action is required'),
  data: yup.object().optional(),
});

// ============================================================
// Message Routes Schemas
// ============================================================

export const messageSendSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  to_general_id: yup.number()
    .integer('to_general_id must be an integer')
    .min(0, 'to_general_id must be >= 0')
    .optional(),
  destGeneralID: yup.number()
    .integer('destGeneralID must be an integer')
    .min(0, 'destGeneralID must be >= 0')
    .optional(),
  message: yup.string()
    .max(5000, 'message must be <= 5000 characters')
    .optional(),
  text: yup.string()
    .max(5000, 'text must be <= 5000 characters')
    .optional(),
  type: yup.string()
    .oneOf(['normal', 'diplomatic', 'secret'], 'type must be one of: normal, diplomatic, secret')
    .optional(),
  mailbox: yup.string().optional(),
});

export const messageDecideSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  message_id: yup.number()
    .integer('message_id must be an integer')
    .min(0, 'message_id must be >= 0')
    .optional(),
  msgID: yup.number()
    .integer('msgID must be an integer')
    .min(0, 'msgID must be >= 0')
    .optional(),
  response: yup.string()
    .oneOf(['accept', 'reject'], 'response must be one of: accept, reject')
    .required('response is required'),
});

export const messageDeleteSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  message_id: yup.number()
    .integer('message_id must be an integer')
    .min(0, 'message_id must be >= 0')
    .optional(),
  msgID: yup.number()
    .integer('msgID must be an integer')
    .min(0, 'msgID must be >= 0')
    .optional(),
});

export const getMessageListSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
});

export const getMessagesSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  type: yup.string().oneOf(['received', 'sent']).optional(),
  limit: yup.number().integer().min(1).max(100).optional(),
});

export const getOldMessageSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  before_id: yup.number().integer().min(0).required('before_id is required'),
});

export const getRecentMessageSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  limit: yup.number().integer().min(1).max(100).optional(),
});

export const setRecentMessageTypeSchema = yup.object({
  session_id: yup.string().default('sangokushi_default'),
  type: yup.string().required('type is required'),
});

/**
 * Validation Middleware Factory
 * 
 * @param schema - Yup validation schema
 * @param source - 검증할 데이터 소스 ('body' | 'params' | 'query')
 * @returns Express middleware
 */
export function validate(
  schema: yup.AnyObjectSchema,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 스키마 검증
      const validated = await schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
      });

      // 검증된 데이터로 교체
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({
          result: false,
          success: false,
          reason: 'Validation failed',
          errors: error.errors,
        });
      }

      // 예상치 못한 에러
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        result: false,
        success: false,
        reason: 'Internal validation error',
      });
    }
  };
}

/**
 * Combined Validation Middleware Factory
 * 여러 소스를 한 번에 검증합니다.
 * 
 * @param schemas - 소스별 스키마 맵
 * @returns Express middleware
 */
export function validateMultiple(schemas: {
  body?: yup.AnyObjectSchema;
  params?: yup.AnyObjectSchema;
  query?: yup.AnyObjectSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationPromises: Promise<any>[] = [];

      if (schemas.body) {
        validationPromises.push(
          schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.body = validated; })
        );
      }

      if (schemas.params) {
        validationPromises.push(
          schemas.params.validate(req.params, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.params = validated; })
        );
      }

      if (schemas.query) {
        validationPromises.push(
          schemas.query.validate(req.query, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.query = validated as any; })
        );
      }

      await Promise.all(validationPromises);
      next();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({
          result: false,
          success: false,
          reason: 'Validation failed',
          errors: error.errors,
        });
      }

      console.error('Validation middleware error:', error);
      return res.status(500).json({
        result: false,
        success: false,
        reason: 'Internal validation error',
      });
    }
  };
}

/**
 * 특정 필드를 안전하게 파싱하는 미들웨어
 */
export function sanitizeFields(fields: string[], source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source] as any;

      for (const field of fields) {
        if (data[field] !== undefined && data[field] !== null) {
          // 숫자로 파싱 시도
          const parsed = safeParseInt(data[field], field);
          data[field] = parsed;
        }
      }

      next();
    } catch (error: any) {
      return res.status(400).json({
        result: false,
        success: false,
        reason: error.message || 'Field sanitization failed',
      });
    }
  };
}

/**
 * MongoDB Operator Injection 방지
 * $, . 문자를 포함한 키를 거부합니다.
 */
export function preventMongoInjection(source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source] as any;

    function checkObject(obj: any, path: string = ''): string | null {
      if (obj === null || obj === undefined) return null;

      if (typeof obj !== 'object') return null;

      for (const key in obj) {
        // $로 시작하는 키 거부
        if (key.startsWith('$')) {
          return `${path}${key}`;
        }

        // .를 포함한 키 거부
        if (key.includes('.')) {
          return `${path}${key}`;
        }

        // 재귀적으로 검사
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const result = checkObject(obj[key], `${path}${key}.`);
          if (result) return result;
        }
      }

      return null;
    }

    const dangerousKey = checkObject(data);
    if (dangerousKey) {
      return res.status(400).json({
        result: false,
        success: false,
        reason: `Potentially dangerous key detected: ${dangerousKey}`,
      });
    }

    next();
  };
}
