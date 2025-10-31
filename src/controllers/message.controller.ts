import { Request, Response } from 'express';
import { DecideMessageResponseService } from '../services/message/DecideMessageResponse.service';
import { DeleteMessageService } from '../services/message/DeleteMessage.service';
import { GetContactListService } from '../services/message/GetContactList.service';
import { GetMessagePreviewService } from '../services/message/GetMessagePreview.service';
import { GetMessagesService } from '../services/message/GetMessages.service';
import { SendMessageService } from '../services/message/SendMessage.service';
import { SetRecentMessageTypeService } from '../services/message/SetRecentMessageType.service';

/**
 * MessageController
 * message 그룹의 모든 API 처리
 */
export class MessageController {

  /**
   * DecideMessageResponse
   */
  static async decideMessageResponse(req: Request, res: Response) {
    try {
      const result = await DecideMessageResponseService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * DeleteMessage
   */
  static async deleteMessage(req: Request, res: Response) {
    try {
      const result = await DeleteMessageService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetContactList
   */
  static async getContactList(req: Request, res: Response) {
    try {
      const result = await GetContactListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetMessagePreview
   */
  static async getMessagePreview(req: Request, res: Response) {
    try {
      const result = await GetMessagePreviewService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetMessages
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const result = await GetMessagesService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SendMessage
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      const result = await SendMessageService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SetRecentMessageType
   */
  static async setRecentMessageType(req: Request, res: Response) {
    try {
      const result = await SetRecentMessageTypeService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
