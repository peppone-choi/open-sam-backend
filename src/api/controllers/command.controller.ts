import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CommandService } from '../../domain/command/command.service';

@injectable()
export class CommandController {
  constructor(private commandService: CommandService) {}

  async getByGeneral(req: Request, res: Response, next: NextFunction) {
    try {
      const { generalId } = req.query;
      
      // TODO: CommandService.findByGeneral(generalId) 호출
      // TODO: 실행 중인 커맨드 목록 반환
      
      res.json({ data: [] });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // TODO: CommandService.cancel(id)
      // TODO: 커맨드 상태를 CANCELLED로 변경
      
      res.json({ message: 'Command cancelled' });
    } catch (error) {
      next(error);
    }
  }
}
