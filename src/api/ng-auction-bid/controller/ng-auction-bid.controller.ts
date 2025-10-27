import { Request, Response, NextFunction } from 'express';
import { NgAuctionBidService } from '../service/ng-auction-bid.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class NgAuctionBidController {
  constructor(private service: NgAuctionBidService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const bid = await this.service.getById(req.params.id);

      if (!bid) {
        throw new HttpException(404, 'Auction bid not found');
      }

      const response: ApiResponse<typeof bid> = { data: bid };
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

      const bids = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof bids[0]> = {
        data: bids,
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
      const bid = await this.service.create(req.body);
      const response: ApiResponse<typeof bid> = { data: bid };
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
      const bid = await this.service.update(req.params.id, req.body);

      if (!bid) {
        throw new HttpException(404, 'Auction bid not found');
      }

      const response: ApiResponse<typeof bid> = { data: bid };
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
        throw new HttpException(404, 'Auction bid not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
