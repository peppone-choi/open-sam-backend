import { Router, Request, Response } from 'express';
import { mailService } from '../../services/gin7/MailService';
import IntelService from '../../services/gin7/IntelService';
import ConspiracyService from '../../services/gin7/ConspiracyService';

const router = Router();

// ============== MAIL ROUTES ==============

/**
 * GET /api/gin7/intel/mail/:boxId
 * Get messages in a mailbox
 */
router.get('/mail/:boxId', async (req: Request, res: Response) => {
  try {
    const { boxId } = req.params;
    const sessionId = req.query.sessionId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const result = await mailService.getInbox({
      sessionId,
      mailBoxId: boxId,
      page,
      limit,
      unreadOnly
    });

    return res.json(result);
  } catch (error) {
    console.error('Get mail error:', error);
    return res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * POST /api/gin7/intel/mail/send
 * Send a mail message
 */
router.post('/mail/send', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      senderId,
      senderName,
      senderRoleId,
      recipientId,
      recipientRoleId,
      subject,
      body,
      messageType,
      attachments,
      replyToId
    } = req.body;

    if (!sessionId || !senderId || !senderName || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!recipientId && !recipientRoleId) {
      return res.status(400).json({ error: 'Either recipientId or recipientRoleId required' });
    }

    const result = await mailService.sendMail({
      sessionId,
      senderId,
      senderName,
      senderRoleId,
      recipientId,
      recipientRoleId,
      subject,
      body,
      messageType,
      attachments,
      replyToId
    });

    return res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('Send mail error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

/**
 * POST /api/gin7/intel/mail/:messageId/read
 * Mark message as read
 */
router.post('/mail/:messageId/read', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const success = await mailService.markAsRead(sessionId, messageId);
    return res.json({ success });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * DELETE /api/gin7/intel/mail/:messageId
 * Delete a message
 */
router.delete('/mail/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const sessionId = req.query.sessionId as string;
    const mailBoxId = req.query.mailBoxId as string;

    if (!sessionId || !mailBoxId) {
      return res.status(400).json({ error: 'sessionId and mailBoxId required' });
    }

    const result = await mailService.deleteMail(sessionId, messageId, mailBoxId);
    return res.json({ success: result.success });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * GET /api/gin7/intel/mailbox
 * Get or create mailbox for character
 */
router.get('/mailbox', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const characterId = req.query.characterId as string;
    const roleId = req.query.roleId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    let mailBox;
    if (characterId) {
      mailBox = await mailService.getOrCreateMailBox(sessionId, characterId);
    } else if (roleId) {
      mailBox = await mailService.getOrCreateRoleMailBox(sessionId, roleId);
    } else {
      return res.status(400).json({ error: 'characterId or roleId required' });
    }

    return res.json({ mailBox });
  } catch (error) {
    console.error('Get mailbox error:', error);
    return res.status(500).json({ error: 'Failed to get mailbox' });
  }
});

// ============== SPY/INTEL ROUTES ==============

/**
 * POST /api/gin7/intel/spy/deploy
 * Deploy a spy to a target
 */
router.post('/spy/deploy', async (req: Request, res: Response) => {
  try {
    const { sessionId, ownerId, ownerFactionId, targetType, targetId, skills } = req.body;

    if (!sessionId || !ownerId || !targetType || !targetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const spy = await IntelService.deploySpy({
      sessionId,
      ownerId,
      ownerFactionId,
      targetType,
      targetId,
      skills
    });

    return res.json({ success: true, spy });
  } catch (error: any) {
    console.error('Deploy spy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to deploy spy' });
  }
});

/**
 * GET /api/gin7/intel/spy/list
 * List all spies for an owner
 */
router.get('/spy/list', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const ownerId = req.query.ownerId as string;

    if (!sessionId || !ownerId) {
      return res.status(400).json({ error: 'sessionId and ownerId required' });
    }

    const spies = await IntelService.listSpies(sessionId, ownerId);
    return res.json({ spies });
  } catch (error) {
    console.error('List spies error:', error);
    return res.status(500).json({ error: 'Failed to list spies' });
  }
});

/**
 * POST /api/gin7/intel/spy/:spyId/extract
 * Extract (recall) a spy
 */
router.post('/spy/:spyId/extract', async (req: Request, res: Response) => {
  try {
    const { spyId } = req.params;
    const { sessionId, ownerId } = req.body;

    if (!sessionId || !ownerId) {
      return res.status(400).json({ error: 'sessionId and ownerId required' });
    }

    const success = await IntelService.extractSpy(sessionId, spyId, ownerId);
    return res.json({ success });
  } catch (error) {
    console.error('Extract spy error:', error);
    return res.status(500).json({ error: 'Failed to extract spy' });
  }
});

/**
 * GET /api/gin7/intel/report/:targetId
 * Get intel report for a target
 */
router.get('/report/:targetId', async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const sessionId = req.query.sessionId as string;
    const ownerId = req.query.ownerId as string;

    if (!sessionId || !ownerId) {
      return res.status(400).json({ error: 'sessionId and ownerId required' });
    }

    const report = await IntelService.getLatestIntelReport(sessionId, ownerId, targetId);
    return res.json({ report });
  } catch (error) {
    console.error('Get intel report error:', error);
    return res.status(500).json({ error: 'Failed to get intel report' });
  }
});

/**
 * GET /api/gin7/intel/reports
 * Get all intel reports for an owner
 */
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const ownerId = req.query.ownerId as string;

    if (!sessionId || !ownerId) {
      return res.status(400).json({ error: 'sessionId and ownerId required' });
    }

    const reports = await IntelService.getAllIntelReports(sessionId, ownerId);
    return res.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ error: 'Failed to get reports' });
  }
});

/**
 * GET /api/gin7/intel/fow
 * Check FOW visibility for a location
 */
router.get('/fow', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const ownerId = req.query.ownerId as string;
    const x = parseFloat(req.query.x as string);
    const y = parseFloat(req.query.y as string);

    if (!sessionId || !ownerId || isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'sessionId, ownerId, x, y required' });
    }

    const result = await IntelService.checkFOWVisibility(sessionId, ownerId, x, y);
    return res.json(result);
  } catch (error) {
    console.error('Check FOW error:', error);
    return res.status(500).json({ error: 'Failed to check FOW' });
  }
});

// ============== CONSPIRACY ROUTES ==============

/**
 * POST /api/gin7/intel/conspiracy/start
 * Start a new conspiracy
 */
router.post('/conspiracy/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, leaderId, leaderName, targetFactionId, targetLeaderId } = req.body;

    if (!sessionId || !leaderId || !leaderName || !targetFactionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const conspiracy = await ConspiracyService.startConspiracy({
      sessionId,
      leaderId,
      leaderName,
      targetFactionId,
      targetLeaderId
    });

    return res.json({ success: true, conspiracy });
  } catch (error: any) {
    console.error('Start conspiracy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start conspiracy' });
  }
});

/**
 * POST /api/gin7/intel/conspiracy/:conspiracyId/recruit
 * Recruit a participant
 */
router.post('/conspiracy/:conspiracyId/recruit', async (req: Request, res: Response) => {
  try {
    const { conspiracyId } = req.params;
    const { sessionId, recruiterId, targetId } = req.body;

    if (!sessionId || !recruiterId || !targetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await ConspiracyService.recruitParticipant(
      sessionId,
      conspiracyId,
      recruiterId,
      targetId
    );

    return res.json(result);
  } catch (error) {
    console.error('Recruit error:', error);
    return res.status(500).json({ error: 'Failed to recruit' });
  }
});

/**
 * POST /api/gin7/intel/conspiracy/:conspiracyId/contribute
 * Contribute resources to conspiracy
 */
router.post('/conspiracy/:conspiracyId/contribute', async (req: Request, res: Response) => {
  try {
    const { conspiracyId } = req.params;
    const { sessionId, characterId, gold, military } = req.body;

    if (!sessionId || !characterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await ConspiracyService.contributeResources(
      sessionId,
      conspiracyId,
      characterId,
      gold || 0,
      military || 0
    );

    return res.json(result);
  } catch (error) {
    console.error('Contribute error:', error);
    return res.status(500).json({ error: 'Failed to contribute' });
  }
});

/**
 * POST /api/gin7/intel/conspiracy/:conspiracyId/uprising
 * Launch the uprising
 */
router.post('/conspiracy/:conspiracyId/uprising', async (req: Request, res: Response) => {
  try {
    const { conspiracyId } = req.params;
    const { sessionId, leaderId } = req.body;

    if (!sessionId || !leaderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await ConspiracyService.launchUprising(sessionId, conspiracyId, leaderId);
    return res.json(result);
  } catch (error) {
    console.error('Uprising error:', error);
    return res.status(500).json({ error: 'Failed to launch uprising' });
  }
});

/**
 * GET /api/gin7/intel/conspiracy/:conspiracyId
 * Get conspiracy details
 */
router.get('/conspiracy/:conspiracyId', async (req: Request, res: Response) => {
  try {
    const { conspiracyId } = req.params;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const conspiracy = await ConspiracyService.getConspiracy(sessionId, conspiracyId);
    return res.json({ conspiracy });
  } catch (error) {
    console.error('Get conspiracy error:', error);
    return res.status(500).json({ error: 'Failed to get conspiracy' });
  }
});

/**
 * POST /api/gin7/intel/conspiracy/:conspiracyId/leave
 * Leave a conspiracy
 */
router.post('/conspiracy/:conspiracyId/leave', async (req: Request, res: Response) => {
  try {
    const { conspiracyId } = req.params;
    const { sessionId, characterId } = req.body;

    if (!sessionId || !characterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const success = await ConspiracyService.leaveConspiracy(sessionId, conspiracyId, characterId);
    return res.json({ success });
  } catch (error: any) {
    console.error('Leave conspiracy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to leave' });
  }
});

/**
 * GET /api/gin7/intel/conspiracy/active
 * Get active conspiracy for a character
 */
router.get('/conspiracy/active', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const characterId = req.query.characterId as string;

    if (!sessionId || !characterId) {
      return res.status(400).json({ error: 'sessionId and characterId required' });
    }

    const conspiracy = await ConspiracyService.getActiveConspiracy(sessionId, characterId);
    return res.json({ conspiracy });
  } catch (error) {
    console.error('Get active conspiracy error:', error);
    return res.status(500).json({ error: 'Failed to get active conspiracy' });
  }
});

export default router;

