/**
 * GIN7 Auth Card Middleware
 * 
 * 직무 권한 카드 소유권 검증 및 CP 잔량 검증 미들웨어
 * @see agents/gin7-agents/gin7-auth-card/CHECKLIST.md Phase 4
 */

import { Request, Response, NextFunction } from 'express';
import { Gin7ApiError, GIN7_ERROR_CODES } from '../common/errors/gin7-errors';
import { Gin7Character, IGin7Character } from '../models/gin7/Character';
import { getCommandMeta } from '../config/gin7/catalog';

/**
 * Request 확장 인터페이스
 */
declare module 'express' {
  interface Request {
    gin7?: {
      character?: IGin7Character;
      cardId?: string;
      commandCode?: string;
      cpCost?: { pcp?: number; mcp?: number };
    };
  }
}

/**
 * 카드 소유권 검증 미들웨어
 * 
 * 요청된 카드가 해당 캐릭터에게 소유되어 있는지 확인합니다.
 * Body에 { cardId, characterId } 또는 params에 { cardId }, body에 { characterId }가 필요합니다.
 */
export function validateCardOwnership(options?: {
  cardIdSource?: 'params' | 'body' | 'query';
  characterIdSource?: 'params' | 'body' | 'query';
}) {
  const cardIdSource = options?.cardIdSource || 'params';
  const characterIdSource = options?.characterIdSource || 'body';

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const cardId = (req as any)[cardIdSource]?.cardId;
      const characterId = (req as any)[characterIdSource]?.characterId;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_SESSION_ID', message: 'sessionId가 필요합니다.' }
        });
      }

      if (!cardId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_CARD_ID', message: 'cardId가 필요합니다.' }
        });
      }

      if (!characterId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_CHARACTER_ID', message: 'characterId가 필요합니다.' }
        });
      }

      // 캐릭터 조회
      const character = await Gin7Character.findOne({
        sessionId,
        characterId
      });

      if (!character) {
        return res.status(404).json({
          success: false,
          error: { code: 'CHARACTER_NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' }
        });
      }

      // 카드 소유권 확인
      const hasCard = character.commandCards?.some(
        (card) => card.cardId === cardId
      );

      if (!hasCard) {
        const error = Gin7ApiError.cardNotOwned(cardId, characterId);
        return res.status(error.statusCode).json({
          success: false,
          error: error.toJSON()
        });
      }

      // 다음 미들웨어에서 사용할 수 있도록 저장
      req.gin7 = {
        ...req.gin7,
        character: character as IGin7Character,
        cardId
      };

      next();
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message }
      });
    }
  };
}

/**
 * CP 잔량 검증 미들웨어
 * 
 * 커맨드 실행에 필요한 CP가 충분한지 확인합니다.
 * validateCardOwnership 이후에 체이닝하여 사용합니다.
 */
export function validateCP(options?: {
  commandCodeSource?: 'params' | 'body' | 'query';
  allowSubstitution?: boolean; // 대용 소모 허용 여부
}) {
  const commandCodeSource = options?.commandCodeSource || 'params';
  const allowSubstitution = options?.allowSubstitution ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commandCode = (req as any)[commandCodeSource]?.commandCode;
      const character = req.gin7?.character;

      if (!character) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'MISSING_CHARACTER_CONTEXT', 
            message: 'validateCardOwnership 미들웨어를 먼저 실행해야 합니다.' 
          }
        });
      }

      if (!commandCode) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_COMMAND_CODE', message: 'commandCode가 필요합니다.' }
        });
      }

      // 커맨드 메타데이터 조회
      const meta = getCommandMeta(commandCode);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: { code: 'COMMAND_NOT_FOUND', message: `커맨드 '${commandCode}'를 찾을 수 없습니다.` }
        });
      }

      // CP 비용이 없는 커맨드는 바로 통과
      if (!meta.cpType || !meta.cpCost) {
        req.gin7 = { ...req.gin7, commandCode, cpCost: undefined };
        return next();
      }

      // CP 비용 파싱
      const numericCost = typeof meta.cpCost === 'number' 
        ? meta.cpCost 
        : parseFloat(String(meta.cpCost)) || 0;

      const cp = character.commandPoints || { pcp: 0, mcp: 0, maxPcp: 24, maxMcp: 24, lastRecoveredAt: new Date() };
      const cpType = meta.cpType;

      // 기본 CP 검증
      if (cpType === 'PCP') {
        if (cp.pcp >= numericCost) {
          req.gin7 = { ...req.gin7, commandCode, cpCost: { pcp: numericCost } };
          return next();
        }

        // 대용 소모 (MCP로 2배 소모)
        if (allowSubstitution && cp.mcp >= numericCost * 2) {
          req.gin7 = { ...req.gin7, commandCode, cpCost: { mcp: numericCost * 2 } };
          return next();
        }

        const error = Gin7ApiError.cpInsufficient(numericCost, cp.pcp, 'PCP');
        return res.status(error.statusCode).json({
          success: false,
          error: error.toJSON()
        });
      }

      if (cpType === 'MCP') {
        if (cp.mcp >= numericCost) {
          req.gin7 = { ...req.gin7, commandCode, cpCost: { mcp: numericCost } };
          return next();
        }

        // 대용 소모 (PCP로 2배 소모)
        if (allowSubstitution && cp.pcp >= numericCost * 2) {
          req.gin7 = { ...req.gin7, commandCode, cpCost: { pcp: numericCost * 2 } };
          return next();
        }

        const error = Gin7ApiError.cpInsufficient(numericCost, cp.mcp, 'MCP');
        return res.status(error.statusCode).json({
          success: false,
          error: error.toJSON()
        });
      }

      // BOTH 타입 처리
      const totalPcp = cp.pcp;
      const totalMcp = cp.mcp;
      if (totalPcp >= numericCost && totalMcp >= numericCost) {
        req.gin7 = { ...req.gin7, commandCode, cpCost: { pcp: numericCost, mcp: numericCost } };
        return next();
      }

      const error = Gin7ApiError.cpInsufficient(numericCost, Math.min(totalPcp, totalMcp), cpType as 'PCP' | 'MCP');
      return res.status(error.statusCode).json({
        success: false,
        error: error.toJSON()
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message }
      });
    }
  };
}

/**
 * 카드 소유권 + CP 검증을 한번에 처리하는 결합 미들웨어
 */
export function validateCardAndCP(options?: {
  cardIdSource?: 'params' | 'body' | 'query';
  characterIdSource?: 'params' | 'body' | 'query';
  commandCodeSource?: 'params' | 'body' | 'query';
  allowSubstitution?: boolean;
}) {
  const cardOwnershipValidator = validateCardOwnership({
    cardIdSource: options?.cardIdSource,
    characterIdSource: options?.characterIdSource
  });

  const cpValidator = validateCP({
    commandCodeSource: options?.commandCodeSource,
    allowSubstitution: options?.allowSubstitution
  });

  return (req: Request, res: Response, next: NextFunction) => {
    cardOwnershipValidator(req, res, (err?: any) => {
      if (err) return next(err);
      cpValidator(req, res, next);
    });
  };
}

/**
 * CP 차감 유틸리티 함수 (Atomic 버전)
 * 
 * 동시 요청 시 Race Condition을 방지하기 위해
 * MongoDB의 findOneAndUpdate + $inc 연산을 사용합니다.
 * CP가 음수가 되는 것을 방지합니다.
 * 
 * @returns 성공 여부와 차감 후 CP 잔량
 */
export async function deductCPAtomic(
  sessionId: string,
  characterId: string,
  cpCost: { pcp?: number; mcp?: number }
): Promise<{ success: boolean; remaining?: { pcp: number; mcp: number }; error?: string }> {
  const pcpCost = cpCost.pcp || 0;
  const mcpCost = cpCost.mcp || 0;

  if (pcpCost === 0 && mcpCost === 0) {
    return { success: true };
  }

  // Step 1: 현재 CP 잔량 검증 (Optimistic check)
  const character = await Gin7Character.findOne({ sessionId, characterId });
  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }

  const currentPcp = character.commandPoints?.pcp ?? 0;
  const currentMcp = character.commandPoints?.mcp ?? 0;

  if (pcpCost > 0 && currentPcp < pcpCost) {
    return { success: false, error: `정략 CP 부족 (필요: ${pcpCost}, 보유: ${currentPcp})` };
  }
  if (mcpCost > 0 && currentMcp < mcpCost) {
    return { success: false, error: `군사 CP 부족 (필요: ${mcpCost}, 보유: ${currentMcp})` };
  }

  // Step 2: Atomic 차감 ($inc with negative values)
  // 조건: CP가 차감량 이상일 때만 업데이트
  const updateQuery: Record<string, any> = {};
  const matchQuery: Record<string, any> = {
    sessionId,
    characterId
  };

  if (pcpCost > 0) {
    updateQuery['commandPoints.pcp'] = -pcpCost;
    matchQuery['commandPoints.pcp'] = { $gte: pcpCost };
  }
  if (mcpCost > 0) {
    updateQuery['commandPoints.mcp'] = -mcpCost;
    matchQuery['commandPoints.mcp'] = { $gte: mcpCost };
  }

  const result = await Gin7Character.findOneAndUpdate(
    matchQuery,
    { $inc: updateQuery },
    { new: true }
  );

  if (!result) {
    // Race condition 발생: 다른 요청이 먼저 CP를 소모함
    return { 
      success: false, 
      error: 'CP 차감 실패: 동시 요청으로 인해 CP가 부족합니다. 다시 시도해주세요.' 
    };
  }

  return {
    success: true,
    remaining: {
      pcp: result.commandPoints?.pcp ?? 0,
      mcp: result.commandPoints?.mcp ?? 0
    }
  };
}

/**
 * CP 차감 유틸리티 함수 (레거시 - 단일 요청용)
 * 
 * @deprecated 동시 요청 환경에서는 deductCPAtomic 사용 권장
 */
export async function deductCP(
  character: IGin7Character,
  cpCost: { pcp?: number; mcp?: number }
): Promise<void> {
  if (!character.commandPoints) {
    character.commandPoints = {
      pcp: 12,
      mcp: 12,
      maxPcp: 24,
      maxMcp: 24,
      lastRecoveredAt: new Date()
    };
  }

  if (cpCost.pcp) {
    character.commandPoints.pcp = Math.max(0, character.commandPoints.pcp - cpCost.pcp);
  }

  if (cpCost.mcp) {
    character.commandPoints.mcp = Math.max(0, character.commandPoints.mcp - cpCost.mcp);
  }

  await character.save();
}

