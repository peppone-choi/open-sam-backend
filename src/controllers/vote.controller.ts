import { Request, Response } from 'express';
import { AddCommentService } from '../services/vote/AddComment.service';
import { GetVoteDetailService } from '../services/vote/GetVoteDetail.service';
import { GetVoteListService } from '../services/vote/GetVoteList.service';
import { OpenVoteService } from '../services/vote/OpenVote.service';
import { VoteService } from '../services/vote/Vote.service';

/**
 * VoteController
 * vote 그룹의 모든 API 처리
 */
export class VoteController {

  /**
   * AddComment
   */
  static async addComment(req: Request, res: Response) {
    try {
      const result = await AddCommentService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetVoteDetail
   */
  static async getVoteDetail(req: Request, res: Response) {
    try {
      const result = await GetVoteDetailService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetVoteList
   */
  static async getVoteList(req: Request, res: Response) {
    try {
      const result = await GetVoteListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * OpenVote
   */
  static async openVote(req: Request, res: Response) {
    try {
      const result = await OpenVoteService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Vote
   */
  static async vote(req: Request, res: Response) {
    try {
      const result = await VoteService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
