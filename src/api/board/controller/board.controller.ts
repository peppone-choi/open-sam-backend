import { Request, Response, NextFunction } from 'express';
import { BoardService } from '../service/board.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class BoardController {
  constructor(private service: BoardService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const board = await this.service.getById(req.params.id);

      if (!board) {
        throw new HttpException(404, 'Board not found');
      }

      const response: ApiResponse<typeof board> = { data: board };
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

      const boards = await this.service.list(limit, skip);

      const response: Paginated<typeof boards[0]> = {
        data: boards,
        count: boards.length,
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
      const board = await this.service.create(req.body);

      const response: ApiResponse<typeof board> = { data: board };
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
      const board = await this.service.update(req.params.id, req.body);

      if (!board) {
        throw new HttpException(404, 'Board not found');
      }

      const response: ApiResponse<typeof board> = { data: board };
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
      const success = await this.service.remove(req.params.id);

      if (!success) {
        throw new HttpException(404, 'Board not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
