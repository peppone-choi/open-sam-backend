import { GameConfigModel } from '../model/game-config.model';
import { IGameConfig, UnitInfo } from '../@types/admin.types';

/**
 * 게임 설정 관리 서비스
 */
export class GameConfigService {
  /**
   * 현재 게임 설정 조회
   */
  async getCurrentConfig(): Promise<IGameConfig | null> {
    const config = await GameConfigModel.findOne().sort({ updatedAt: -1 }).exec();
    return config ? (config.toObject() as IGameConfig) : null;
  }

  /**
   * 병종 상성 업데이트
   */
  async updateUnitAdvantage(
    advantages: Record<number, number[]>,
    adminId: string
  ): Promise<IGameConfig> {
    let config = await GameConfigModel.findOne().exec();
    
    if (!config) {
      config = await this.createDefaultConfig(adminId);
    }
    
    config.unitAdvantage.advantages = advantages as any;
    config.updatedBy = adminId;
    await config.save();
    
    return config.toObject() as IGameConfig;
  }

  /**
   * 병종 정보 업데이트
   */
  async updateUnitInfo(units: UnitInfo[], adminId: string): Promise<IGameConfig> {
    let config = await GameConfigModel.findOne().exec();
    
    if (!config) {
      config = await this.createDefaultConfig(adminId);
    }
    
    config.unitAdvantage.units = units as any;
    config.updatedBy = adminId;
    await config.save();
    
    return config.toObject() as IGameConfig;
  }

  /**
   * 게임 밸런스 업데이트
   */
  async updateBalance(
    balance: Partial<IGameConfig['balance']>,
    adminId: string
  ): Promise<IGameConfig> {
    let config = await GameConfigModel.findOne().exec();
    
    if (!config) {
      config = await this.createDefaultConfig(adminId);
    }
    
    config.balance = { ...config.balance, ...balance } as any;
    config.updatedBy = adminId;
    await config.save();
    
    return config.toObject() as IGameConfig;
  }

  /**
   * 턴 설정 업데이트
   */
  async updateTurnConfig(
    turnConfig: Partial<IGameConfig['turnConfig']>,
    adminId: string
  ): Promise<IGameConfig> {
    let config = await GameConfigModel.findOne().exec();
    
    if (!config) {
      config = await this.createDefaultConfig(adminId);
    }
    
    config.turnConfig = { ...config.turnConfig, ...turnConfig } as any;
    config.updatedBy = adminId;
    await config.save();
    
    return config.toObject() as IGameConfig;
  }

  /**
   * 경험치 설정 업데이트
   */
  async updateExpConfig(
    expConfig: Partial<IGameConfig['expConfig']>,
    adminId: string
  ): Promise<IGameConfig> {
    let config = await GameConfigModel.findOne().exec();
    
    if (!config) {
      config = await this.createDefaultConfig(adminId);
    }
    
    config.expConfig = { ...config.expConfig, ...expConfig } as any;
    config.updatedBy = adminId;
    await config.save();
    
    return config.toObject() as IGameConfig;
  }

  /**
   * 기본 설정 생성
   */
  private async createDefaultConfig(adminId: string) {
    const defaultConfig = new GameConfigModel({
      unitAdvantage: {
        advantages: {
          // 보병(1100) > 궁병(1200)
          1100: [1200],
          // 궁병(1200) > 기병(1300)
          1200: [1300],
          // 기병(1300) > 보병(1100)
          1300: [1100],
        },
        advantageMultiplier: 1.2,
        disadvantageMultiplier: 0.8,
        units: [
          {
            id: 1100,
            name: '보병',
            type: 'INFANTRY',
            description: '기본 보병. 궁병에게 강하고 기병에게 약함',
            baseAttack: 100,
            baseDefense: 120,
            baseMobility: 80,
            recruitCost: 50,
            hiringCost: 100,
            maintenanceCost: 5,
          },
          {
            id: 1200,
            name: '궁병',
            type: 'ARCHER',
            description: '원거리 궁병. 기병에게 강하고 보병에게 약함',
            baseAttack: 110,
            baseDefense: 80,
            baseMobility: 90,
            recruitCost: 60,
            hiringCost: 120,
            maintenanceCost: 6,
          },
          {
            id: 1300,
            name: '기병',
            type: 'CAVALRY',
            description: '기동력 높은 기병. 보병에게 강하고 궁병에게 약함',
            baseAttack: 120,
            baseDefense: 90,
            baseMobility: 130,
            recruitCost: 80,
            hiringCost: 160,
            maintenanceCost: 8,
          },
        ],
      },
      balance: {
        domestic: {
          agriculture: 1.0,
          commerce: 1.0,
          technology: 1.0,
          defense: 1.0,
          wall: 1.0,
          security: 1.0,
          settlement: 1.0,
          governance: 1.0,
        },
        military: {
          trainEfficiency: 1.0,
          moraleEfficiency: 1.0,
          recruitmentRate: 1.0,
          hiringRate: 1.0,
        },
        production: {
          goldPerPopulation: 10,
          ricePerAgriculture: 100,
          taxRate: 0.1,
        },
        combat: {
          baseDamage: 100,
          criticalRate: 0.05,
          criticalMultiplier: 1.5,
          retreatThreshold: 0.3,
        },
      },
      turnConfig: {
        turnDuration: 60,
        maxTurnsPerDay: 1440,
        pcp: { max: 100, recovery: 1 },
        mcp: { max: 50, recovery: 1 },
      },
      expConfig: {
        levelUpExp: Array.from({ length: 100 }, (_, i) => (i + 1) * 100),
        leadership: { domestic: 10, military: 10 },
        strength: { combat: 10, training: 5 },
        intel: { research: 10, stratagem: 5 },
      },
      version: '1.0.0',
      updatedBy: adminId,
    });
    
    return await defaultConfig.save();
  }
}
