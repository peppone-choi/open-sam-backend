import { Request, Response } from 'express';
import { GameConfigService } from '../service/game-config.service';

export class GameConfigController {
  constructor(private service: GameConfigService) {}

  /**
   * GET /admin/config
   * 현재 게임 설정 조회
   */
  async getConfig(req: Request, res: Response) {
    const config = await this.service.getCurrentConfig();
    
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    
    res.json({ config });
  }

  /**
   * PUT /admin/config/unit-advantage
   * 병종 상성 업데이트
   */
  async updateUnitAdvantage(req: Request, res: Response) {
    const { advantages } = req.body;
    const adminId = (req as any).admin.id;
    
    const config = await this.service.updateUnitAdvantage(advantages, adminId);
    
    res.json({ 
      message: 'Unit advantage updated successfully',
      config: config.unitAdvantage 
    });
  }

  /**
   * PUT /admin/config/units
   * 병종 정보 업데이트
   */
  async updateUnits(req: Request, res: Response) {
    const { units } = req.body;
    const adminId = (req as any).admin.id;
    
    const config = await this.service.updateUnitInfo(units, adminId);
    
    res.json({ 
      message: 'Units updated successfully',
      units: config.unitAdvantage.units 
    });
  }

  /**
   * PUT /admin/config/balance
   * 게임 밸런스 업데이트
   */
  async updateBalance(req: Request, res: Response) {
    const balance = req.body;
    const adminId = (req as any).admin.id;
    
    const config = await this.service.updateBalance(balance, adminId);
    
    res.json({ 
      message: 'Balance updated successfully',
      balance: config.balance 
    });
  }

  /**
   * PUT /admin/config/turn
   * 턴 설정 업데이트
   */
  async updateTurnConfig(req: Request, res: Response) {
    const turnConfig = req.body;
    const adminId = (req as any).admin.id;
    
    const config = await this.service.updateTurnConfig(turnConfig, adminId);
    
    res.json({ 
      message: 'Turn config updated successfully',
      turnConfig: config.turnConfig 
    });
  }

  /**
   * PUT /admin/config/exp
   * 경험치 설정 업데이트
   */
  async updateExpConfig(req: Request, res: Response) {
    const expConfig = req.body;
    const adminId = (req as any).admin.id;
    
    const config = await this.service.updateExpConfig(expConfig, adminId);
    
    res.json({ 
      message: 'Experience config updated successfully',
      expConfig: config.expConfig 
    });
  }
}
