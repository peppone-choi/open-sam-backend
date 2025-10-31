import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { AddCommentService } from '../services/vote/AddComment.service';
import { GetVoteDetailService } from '../services/vote/GetVoteDetail.service';
import { GetVoteListService } from '../services/vote/GetVoteList.service';
import { NewVoteService } from '../services/vote/NewVote.service';
import { VoteService } from '../services/vote/Vote.service';

const router = Router();


// AddComment
router.post('/add-comment', authenticate, async (req, res) => {
  try {
    const result = await AddCommentService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetVoteDetail
router.get('/get-vote-detail', async (req, res) => {
  try {
    const result = await GetVoteDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetVoteList
router.get('/get-vote-list', async (req, res) => {
  try {
    const result = await GetVoteListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// NewVote
router.post('/new-vote', authenticate, async (req, res) => {
  try {
    const result = await NewVoteService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// Vote
router.post('/vote', authenticate, async (req, res) => {
  try {
    const result = await VoteService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
