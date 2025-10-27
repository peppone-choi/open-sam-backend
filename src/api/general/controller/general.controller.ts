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

  /**
   * GET /api/generals/:id
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // TODO: ID 조회
      const general = await this.service.getById(req.params.id);

      if (!general) {
        throw new HttpException(404, 'General not found');
      }

      // TODO: 응답 반환
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
      // TODO: Implement create
      res.status(201).json({ message: 'Create not implemented' });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement update
      res.json({ message: 'Update not implemented' });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement delete
      res.json({ message: 'Delete not implemented' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/generals (legacy)
   */
  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // TODO: 쿼리 파라미터 파싱
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      // TODO: 조회
      const generals = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      // TODO: 응답 반환
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

  /**
   * POST /api/generals/:id/train
   */
  train = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // TODO: 요청 body 파싱 (DTO 검증 필요)
      const { statType, amount } = req.body;

      // TODO: 명령 발행
      await this.service.trainGeneral(req.params.id, statType, amount);

      // TODO: 응답 (명령 접수됨)
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
