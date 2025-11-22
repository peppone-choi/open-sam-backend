// @ts-nocheck - pending type cleanup
import { Betting } from '../../core/betting/Betting';
import { logger } from '../../common/logger';

function normalizeWinnerPayload(payload: any): number[] {
  if (!payload) {
    return [];
  }

  const parseValue = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  if (Array.isArray(payload)) {
    return payload
      .map(parseValue)
      .filter((value): value is number => value !== null);
  }

  if (typeof payload === 'string') {
    return payload
      .split(',')
      .map((token) => parseValue(token.trim()))
      .filter((value): value is number => value !== null);
  }

  if (typeof payload === 'number') {
    return [payload];
  }

  return [];
}

export class SettleBettingService {
  static async execute(data: any) {
    const sessionId = data.session_id || data.sessionId || 'sangokushi_default';
    const bettingID = Number(data.bettingID ?? data.betting_id);
    const winnerPayload = data.winner ?? data.winners ?? data.winnerType ?? data.result;
    const shouldCloseOnly = Boolean(data.closeOnly);

    if (!bettingID || Number.isNaN(bettingID)) {
      return {
        success: false,
        message: '베팅 ID가 필요합니다.'
      };
    }

    const winners = normalizeWinnerPayload(winnerPayload);

    try {
      const betting = new Betting(sessionId, bettingID);

      // 베팅 마감 처리
      await betting.closeBetting();

      let settled = false;
      if (!shouldCloseOnly && winners.length > 0) {
        await betting.giveReward(winners);
        settled = true;
      }

      return {
        success: true,
        result: true,
        bettingID,
        settled,
        winners
      };
    } catch (error: any) {
      logger.error('[SettleBettingService] Failed to settle betting', {
        sessionId,
        bettingID,
        error: error.message,
        payload: data
      });
      return {
        success: false,
        message: error.message
      };
    }
  }
}


