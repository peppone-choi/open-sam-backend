import { SabotageService } from '../../../../common/services/sabotage.service';
import { CostService, Cost } from '../../../../common/services/cost.service';
import { ExperienceService } from '../../../../common/services/experience.service';
import { ValidatorService } from '../../../../common/services/validator.service';

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
 * 계략 타겟 정보
 */
interface StratagemTarget {
  key: string;
  statType: 'intel' | 'strength';
}

/**
 * 계략 커맨드 핸들러
 * 
 * 4개 계략 커맨드를 처리:
 * - AGITATE (선동): 민심 동요
 * - SEIZE (탈취): 자원 탈취
 * - SABOTAGE (파괴): 시설 파괴
 * - FIRE_ATTACK (화계): 화재 발생
 * 
 * SabotageService로 성공률/피해량 계산, 실패시 부상 처리
 */
export class StratagemHandler implements CommandHandler {
  private static readonly TARGET_MAP: Record<string, StratagemTarget> = {
    AGITATE: { key: 'trust', statType: 'intel' },
    SEIZE: { key: 'gold', statType: 'strength' },
    SABOTAGE: { key: 'def', statType: 'intel' },
    FIRE_ATTACK: { key: 'wall', statType: 'intel' },
  };

  async handle(context: CommandContext): Promise<CommandResult> {
    const { generalId, type, payload, rng, generalRepo, cityRepo } = context;
    const { targetCityId } = payload;

    if (!targetCityId) {
      return { success: false, message: '대상 도시를 지정해야 합니다.' };
    }

    const targetConfig = StratagemHandler.TARGET_MAP[type];
    if (!targetConfig) {
      return { success: false, message: `알 수 없는 계략 커맨드: ${type}` };
    }

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    const targetCity = await cityRepo.findById(targetCityId);
    if (!targetCity) {
      return { success: false, message: '대상 도시를 찾을 수 없습니다.' };
    }

    try {
      ValidatorService.validateSabotage(general, targetCity);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const cost = SabotageService.getCost();
    try {
      CostService.validate(general, cost);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const defenders = await generalRepo.findByCity(targetCityId);
    const defenderIntel = SabotageService.calculateAverageDefenderIntel(defenders);
    const defenderCount = defenders.length;

    const isSuccess = SabotageService.isSuccess(
      general.intel,
      defenderIntel,
      defenderCount,
      rng
    );

    let resultMessage: string;
    let changes: any = {};

    if (isSuccess) {
      const damage = SabotageService.calculateDamage(rng);

      if (type === 'SEIZE') {
        const stolenGold = Math.min(damage, targetCity.gold || 0);
        targetCity.gold = Math.max(0, (targetCity.gold || 0) - stolenGold);
        general.gold += stolenGold;

        await cityRepo.update(targetCity.id, {
          gold: targetCity.gold,
        });

        resultMessage = `탈취 성공! (금 ${stolenGold} 탈취)`;
        changes = {
          success: true,
          stolenGold,
          defenderIntel,
          defenderCount,
        };
      } else {
        const currentValue = targetCity[targetConfig.key] || 0;
        const newValue = Math.max(0, currentValue - damage);
        targetCity[targetConfig.key] = newValue;

        await cityRepo.update(targetCity.id, {
          [targetConfig.key]: newValue,
        });

        resultMessage = `${this.getCommandName(type)} 성공! (${targetConfig.key} -${damage})`;
        changes = {
          success: true,
          damage,
          targetKey: targetConfig.key,
          defenderIntel,
          defenderCount,
        };
      }
    } else {
      const injury = SabotageService.applyInjury(rng);
      general.injury = Math.min((general.injury || 0) + injury, 100);

      resultMessage = `${this.getCommandName(type)} 실패! (부상 +${injury})`;
      changes = {
        success: false,
        injury,
        defenderIntel,
        defenderCount,
      };
    }

    CostService.consume(general, cost);
    ExperienceService.applySabotage(general, targetConfig.statType);

    await generalRepo.update(general.id, {
      gold: general.gold,
      rice: general.rice,
      injury: general.injury || 0,
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
      message: resultMessage,
      changes,
    };
  }

  private getCommandName(type: string): string {
    const names: Record<string, string> = {
      AGITATE: '선동',
      SEIZE: '탈취',
      SABOTAGE: '파괴',
      FIRE_ATTACK: '화계',
    };
    return names[type] || type;
  }
}
