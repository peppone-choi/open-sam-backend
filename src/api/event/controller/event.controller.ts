import { Request, Response, NextFunction } from 'express';
import { EventService } from '../service/event.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class EventController {
  constructor(private service: EventService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const events = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof events[0]> = {
        data: events,
        count,
        limit,
        skip,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const event = await this.service.getById(req.params.id);

      if (!event) {
        throw new HttpException(404, 'Event not found');
      }

      const response: ApiResponse<typeof event> = { data: event };
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
      const event = await this.service.create(req.body);
      const response: ApiResponse<typeof event> = { data: event };
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
      const event = await this.service.update(req.params.id, req.body);

      if (!event) {
        throw new HttpException(404, 'Event not found');
      }

      const response: ApiResponse<typeof event> = { data: event };
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
        throw new HttpException(404, 'Event not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
