import { DomesticService } from '../../../../common/services/domestic.service';
import { CostService, Cost } from '../../../../common/services/cost.service';
import { ExperienceService } from '../../../../common/services/experience.service';
import { ValidatorService } from '../../../../common/services/validator.service';
import { GameBalance } from '../../../../common/constants/game-balance';

export interface CommandContext {
  commandId: string;
  generalId: string;
  type: string;
  payload: any;
  turn: number;
  rng: any;
  generalRepo: any;
  cityRepo: any;
  nationRepo: any;
}

export interface CommandResult {
  success: boolean;
  message: string;
  changes?: any;
}

export interface CommandHandler {
  handle(context: CommandContext): Promise<CommandResult>;
}

/**
 * 내정 커맨드 설정
 */
interface DomesticConfig {
  cityKey: string;
  statType: 'leadership' | 'strength' | 'intel';
  debuff: number;
  cost: Cost;
  maxKey?: string;
  isNationStat?: boolean;
}

/**
 * 내정 커맨드 핸들러
 * 
 * 8개 내정 커맨드를 처리:
 * - DEVELOP_AGRICULTURE (농지개간): agri, intel, debuff 0.5
 * - DEVELOP_COMMERCE (상업투자): comm, intel, debuff 0.5
 * - RESEARCH_TECH (기술연구): tech(nation), intel, debuff 1.0
 * - STRENGTHEN_DEFENSE (수비강화): def, strength, debuff 0.5
 * - REPAIR_WALL (성벽보수): wall, strength, debuff 0.25
 * - STRENGTHEN_SECURITY (치안강화): secu, strength, debuff 1.0
 * - ENCOURAGE_SETTLEMENT (정착장려): pop, leadership, debuff 1.0
 * - IMPROVE_TRUST (주민선정): trust, leadership, debuff 1.0
 */
export class DomesticHandler implements CommandHandler {
  private static readonly CONFIG_MAP: Record<string, DomesticConfig> = {
    DEVELOP_AGRICULTURE: {
      cityKey: 'agri',
      statType: 'intel',
      debuff: 0.5,
      cost: { gold: GameBalance.develCost, rice: 0 },
      maxKey: 'agri_max',
    },
    DEVELOP_COMMERCE: {
      cityKey: 'comm',
      statType: 'intel',
      debuff: 0.5,
      cost: { gold: GameBalance.develCost, rice: 0 },
      maxKey: 'comm_max',
    },
    RESEARCH_TECH: {
      cityKey: 'tech',
      statType: 'intel',
      debuff: 1.0,
      cost: { gold: GameBalance.develCost + 5, rice: 0 },
      isNationStat: true,
    },
    STRENGTHEN_DEFENSE: {
      cityKey: 'def',
      statType: 'strength',
      debuff: 0.5,
      cost: { gold: GameBalance.develCost - 5, rice: 0 },
      maxKey: 'def_max',
    },
    REPAIR_WALL: {
      cityKey: 'wall',
      statType: 'strength',
      debuff: 0.25,
      cost: { gold: GameBalance.develCost - 5, rice: 0 },
      maxKey: 'wall_max',
    },
    STRENGTHEN_SECURITY: {
      cityKey: 'secu',
      statType: 'strength',
      debuff: 1.0,
      cost: { gold: GameBalance.develCost, rice: 0 },
      maxKey: 'secu_max',
    },
    ENCOURAGE_SETTLEMENT: {
      cityKey: 'pop',
      statType: 'leadership',
      debuff: 1.0,
      cost: { gold: 0, rice: GameBalance.develCost * 2 },
      maxKey: 'pop_max',
    },
    IMPROVE_TRUST: {
      cityKey: 'trust',
      statType: 'leadership',
      debuff: 1.0,
      cost: { gold: 0, rice: GameBalance.develCost * 2 },
    },
  };

  async handle(context: CommandContext): Promise<CommandResult> {
    const { generalId, type, rng, generalRepo, cityRepo, nationRepo } = context;

    const config = DomesticHandler.CONFIG_MAP[type];
    if (!config) {
      return {
        success: false,
        message: `알 수 없는 내정 커맨드: ${type}`,
      };
    }

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    const city = await cityRepo.findById(general.city);
    if (!city) {
      return { success: false, message: '도시를 찾을 수 없습니다.' };
    }

    const nation = await nationRepo.findById(general.nation);
    if (!nation) {
      return { success: false, message: '국가를 찾을 수 없습니다.' };
    }

    try {
      ValidatorService.validateDomesticPreconditions(general, city);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    try {
      CostService.validate(general, config.cost);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const isCapital = city.id === nation.capital;

    let score: number;
    if (config.isNationStat) {
      score = DomesticService.calculateTechScore(general, nation, rng);
    } else {
      score = DomesticService.calculateScore(
        general,
        city,
        config.statType,
        rng,
        isCapital,
        config.debuff
      );
    }

    if (config.isNationStat) {
      const currentValue = nation[config.cityKey] || 0;
      const maxValue = GameBalance.maxTechLevel || 12;
      const newValue = Math.min(currentValue + score, maxValue);
      
      await nationRepo.update(nation.id, {
        [config.cityKey]: newValue,
      });
    } else {
      const currentValue = city[config.cityKey] || 0;
      let newValue = currentValue + score;

      if (config.maxKey) {
        const maxValue = city[config.maxKey] || Number.MAX_SAFE_INTEGER;
        newValue = Math.min(newValue, maxValue);
      } else if (config.cityKey === 'trust') {
        newValue = Math.min(newValue, 100);
      }

      await cityRepo.update(city.id, {
        [config.cityKey]: newValue,
      });
    }

    CostService.consume(general, config.cost);
    ExperienceService.applyDomestic(general, score, config.statType);

    await generalRepo.update(general.id, {
      gold: general.gold,
      rice: general.rice,
      exp: general.exp,
      ded: general.ded,
      leadership_exp: general.leadership_exp,
      strength_exp: general.strength_exp,
      intel_exp: general.intel_exp,
      leadership: general.leadership,
      strength: general.strength,
      intel: general.intel,
    });

    return {
      success: true,
      message: `${this.getCommandName(type)} 완료 (증가: ${score})`,
      changes: {
        score,
        cityKey: config.cityKey,
        exp: general.exp,
        ded: general.ded,
      },
    };
  }

  private getCommandName(type: string): string {
    const names: Record<string, string> = {
      DEVELOP_AGRICULTURE: '농지개간',
      DEVELOP_COMMERCE: '상업투자',
      RESEARCH_TECH: '기술연구',
      STRENGTHEN_DEFENSE: '수비강화',
      REPAIR_WALL: '성벽보수',
      STRENGTHEN_SECURITY: '치안강화',
      ENCOURAGE_SETTLEMENT: '정착장려',
      IMPROVE_TRUST: '주민선정',
    };
    return names[type] || type;
  }
}
