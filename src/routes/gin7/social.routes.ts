/**
 * Social Interaction Routes
 * 사교, 인맥, 파벌 관련 API
 */

import { Router, Request, Response } from 'express';
import { SocialInteractionService } from '../../services/logh/SocialInteractionService';
import { Relationship } from '../../models/logh/Relationship.model';
import { Faction } from '../../models/logh/Faction.model';
import { LoghCommander } from '../../models/logh/Commander.model';

const router = Router();

// ============== RELATIONSHIP ROUTES ==============

/**
 * GET /api/gin7/social/relationship
 * Get relationship between two commanders
 */
router.get('/relationship', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const fromNo = parseInt(req.query.fromNo as string);
    const toNo = parseInt(req.query.toNo as string);

    if (!sessionId || isNaN(fromNo) || isNaN(toNo)) {
      return res.status(400).json({ error: 'sessionId, fromNo, toNo required' });
    }

    const relationship = await SocialInteractionService.getOrCreateRelationship(
      sessionId, fromNo, toNo
    );

    return res.json({ relationship });
  } catch (error) {
    console.error('Get relationship error:', error);
    return res.status(500).json({ error: 'Failed to get relationship' });
  }
});

/**
 * GET /api/gin7/social/relationships/:commanderNo
 * Get all relationships for a commander
 */
router.get('/relationships/:commanderNo', async (req: Request, res: Response) => {
  try {
    const { commanderNo } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const relationships = await Relationship.find({
      session_id: sessionId,
      fromCommanderNo: parseInt(commanderNo),
    }).sort({ friendship: -1 });

    return res.json({ relationships });
  } catch (error) {
    console.error('Get relationships error:', error);
    return res.status(500).json({ error: 'Failed to get relationships' });
  }
});

/**
 * GET /api/gin7/social/mutual-friendship
 * Get mutual (average) friendship between two commanders
 */
router.get('/mutual-friendship', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const commander1No = parseInt(req.query.commander1No as string);
    const commander2No = parseInt(req.query.commander2No as string);

    if (!sessionId || isNaN(commander1No) || isNaN(commander2No)) {
      return res.status(400).json({ error: 'sessionId, commander1No, commander2No required' });
    }

    const mutualFriendship = await SocialInteractionService.getMutualFriendship(
      sessionId, commander1No, commander2No
    );

    return res.json({ mutualFriendship });
  } catch (error) {
    console.error('Get mutual friendship error:', error);
    return res.status(500).json({ error: 'Failed to get mutual friendship' });
  }
});

// ============== FACTION ROUTES ==============

/**
 * POST /api/gin7/social/faction/create
 * Create a new faction
 */
router.post('/faction/create', async (req: Request, res: Response) => {
  try {
    const { sessionId, leaderNo, name } = req.body;

    if (!sessionId || !leaderNo || !name) {
      return res.status(400).json({ error: 'sessionId, leaderNo, name required' });
    }

    const faction = await SocialInteractionService.createFaction(sessionId, leaderNo, name);

    if (!faction) {
      return res.status(400).json({ error: 'Failed to create faction. Leader may already lead a faction.' });
    }

    return res.json({ success: true, faction });
  } catch (error) {
    console.error('Create faction error:', error);
    return res.status(500).json({ error: 'Failed to create faction' });
  }
});

/**
 * GET /api/gin7/social/faction/:factionId
 * Get faction details
 */
router.get('/faction/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const faction = await Faction.findOne({ session_id: sessionId, factionId, isActive: true });

    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    return res.json({ faction });
  } catch (error) {
    console.error('Get faction error:', error);
    return res.status(500).json({ error: 'Failed to get faction' });
  }
});

/**
 * GET /api/gin7/social/factions
 * List all active factions
 */
router.get('/factions', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const alignment = req.query.alignment as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const query: any = { session_id: sessionId, isActive: true };
    if (alignment) {
      query.alignment = alignment;
    }

    const factions = await Faction.find(query).sort({ 'stats.totalInfluence': -1 });

    return res.json({ factions });
  } catch (error) {
    console.error('List factions error:', error);
    return res.status(500).json({ error: 'Failed to list factions' });
  }
});

/**
 * POST /api/gin7/social/faction/:factionId/join
 * Join a faction
 */
router.post('/faction/:factionId/join', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId, commanderNo } = req.body;

    if (!sessionId || !commanderNo) {
      return res.status(400).json({ error: 'sessionId, commanderNo required' });
    }

    const success = await SocialInteractionService.joinFaction(sessionId, factionId, commanderNo);

    if (!success) {
      return res.status(400).json({ error: 'Failed to join faction. Already a member or faction not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Join faction error:', error);
    return res.status(500).json({ error: 'Failed to join faction' });
  }
});

/**
 * POST /api/gin7/social/faction/:factionId/leave
 * Leave a faction
 */
router.post('/faction/:factionId/leave', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId, commanderNo } = req.body;

    if (!sessionId || !commanderNo) {
      return res.status(400).json({ error: 'sessionId, commanderNo required' });
    }

    const success = await SocialInteractionService.leaveFaction(sessionId, factionId, commanderNo);

    if (!success) {
      return res.status(400).json({ error: 'Failed to leave faction. Leaders cannot leave (must dissolve).' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Leave faction error:', error);
    return res.status(500).json({ error: 'Failed to leave faction' });
  }
});

/**
 * POST /api/gin7/social/faction/:factionId/dissolve
 * Dissolve a faction (leader only)
 */
router.post('/faction/:factionId/dissolve', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId, commanderNo } = req.body;

    if (!sessionId || !commanderNo) {
      return res.status(400).json({ error: 'sessionId, commanderNo required' });
    }

    const success = await SocialInteractionService.dissolveFaction(sessionId, factionId, commanderNo);

    if (!success) {
      return res.status(400).json({ error: 'Failed to dissolve faction. Only leaders can dissolve.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Dissolve faction error:', error);
    return res.status(500).json({ error: 'Failed to dissolve faction' });
  }
});

/**
 * GET /api/gin7/social/commander/:commanderNo/faction
 * Get faction for a commander
 */
router.get('/commander/:commanderNo/faction', async (req: Request, res: Response) => {
  try {
    const { commanderNo } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const faction = await SocialInteractionService.getCommanderFaction(
      sessionId, parseInt(commanderNo)
    );

    return res.json({ faction });
  } catch (error) {
    console.error('Get commander faction error:', error);
    return res.status(500).json({ error: 'Failed to get commander faction' });
  }
});

// ============== PRIVATE FUNDS ROUTES ==============

/**
 * GET /api/gin7/social/funds/:commanderNo
 * Get personal funds for a commander
 */
router.get('/funds/:commanderNo', async (req: Request, res: Response) => {
  try {
    const { commanderNo } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const funds = await SocialInteractionService.getPersonalFunds(
      sessionId, parseInt(commanderNo)
    );

    return res.json({ personalFunds: funds });
  } catch (error) {
    console.error('Get funds error:', error);
    return res.status(500).json({ error: 'Failed to get funds' });
  }
});

/**
 * POST /api/gin7/social/funds/:commanderNo/modify
 * Modify personal funds (admin/debug)
 */
router.post('/funds/:commanderNo/modify', async (req: Request, res: Response) => {
  try {
    const { commanderNo } = req.params;
    const { sessionId, change } = req.body;

    if (!sessionId || change === undefined) {
      return res.status(400).json({ error: 'sessionId, change required' });
    }

    const newFunds = await SocialInteractionService.modifyPersonalFunds(
      sessionId, parseInt(commanderNo), change
    );

    return res.json({ success: true, newFunds });
  } catch (error) {
    console.error('Modify funds error:', error);
    return res.status(500).json({ error: 'Failed to modify funds' });
  }
});

// ============== SOCIAL INTERACTION PREVIEW ROUTES ==============

/**
 * GET /api/gin7/social/candidates/:commanderNo
 * Get social interaction candidates (people nearby, allies, etc.)
 */
router.get('/candidates/:commanderNo', async (req: Request, res: Response) => {
  try {
    const { commanderNo } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const commander = await LoghCommander.findOne({ 
      session_id: sessionId, 
      no: parseInt(commanderNo) 
    });

    if (!commander) {
      return res.status(404).json({ error: 'Commander not found' });
    }

    // 같은 진영의 다른 커맨더들 조회
    const candidates = await LoghCommander.find({
      session_id: sessionId,
      faction: commander.faction,
      no: { $ne: commander.no },
      isActive: true,
      status: 'active',
    }).select('no name rank stats.politics stats.leadership fame').limit(50);

    // 각 후보자와의 현재 우호도 조회
    const candidatesWithRelationship = await Promise.all(
      candidates.map(async (c) => {
        const relationship = await Relationship.findOne({
          session_id: sessionId,
          fromCommanderNo: commander.no,
          toCommanderNo: c.no,
        });

        return {
          no: c.no,
          name: c.name,
          rank: c.rank,
          politics: c.stats?.politics || 50,
          leadership: c.stats?.leadership || 50,
          fame: c.fame || 0,
          friendship: relationship?.friendship || 50,
          trust: relationship?.trust || 50,
        };
      })
    );

    // 우호도 순으로 정렬
    candidatesWithRelationship.sort((a, b) => b.friendship - a.friendship);

    return res.json({ candidates: candidatesWithRelationship });
  } catch (error) {
    console.error('Get candidates error:', error);
    return res.status(500).json({ error: 'Failed to get candidates' });
  }
});

export default router;














