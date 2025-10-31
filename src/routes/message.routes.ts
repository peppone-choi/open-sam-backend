import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { DecideMessageResponseService } from '../services/message/DecideMessageResponse.service';
import { DeleteMessageService } from '../services/message/DeleteMessage.service';
import { GetContactListService } from '../services/message/GetContactList.service';
import { GetOldMessageService } from '../services/message/GetOldMessage.service';
import { GetRecentMessageService } from '../services/message/GetRecentMessage.service';
import { ReadLatestMessageService } from '../services/message/ReadLatestMessage.service';
import { SendMessageService } from '../services/message/SendMessage.service';

const router = Router();


// DecideMessageResponse
router.post('/decide-message-response', authenticate, async (req, res) => {
  try {
    const result = await DecideMessageResponseService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// DeleteMessage
router.post('/delete-message', authenticate, async (req, res) => {
  try {
    const result = await DeleteMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetContactList
router.get('/get-contact-list', authenticate, async (req, res) => {
  try {
    const result = await GetContactListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetOldMessage
router.get('/get-old-message', authenticate, async (req, res) => {
  try {
    const result = await GetOldMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetRecentMessage
router.get('/get-recent-message', authenticate, async (req, res) => {
  try {
    const result = await GetRecentMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ReadLatestMessage
router.post('/read-latest-message', authenticate, async (req, res) => {
  try {
    const result = await ReadLatestMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SendMessage
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const result = await SendMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
