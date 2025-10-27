import { Request, Response, NextFunction } from 'express';
import { GeneralTurnService } from '../service/general-turn.service';

export class GeneralTurnController {
  constructor(private service: GeneralTurnService) {}

  // TODO: 구현
  getByGeneralId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, generalId } = req.params;
      const turns = await this.service.getByGeneralId(sessionId, generalId);
      res.json({ data: turns });
    } catch (error) {
      next(error);
    }
  };
}
