/**
 * 페잔 외교 API 라우트
 * 
 * 페잔 자치령의 외교, 통행권, 정보상, 금융 서비스를 제공합니다.
 */

import { Router, Request, Response } from 'express';
import { PassPermitService } from '../../services/gin7/PassPermitService';
import { InfoBrokerService } from '../../services/gin7/InfoBrokerService';
import { FezzanFinancialService } from '../../services/gin7/FezzanFinancialService';
import { logger } from '../../common/logger';

const router = Router();

// ============================================================================
// 통행권 (Pass Permit) API
// ============================================================================

/**
 * 페잔과의 외교 관계 조회
 */
router.get('/diplomacy/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const diplomacy = PassPermitService.getDiplomacy(sessionId, factionId);
    res.json({ success: true, diplomacy });
  } catch (error) {
    logger.error('[Fezzan API] diplomacy error:', error);
    res.status(500).json({ success: false, error: '외교 정보 조회 실패' });
  }
});

/**
 * 통행권 가격 계산
 */
router.get('/permit/price/:sessionId/:factionId/:permitType', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, permitType } = req.params;
    const fleetSize = req.query.fleetSize ? parseInt(req.query.fleetSize as string) : undefined;
    
    const result = PassPermitService.calculatePermitCost(
      sessionId,
      factionId,
      permitType as any,
      fleetSize
    );
    
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[Fezzan API] permit price error:', error);
    res.status(500).json({ success: false, error: '가격 계산 실패' });
  }
});

/**
 * 통행권 구매
 */
router.post('/permit/purchase', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, permitType, fleetId, characterId, maxFleetSize, route } = req.body;
    
    const result = await PassPermitService.purchasePermit(
      sessionId,
      factionId,
      permitType,
      { fleetId, characterId, maxFleetSize, route }
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] permit purchase error:', error);
    res.status(500).json({ success: false, error: '통행권 구매 실패' });
  }
});

/**
 * 통행권 유효성 검증
 */
router.get('/permit/validate/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const { fleetId, fleetSize } = req.query;
    
    const result = PassPermitService.validatePermit(
      sessionId,
      factionId,
      fleetId as string | undefined,
      fleetSize ? parseInt(fleetSize as string) : undefined
    );
    
    res.json({ success: result.valid, ...result });
  } catch (error) {
    logger.error('[Fezzan API] permit validate error:', error);
    res.status(500).json({ success: false, error: '통행권 검증 실패' });
  }
});

/**
 * 세력의 통행권 목록
 */
router.get('/permit/list/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const activeOnly = req.query.activeOnly === 'true';
    
    const permits = activeOnly
      ? PassPermitService.getActivePermits(sessionId, factionId)
      : PassPermitService.getFactionPermits(sessionId, factionId);
    
    res.json({ success: true, permits });
  } catch (error) {
    logger.error('[Fezzan API] permit list error:', error);
    res.status(500).json({ success: false, error: '통행권 목록 조회 실패' });
  }
});

/**
 * 활성 제재 목록
 */
router.get('/sanctions/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const sanctions = PassPermitService.getActiveSanctions(sessionId, factionId);
    res.json({ success: true, sanctions });
  } catch (error) {
    logger.error('[Fezzan API] sanctions error:', error);
    res.status(500).json({ success: false, error: '제재 목록 조회 실패' });
  }
});

/**
 * 통행권 가격표
 */
router.get('/permit/prices', async (_req: Request, res: Response) => {
  try {
    const prices = PassPermitService.getPermitPrices();
    res.json({ success: true, prices });
  } catch (error) {
    logger.error('[Fezzan API] permit prices error:', error);
    res.status(500).json({ success: false, error: '가격표 조회 실패' });
  }
});

// ============================================================================
// 정보상 (Info Broker) API
// ============================================================================

/**
 * 이용 가능한 정보 목록
 */
router.get('/intel/available/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const { category, targetFaction, maxPrice, minQuality } = req.query;
    
    const intel = InfoBrokerService.getAvailableIntel(sessionId, factionId, {
      category: category as any,
      targetFaction: targetFaction as string,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      minQuality: minQuality as any,
    });
    
    res.json({ success: true, intel });
  } catch (error) {
    logger.error('[Fezzan API] intel available error:', error);
    res.status(500).json({ success: false, error: '정보 목록 조회 실패' });
  }
});

/**
 * 정보 구매
 */
router.post('/intel/purchase', async (req: Request, res: Response) => {
  try {
    const { sessionId, productId, buyerFactionId, buyerCharacterId } = req.body;
    
    const result = await InfoBrokerService.purchaseIntel(
      sessionId,
      productId,
      buyerFactionId,
      buyerCharacterId
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] intel purchase error:', error);
    res.status(500).json({ success: false, error: '정보 구매 실패' });
  }
});

/**
 * 정보 구매 기록
 */
router.get('/intel/history/:sessionId/:factionId', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.params;
    const purchases = InfoBrokerService.getPurchaseHistory(sessionId, factionId);
    res.json({ success: true, purchases });
  } catch (error) {
    logger.error('[Fezzan API] intel history error:', error);
    res.status(500).json({ success: false, error: '구매 기록 조회 실패' });
  }
});

/**
 * 정보원 고용
 */
router.post('/intel/recruit', async (req: Request, res: Response) => {
  try {
    const { sessionId, buyerCharacterId, targetFaction, specialty } = req.body;
    
    const result = await InfoBrokerService.recruitInformant(
      sessionId,
      buyerCharacterId,
      targetFaction,
      specialty
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] intel recruit error:', error);
    res.status(500).json({ success: false, error: '정보원 고용 실패' });
  }
});

/**
 * 정보원 목록
 */
router.get('/intel/informants/:sessionId/:characterId', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const informants = InfoBrokerService.getInformants(sessionId, characterId);
    res.json({ success: true, informants });
  } catch (error) {
    logger.error('[Fezzan API] intel informants error:', error);
    res.status(500).json({ success: false, error: '정보원 목록 조회 실패' });
  }
});

/**
 * 정보원 보고서 수집
 */
router.post('/intel/collect/:sessionId/:characterId', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const reports = InfoBrokerService.collectInformantReports(sessionId, characterId);
    res.json({ success: true, reports });
  } catch (error) {
    logger.error('[Fezzan API] intel collect error:', error);
    res.status(500).json({ success: false, error: '보고서 수집 실패' });
  }
});

/**
 * 정보 가격표
 */
router.get('/intel/prices', async (_req: Request, res: Response) => {
  try {
    const prices = InfoBrokerService.getPriceList();
    res.json({ success: true, prices });
  } catch (error) {
    logger.error('[Fezzan API] intel prices error:', error);
    res.status(500).json({ success: false, error: '가격표 조회 실패' });
  }
});

// ============================================================================
// 금융 서비스 (Financial Services) API
// ============================================================================

/**
 * 계좌 개설
 */
router.post('/finance/account/open', async (req: Request, res: Response) => {
  try {
    const { sessionId, type, ownerId, ownerFaction } = req.body;
    
    const result = FezzanFinancialService.openAccount(
      sessionId,
      type,
      ownerId,
      ownerFaction
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] account open error:', error);
    res.status(500).json({ success: false, error: '계좌 개설 실패' });
  }
});

/**
 * 캐릭터 계좌 목록
 */
router.get('/finance/accounts/:sessionId/:characterId', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const accounts = FezzanFinancialService.getCharacterAccounts(sessionId, characterId);
    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('[Fezzan API] accounts list error:', error);
    res.status(500).json({ success: false, error: '계좌 목록 조회 실패' });
  }
});

/**
 * 입금
 */
router.post('/finance/deposit', async (req: Request, res: Response) => {
  try {
    const { sessionId, accountId, amount, accessCode } = req.body;
    
    const result = FezzanFinancialService.deposit(
      sessionId,
      accountId,
      amount,
      accessCode
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] deposit error:', error);
    res.status(500).json({ success: false, error: '입금 실패' });
  }
});

/**
 * 출금
 */
router.post('/finance/withdraw', async (req: Request, res: Response) => {
  try {
    const { sessionId, accountId, amount, accessCode } = req.body;
    
    const result = FezzanFinancialService.withdraw(
      sessionId,
      accountId,
      amount,
      accessCode
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] withdraw error:', error);
    res.status(500).json({ success: false, error: '출금 실패' });
  }
});

/**
 * 자금 세탁 요청
 */
router.post('/finance/launder', async (req: Request, res: Response) => {
  try {
    const { sessionId, accountId, requesterId, amount, layers, sourceDescription } = req.body;
    
    const result = await FezzanFinancialService.requestLaundering(
      sessionId,
      accountId,
      requesterId,
      amount,
      layers,
      sourceDescription
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] launder error:', error);
    res.status(500).json({ success: false, error: '자금 세탁 요청 실패' });
  }
});

/**
 * 자금 세탁 처리
 */
router.post('/finance/launder/process', async (req: Request, res: Response) => {
  try {
    const { sessionId, requestId } = req.body;
    
    const result = await FezzanFinancialService.processLaundering(sessionId, requestId);
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] launder process error:', error);
    res.status(500).json({ success: false, error: '자금 세탁 처리 실패' });
  }
});

/**
 * 자산 이전 요청 (망명자)
 */
router.post('/finance/transfer/request', async (req: Request, res: Response) => {
  try {
    const { sessionId, fromCharacterId, fromFaction, amount, toAccountId, requiresDefection } = req.body;
    
    const result = await FezzanFinancialService.requestAssetTransfer(
      sessionId,
      fromCharacterId,
      fromFaction,
      amount,
      toAccountId,
      requiresDefection
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] transfer request error:', error);
    res.status(500).json({ success: false, error: '자산 이전 요청 실패' });
  }
});

/**
 * 자산 이전 완료
 */
router.post('/finance/transfer/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId, transferId, defected } = req.body;
    
    const result = await FezzanFinancialService.completeAssetTransfer(
      sessionId,
      transferId,
      defected
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] transfer complete error:', error);
    res.status(500).json({ success: false, error: '자산 이전 완료 실패' });
  }
});

/**
 * 대출 신청
 */
router.post('/finance/loan/apply', async (req: Request, res: Response) => {
  try {
    const { sessionId, borrowerId, borrowerType, amount, termMonths, collateral } = req.body;
    
    const result = await FezzanFinancialService.applyForLoan(
      sessionId,
      borrowerId,
      borrowerType,
      amount,
      termMonths,
      collateral
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] loan apply error:', error);
    res.status(500).json({ success: false, error: '대출 신청 실패' });
  }
});

/**
 * 대출 상환
 */
router.post('/finance/loan/repay', async (req: Request, res: Response) => {
  try {
    const { sessionId, loanId, amount } = req.body;
    
    const result = await FezzanFinancialService.repayLoan(sessionId, loanId, amount);
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] loan repay error:', error);
    res.status(500).json({ success: false, error: '대출 상환 실패' });
  }
});

/**
 * 투자 실행
 */
router.post('/finance/invest', async (req: Request, res: Response) => {
  try {
    const { sessionId, investorId, targetType, targetId, targetName, amount, riskLevel } = req.body;
    
    const result = await FezzanFinancialService.makeInvestment(
      sessionId,
      investorId,
      targetType,
      targetId,
      targetName,
      amount,
      riskLevel
    );
    
    res.json(result);
  } catch (error) {
    logger.error('[Fezzan API] invest error:', error);
    res.status(500).json({ success: false, error: '투자 실패' });
  }
});

/**
 * 금융 요약
 */
router.get('/finance/summary/:sessionId/:characterId', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId } = req.params;
    const summary = FezzanFinancialService.getFinancialSummary(sessionId, characterId);
    res.json({ success: true, summary });
  } catch (error) {
    logger.error('[Fezzan API] finance summary error:', error);
    res.status(500).json({ success: false, error: '금융 요약 조회 실패' });
  }
});

/**
 * 수수료율 조회
 */
router.get('/finance/fees', async (_req: Request, res: Response) => {
  try {
    const fees = FezzanFinancialService.getFeeRates();
    res.json({ success: true, fees });
  } catch (error) {
    logger.error('[Fezzan API] fees error:', error);
    res.status(500).json({ success: false, error: '수수료율 조회 실패' });
  }
});

export default router;













