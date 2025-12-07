import { Router, Request, Response } from 'express';
import { BudgetService } from '../../services/gin7/BudgetService';
import { PublicOrderService } from '../../services/gin7/PublicOrderService';
import { PoliticsService } from '../../services/gin7/PoliticsService';
import { NationalTreasury } from '../../models/gin7/NationalTreasury';
import { PlanetSupport } from '../../models/gin7/PlanetSupport';
import { GovernmentStructure, GovernmentType } from '../../models/gin7/GovernmentStructure';
import { gin7AuthMiddleware } from '../../middleware/gin7-auth.middleware';

const router = Router();

// Apply authentication
router.use(gin7AuthMiddleware);

// ==================== Budget APIs ====================

/**
 * GET /api/gin7/politics/budget/:factionId
 * Get budget summary for a faction
 */
router.get('/budget/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const summary = await BudgetService.getBudgetSummary(
      sessionId as string,
      factionId
    );

    if (!summary) {
      return res.status(404).json({ error: 'Treasury not found' });
    }

    return res.json({
      success: true,
      factionId,
      ...summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/politics/budget/:factionId/treasury
 * Get full treasury data
 */
router.get('/budget/:factionId/treasury', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const treasury = await BudgetService.getTreasury(
      sessionId as string,
      factionId
    );

    if (!treasury) {
      return res.status(404).json({ error: 'Treasury not found' });
    }

    return res.json({
      success: true,
      treasury
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/politics/budget/allocate
 * Allocate budget to categories
 */
router.post('/budget/allocate', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, allocations } = req.body;

    if (!sessionId || !factionId || !allocations) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, and allocations are required' 
      });
    }

    const result = await BudgetService.allocateBudget(
      sessionId,
      factionId,
      allocations
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
 * POST /api/gin7/politics/budget/expense
 * Process an expense
 */
router.post('/budget/expense', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, category, amount, description, gameDay } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !category || !amount || !description || gameDay === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, category, amount, description, and gameDay are required' 
      });
    }

    const result = await BudgetService.processExpense(
      sessionId,
      factionId,
      {
        category,
        amount,
        description,
        authorizedBy: user?.characterId
      },
      gameDay
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
 * POST /api/gin7/politics/tax/rate
 * Set tax rate
 */
router.post('/tax/rate', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, taxType, rate } = req.body;

    if (!sessionId || !factionId || !taxType || rate === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, taxType, and rate are required' 
      });
    }

    const result = await BudgetService.setTaxRate(
      sessionId,
      factionId,
      taxType,
      rate
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
 * POST /api/gin7/politics/tax/emergency
 * Toggle emergency tax
 */
router.post('/tax/emergency', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, enabled } = req.body;

    if (!sessionId || !factionId || enabled === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, and enabled are required' 
      });
    }

    const result = await BudgetService.setEmergencyTax(sessionId, factionId, enabled);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Public Order APIs ====================

/**
 * GET /api/gin7/politics/support/:planetId
 * Get planet support data
 */
router.get('/support/:planetId', async (req: Request, res: Response) => {
  try {
    const { planetId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const support = await PublicOrderService.getPlanetSupport(
      sessionId as string,
      planetId
    );

    if (!support) {
      return res.status(404).json({ error: 'Planet support data not found' });
    }

    return res.json({
      success: true,
      support: {
        planetId: support.planetId,
        planetName: support.planetName,
        supportRate: support.supportRate,
        effectiveSupportRate: support.calculateEffectiveSupportRate(),
        securityLevel: support.securityLevel,
        effectiveSecurityLevel: support.calculateEffectiveSecurityLevel(),
        riotStatus: support.riotStatus,
        riotSeverity: support.riotSeverity,
        riotRisk: support.calculateRiotRisk(),
        productionPenalty: support.productionPenalty,
        taxComplianceRate: support.calculateTaxCompliance(),
        supportFactors: support.supportFactors,
        securityFactors: support.securityFactors
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/politics/support/faction/:factionId
 * Get faction support summary
 */
router.get('/support/faction/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const summary = await PublicOrderService.getFactionSupportSummary(
      sessionId as string,
      factionId
    );

    return res.json({
      success: true,
      factionId,
      ...summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/politics/support/risky/:factionId
 * Get risky planets
 */
router.get('/support/risky/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;
    const threshold = parseInt(req.query.threshold as string) || 50;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const riskyPlanets = await PublicOrderService.getRiskyPlanets(
      sessionId as string,
      factionId,
      threshold
    );

    return res.json({
      success: true,
      factionId,
      riskyPlanets
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/politics/support/military
 * Set military presence on a planet
 */
router.post('/support/military', async (req: Request, res: Response) => {
  try {
    const { sessionId, planetId, troopStrength } = req.body;

    if (!sessionId || !planetId || troopStrength === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, planetId, and troopStrength are required' 
      });
    }

    const result = await PublicOrderService.setMilitaryPresence(
      sessionId,
      planetId,
      troopStrength
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
 * POST /api/gin7/politics/riot/suppress/military
 * Suppress riot with military force
 */
router.post('/riot/suppress/military', async (req: Request, res: Response) => {
  try {
    const { sessionId, planetId, forceStrength } = req.body;

    if (!sessionId || !planetId || forceStrength === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, planetId, and forceStrength are required' 
      });
    }

    const result = await PublicOrderService.suppressRiotMilitary(
      sessionId,
      planetId,
      forceStrength
    );

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/politics/riot/suppress/negotiate
 * Suppress riot through negotiation
 */
router.post('/riot/suppress/negotiate', async (req: Request, res: Response) => {
  try {
    const { sessionId, planetId, concessionType } = req.body;

    if (!sessionId || !planetId || !concessionType) {
      return res.status(400).json({ 
        error: 'sessionId, planetId, and concessionType are required' 
      });
    }

    const result = await PublicOrderService.suppressRiotNegotiation(
      sessionId,
      planetId,
      concessionType
    );

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ==================== Government Structure APIs ====================

/**
 * GET /api/gin7/politics/government/:factionId
 * Get government structure
 */
router.get('/government/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const government = await PoliticsService.getGovernment(
      sessionId as string,
      factionId
    );

    if (!government) {
      return res.status(404).json({ error: 'Government structure not found' });
    }

    return res.json({
      success: true,
      government
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gin7/politics/government/:factionId/summary
 * Get political summary
 */
router.get('/government/:factionId/summary', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const summary = await PoliticsService.getPoliticalSummary(
      sessionId as string,
      factionId
    );

    if (!summary) {
      return res.status(404).json({ error: 'Government structure not found' });
    }

    return res.json({
      success: true,
      factionId,
      ...summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/politics/government/create
 * Create government structure
 */
router.post('/government/create', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, factionName, governmentType, governmentName } = req.body;

    if (!sessionId || !factionId || !factionName || !governmentType || !governmentName) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, factionName, governmentType, and governmentName are required' 
      });
    }

    const government = await PoliticsService.createGovernment(
      sessionId,
      factionId,
      factionName,
      governmentType as GovernmentType,
      governmentName
    );

    return res.json({
      success: true,
      government
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gin7/politics/appointment
 * Appoint someone to a position
 */
router.post('/appointment', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, positionId, characterId, characterName } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !positionId || !characterId || !characterName) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, positionId, characterId, and characterName are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.appointToPosition(
      sessionId,
      factionId,
      positionId,
      characterId,
      characterName,
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
 * DELETE /api/gin7/politics/appointment/:positionId
 * Remove someone from a position
 */
router.delete('/appointment/:positionId', async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;
    const { sessionId, factionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId are required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.removeFromPosition(
      sessionId as string,
      factionId as string,
      positionId,
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

// ==================== Election APIs ====================

/**
 * POST /api/gin7/politics/election/start
 * Start an election
 */
router.post('/election/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, electionType, title, description, registrationDays, votingDays } = req.body;

    if (!sessionId || !factionId || !electionType || !title) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, electionType, and title are required' 
      });
    }

    const result = await PoliticsService.startElection(
      sessionId,
      factionId,
      electionType,
      title,
      description,
      registrationDays,
      votingDays
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
 * POST /api/gin7/politics/election/register
 * Register as a candidate
 */
router.post('/election/register', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, electionId, platform } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string; characterName?: string } }).gin7User;

    if (!sessionId || !factionId || !electionId) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, and electionId are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.registerCandidate(
      sessionId,
      factionId,
      electionId,
      user.characterId,
      user.characterName || 'Unknown',
      platform
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
 * POST /api/gin7/politics/election/vote
 * Cast a vote in an election
 */
router.post('/election/vote', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, electionId, candidateId } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !electionId || !candidateId) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, electionId, and candidateId are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.castVote(
      sessionId,
      factionId,
      electionId,
      user.characterId,
      candidateId
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

// ==================== Impeachment APIs ====================

/**
 * POST /api/gin7/politics/impeachment/initiate
 * Initiate an impeachment
 */
router.post('/impeachment/initiate', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, targetId, targetName, targetPosition, charges, deadlineDays } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !targetId || !targetName || !targetPosition || !charges) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, targetId, targetName, targetPosition, and charges are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.initiateImpeachment(
      sessionId,
      factionId,
      targetId,
      targetName,
      targetPosition,
      charges,
      user.characterId,
      deadlineDays
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
 * POST /api/gin7/politics/impeachment/vote
 * Vote on an impeachment
 */
router.post('/impeachment/vote', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, impeachmentId, support } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId || !impeachmentId || support === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, impeachmentId, and support are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.voteOnImpeachment(
      sessionId,
      factionId,
      impeachmentId,
      user.characterId,
      support
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

// ==================== Decree APIs ====================

/**
 * POST /api/gin7/politics/decree/issue
 * Issue a decree
 */
router.post('/decree/issue', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, decreeType, title, content, effects, durationDays } = req.body;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string; characterName?: string } }).gin7User;

    if (!sessionId || !factionId || !decreeType || !title || !content || !effects) {
      return res.status(400).json({ 
        error: 'sessionId, factionId, decreeType, title, content, and effects are required' 
      });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.issueDecree(
      sessionId,
      factionId,
      user.characterId,
      user.characterName || 'Unknown',
      decreeType,
      title,
      content,
      effects,
      durationDays
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
 * GET /api/gin7/politics/decree/:factionId
 * Get active decrees
 */
router.get('/decree/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const decrees = await PoliticsService.getActiveDecrees(
      sessionId as string,
      factionId
    );

    return res.json({
      success: true,
      factionId,
      decrees
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/gin7/politics/decree/:decreeId
 * Revoke a decree
 */
router.delete('/decree/:decreeId', async (req: Request, res: Response) => {
  try {
    const { decreeId } = req.params;
    const { sessionId, factionId } = req.query;
    const user = (req as Request & { gin7User?: { userId: string; characterId?: string } }).gin7User;

    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId are required' });
    }

    if (!user?.characterId) {
      return res.status(401).json({ error: 'Character not selected' });
    }

    const result = await PoliticsService.revokeDecree(
      sessionId as string,
      factionId as string,
      decreeId,
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

export default router;

