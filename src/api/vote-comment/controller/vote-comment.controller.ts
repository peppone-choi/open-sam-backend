import { Request, Response, NextFunction } from 'express';
import { VoteCommentService } from '../service/vote-comment.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class VoteCommentController {
  constructor(private service: VoteCommentService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const comment = await this.service.getById(req.params.id);

      if (!comment) {
        throw new HttpException(404, 'Vote comment not found');
      }

      const response: ApiResponse<typeof comment> = { data: comment };
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

      const comments = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof comments[0]> = {
        data: comments,
        count,
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
      const comment = await this.service.create(req.body);
      const response: ApiResponse<typeof comment> = { data: comment };
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
      const comment = await this.service.update(req.params.id, req.body);

      if (!comment) {
        throw new HttpException(404, 'Vote comment not found');
      }

      const response: ApiResponse<typeof comment> = { data: comment };
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
      const result = await this.service.delete(req.params.id);

      if (!result) {
        throw new HttpException(404, 'Vote comment not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
