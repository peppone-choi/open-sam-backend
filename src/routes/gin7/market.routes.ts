import { Router, Request, Response } from 'express';
import { MarketService } from '../../services/gin7/MarketService';
import { TradeRouteService } from '../../services/gin7/TradeRouteService';
import { PiracyService } from '../../services/gin7/PiracyService';
import { MarketEventService } from '../../services/gin7/MarketEventService';
import { PhezzanService } from '../../services/gin7/PhezzanService';
import { BlackMarketService } from '../../services/gin7/BlackMarketService';
import { MarketPrice } from '../../models/gin7/MarketPrice';
import { TradeRoute } from '../../models/gin7/TradeRoute';
import { ResourceType } from '../../models/gin7/Warehouse';
import { gin7AuthMiddleware } from '../../middleware/gin7-auth.middleware';

const router = Router();

// Apply authentication to all market routes
router.use(gin7AuthMiddleware);

/**
 * GET /api/gin7/market/price/:locationId
 * Get all market prices for a location
 */
router.get('/price/:locationId', async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { sessionId } = req.query;
    const quantity = parseInt(req.query.quantity as string) || 1;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const prices = await MarketService.getMarketPrices(
      sessionId as string,
      locationId,
      quantity
    );

    return res.json({
      success: true,
      locationId,
      prices
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/price/:locationId/:itemType
 * Get price for a specific item at a location
 */
router.get('/price/:locationId/:itemType', async (req: Request, res: Response) => {
  try {
    const { locationId, itemType } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const market = await MarketService.getItemPrice(
      sessionId as string,
      locationId,
      itemType as ResourceType
    );

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    return res.json({
      success: true,
      market: {
        itemType: market.itemType,
        basePrice: market.basePrice,
        currentPrice: market.currentPrice,
        supply: market.supply,
        demand: market.demand,
        buyPrice: market.getBuyPrice(1),
        sellPrice: market.getSellPrice(1),
        trend: market.getPriceTrend(),
        isBlocked: market.isBlocked,
        priceHistory: market.priceHistory.slice(0, 7)  // Last 7 days
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/buy
 * Buy items from the market
 */
router.post('/buy', async (req: Request, res: Response) => {
  try {
    const { sessionId, locationId, itemType, quantity } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !locationId || !itemType || !quantity) {
      return res.status(400).json({ 
        error: 'sessionId, locationId, itemType, and quantity are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await MarketService.buy(
      sessionId,
      user.userId,
      user.characterId,
      locationId,
      itemType as ResourceType,
      quantity
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/sell
 * Sell items to the market
 */
router.post('/sell', async (req: Request, res: Response) => {
  try {
    const { sessionId, locationId, itemType, quantity } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !locationId || !itemType || !quantity) {
      return res.status(400).json({ 
        error: 'sessionId, locationId, itemType, and quantity are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await MarketService.sell(
      sessionId,
      user.userId,
      user.characterId,
      locationId,
      itemType as ResourceType,
      quantity
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/arbitrage
 * Find arbitrage opportunities
 */
router.get('/arbitrage', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.query;

    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId are required' });
    }

    const opportunities = await MarketService.findArbitrage(
      sessionId as string,
      factionId as string
    );

    return res.json({
      success: true,
      opportunities
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Trade Route APIs ====================

/**
 * POST /api/gin7/trade/route/create
 * Create a new trade route
 */
router.post('/trade/route/create', async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const {
      sessionId,
      factionId,
      sourceId,
      sourceType,
      sourceName,
      targetId,
      targetType,
      targetName,
      name,
      distance,
      items,
      frequency,
      escortRequired
    } = req.body;

    if (!sessionId || !factionId || !sourceId || !targetId || !name || !items) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    const route = await TradeRouteService.createRoute({
      sessionId,
      ownerId: user.characterId,
      factionId,
      sourceId,
      sourceType: sourceType || 'PLANET',
      sourceName: sourceName || sourceId,
      targetId,
      targetType: targetType || 'PLANET',
      targetName: targetName || targetId,
      name,
      distance: distance || 10,
      items,
      frequency,
      escortRequired
    });

    return res.json({
      success: true,
      route
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: message });
  }
});

/**
 * GET /api/gin7/trade/routes
 * Get character's trade routes
 */
router.get('/trade/routes', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const routes = await TradeRouteService.getCharacterRoutes(
      sessionId as string,
      user.characterId
    );

    return res.json({
      success: true,
      routes
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/trade/route/:routeId
 * Get specific trade route
 */
router.get('/trade/route/:routeId', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const route = await TradeRoute.findOne({
      sessionId: sessionId as string,
      routeId
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    return res.json({
      success: true,
      route
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/trade/route/:routeId/activate
 * Activate a trade route
 */
router.post('/trade/route/:routeId/activate', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const route = await TradeRouteService.activateRoute(
      sessionId,
      routeId
    );

    return res.json({
      success: true,
      route
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/gin7/trade/route/:routeId/pause
 * Pause a trade route
 */
router.post('/trade/route/:routeId/pause', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId, reason } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const route = await TradeRouteService.pauseRoute(
      sessionId,
      routeId,
      reason
    );

    return res.json({
      success: true,
      route
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/gin7/trade/route/:routeId
 * Delete a trade route
 */
router.delete('/trade/route/:routeId', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    await TradeRouteService.deleteRoute(
      sessionId as string,
      routeId
    );

    return res.json({
      success: true,
      message: 'Route deleted'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/gin7/trade/route/:routeId/execute
 * Manually execute a shipment
 */
router.post('/trade/route/:routeId/execute', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await TradeRouteService.executeShipment(
      sessionId,
      routeId,
      user.characterId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/trade/estimate
 * Estimate route profitability
 */
router.post('/trade/estimate', async (req: Request, res: Response) => {
  try {
    const { sessionId, sourceId, targetId, items, distance } = req.body;

    if (!sessionId || !sourceId || !targetId || !items) {
      return res.status(400).json({ 
        error: 'sessionId, sourceId, targetId, and items are required' 
      });
    }

    const estimate = await TradeRouteService.estimateProfitability(
      sessionId,
      sourceId,
      targetId,
      items,
      distance || 10
    );

    return res.json({
      success: true,
      estimate
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Phezzan Exchange APIs ====================

/**
 * GET /api/gin7/market/phezzan/exchange
 * Get Phezzan exchange rates
 */
router.get('/phezzan/exchange', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const exchangeRates = PhezzanService.getExchangeRates(sessionId as string);

    return res.json({
      success: true,
      exchangeRates,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/phezzan/exchange
 * Exchange currency
 */
router.post('/phezzan/exchange', async (req: Request, res: Response) => {
  try {
    const { sessionId, fromCurrency, toCurrency, amount } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PhezzanService.exchangeCurrency(
      sessionId,
      user.characterId,
      fromCurrency,
      toCurrency,
      amount
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/phezzan/summary
 * Get Phezzan market summary
 */
router.get('/phezzan/summary', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const summary = await PhezzanService.getPhezzanMarketSummary(sessionId as string);

    return res.json({
      success: true,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/phezzan/loan/apply
 * Apply for a loan
 */
router.post('/phezzan/loan/apply', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, amount, termMonths, collateral } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !amount || !termMonths) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PhezzanService.applyForLoan(
      sessionId,
      user.characterId,
      factionId,
      amount,
      termMonths,
      collateral
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/phezzan/loans
 * Get character's loans
 */
router.get('/phezzan/loans', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const loans = PhezzanService.getCharacterLoans(sessionId as string, user.characterId);

    return res.json({
      success: true,
      loans
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/phezzan/loan/:loanId/pay
 * Make loan payment
 */
router.post('/phezzan/loan/:loanId/pay', async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params;
    const { sessionId, amount } = req.body;

    if (!sessionId || !amount) {
      return res.status(400).json({ error: 'sessionId and amount are required' });
    }

    const result = await PhezzanService.makeLoanPayment(sessionId, loanId, amount);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/phezzan/invest
 * Make an investment
 */
router.post('/phezzan/invest', async (req: Request, res: Response) => {
  try {
    const { sessionId, type, amount, name } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !type || !amount) {
      return res.status(400).json({ error: 'sessionId, type, and amount are required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PhezzanService.invest(
      sessionId,
      user.characterId,
      type,
      amount,
      name
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/phezzan/investments
 * Get character's investments
 */
router.get('/phezzan/investments', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const investments = PhezzanService.getCharacterInvestments(
      sessionId as string,
      user.characterId
    );

    return res.json({
      success: true,
      investments
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/phezzan/investment/:investmentId/sell
 * Sell an investment
 */
router.post('/phezzan/investment/:investmentId/sell', async (req: Request, res: Response) => {
  try {
    const { investmentId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await PhezzanService.sellInvestment(sessionId, investmentId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Market Events APIs ====================

/**
 * GET /api/gin7/market/events
 * Get active market events
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { sessionId, locationId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const events = MarketEventService.getActiveEvents(
      sessionId as string,
      locationId as string | undefined
    );

    return res.json({
      success: true,
      events
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/events/templates
 * Get all event templates
 */
router.get('/events/templates', async (_req: Request, res: Response) => {
  try {
    const templates = MarketEventService.getAllEventTemplates();

    return res.json({
      success: true,
      templates
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Piracy APIs ====================

/**
 * GET /api/gin7/market/piracy/stats/:region
 * Get piracy statistics for a region
 */
router.get('/piracy/stats/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const stats = await PiracyService.getRegionalPiracyStats(
      sessionId as string,
      region
    );

    return res.json({
      success: true,
      region,
      stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/piracy/route/:routeId/risk
 * Get piracy risk for a trade route
 */
router.get('/piracy/route/:routeId/risk', async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const route = await TradeRoute.findOne({
      sessionId: sessionId as string,
      routeId
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const escort = await PiracyService.evaluateEscortAsync(
      sessionId as string,
      route.fleetId
    );

    return res.json({
      success: true,
      routeId,
      basePiracyRisk: route.piracyRisk,
      escort,
      effectiveRisk: route.piracyRisk * (1 - escort.effectiveReduction)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Black Market APIs ====================

/**
 * GET /api/gin7/market/black/:locationId
 * Get black market items at a location
 */
router.get('/black/:locationId', async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { sessionId, factionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const items = BlackMarketService.getAvailableItems(
      sessionId as string,
      locationId,
      factionId as string | undefined
    );

    return res.json({
      success: true,
      locationId,
      items
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/black/buy
 * Purchase from black market
 */
router.post('/black/buy', async (req: Request, res: Response) => {
  try {
    const { sessionId, locationId, itemId, quantity } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !locationId || !itemId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await BlackMarketService.purchaseItem(
      sessionId,
      user.characterId,
      locationId,
      itemId,
      quantity
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/black/smuggle/start
 * Start a smuggling operation
 */
router.post('/black/smuggle/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, sourceLocation, targetLocation, items } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !sourceLocation || !targetLocation || !items) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await BlackMarketService.startSmuggling(
      sessionId,
      user.characterId,
      sourceLocation,
      targetLocation,
      items
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/black/smuggle/:opId/complete
 * Complete a smuggling operation
 */
router.post('/black/smuggle/:opId/complete', async (req: Request, res: Response) => {
  try {
    const { opId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await BlackMarketService.completeSmuggling(sessionId, opId);

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/black/smuggle/operations
 * Get character's smuggling operations
 */
router.get('/black/smuggle/operations', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const operations = BlackMarketService.getCharacterOperations(
      sessionId as string,
      user.characterId
    );

    return res.json({
      success: true,
      operations
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/market/black/contact/establish
 * Establish a black market contact
 */
router.post('/black/contact/establish', async (req: Request, res: Response) => {
  try {
    const { sessionId, locationId, specialty } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !locationId || !specialty) {
      return res.status(400).json({ error: 'sessionId, locationId, and specialty are required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await BlackMarketService.establishContact(
      sessionId,
      user.characterId,
      locationId,
      specialty
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/black/contacts
 * Get character's black market contacts
 */
router.get('/black/contacts', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const contacts = BlackMarketService.getCharacterContacts(
      sessionId as string,
      user.characterId
    );

    return res.json({
      success: true,
      contacts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/market/black/contraband/types
 * Get contraband item types
 */
router.get('/black/contraband/types', async (_req: Request, res: Response) => {
  try {
    const templates = BlackMarketService.getContrabandTemplates();

    return res.json({
      success: true,
      contrabandTypes: templates
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

export default router;

