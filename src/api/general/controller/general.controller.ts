import { Request, Response, NextFunction } from 'express';
import { GeneralService } from '../service/general.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

/**
 * General Controller (요청/응답 처리)
 * 비즈니스 로직 없음, Service 호출만
 */
export class GeneralController {
  constructor(private service: GeneralService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const general = await this.service.getById(req.params.id);

      if (!general) {
        throw new HttpException(404, 'General not found');
      }

      const response: ApiResponse<typeof general> = { data: general };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/generals
   */
  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const generals = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof generals[0]> = {
        data: generals,
        count,
        limit,
        skip,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'General creation is handled by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'General updates are handled by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'General deletion is handled by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const generals = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof generals[0]> = {
        data: generals,
        count,
        limit,
        skip,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  train = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { statType, amount } = req.body;

      await this.service.trainGeneral(req.params.id, statType, amount);

      res.json({
        message: 'Training command submitted',
        generalId: req.params.id,
        statType,
        amount,
      });
    } catch (error) {
      next(error);
    }
  };
}
