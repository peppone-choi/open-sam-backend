import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../service/message.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class MessageController {
  constructor(private service: MessageService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const message = await this.service.getById(req.params.id);

      if (!message) {
        throw new HttpException(404, 'Message not found');
      }

      const response: ApiResponse<typeof message> = { data: message };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const messages = await this.service.getAll(limit, skip);

      const response: Paginated<typeof messages[0]> = {
        data: messages,
        count: messages.length,
        limit,
        skip,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const message = await this.service.create(req.body);

      const response: ApiResponse<typeof message> = { data: message };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const message = await this.service.update(req.params.id, req.body);

      if (!message) {
        throw new HttpException(404, 'Message not found');
      }

      const response: ApiResponse<typeof message> = { data: message };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const success = await this.service.delete(req.params.id);

      if (!success) {
        throw new HttpException(404, 'Message not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
