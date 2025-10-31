import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CommandController } from '../controllers/command.controller';

const router = Router();

// GetReservedCommand
router.get('/get-reserved-command', authenticate, CommandController.getReservedCommand);

// PushCommand
router.post('/push-command', authenticate, CommandController.pushCommand);

// RepeatCommand
router.post('/repeat-command', authenticate, CommandController.repeatCommand);

// ReserveBulkCommand
router.post('/reserve-bulk-command', authenticate, CommandController.reserveBulkCommand);

// ReserveCommand
router.post('/reserve-command', authenticate, CommandController.reserveCommand);

export default router;
