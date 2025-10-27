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
 * 이동 커맨드 핸들러
 * 
 * 4개 이동 커맨드를 처리:
 * - MOVE (이동): 인접 도시, atmos-5, cost=24금
 * - FORCE_MARCH (강행): 3칸 이내, train-5, atmos-5, cost=120금
 * - RETURN (귀환): 수도로 이동, 비용 없음
 * - BORDER_RETURN (접경귀환): 비점령 도시에서 아군 도시로, 비용 없음
 */
export class MovementHandler implements CommandHandler {
  async handle(context: CommandContext): Promise<CommandResult> {
    const { type } = context;

    switch (type) {
      case 'MOVE':
        return this.handleMove(context, false);
      case 'FORCE_MARCH':
        return this.handleMove(context, true);
      case 'RETURN':
        return this.handleReturn(context);
      case 'BORDER_RETURN':
        return this.handleBorderReturn(context);
      default:
        return { success: false, message: `알 수 없는 이동 커맨드: ${type}` };
    }
  }

  /**
   * 이동 / 강행 처리
   */
  private async handleMove(context: CommandContext, isForced: boolean): Promise<CommandResult> {
    const { generalId, payload, generalRepo, cityRepo, nationRepo } = context;
    const { targetCityId } = payload;

    if (!targetCityId) {
      return { success: false, message: '목적지를 지정해야 합니다.' };
    }

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    const fromCity = await cityRepo.findById(general.city);
    if (!fromCity) {
      return { success: false, message: '출발 도시를 찾을 수 없습니다.' };
    }

    const toCity = await cityRepo.findById(targetCityId);
    if (!toCity) {
      return { success: false, message: '목적지 도시를 찾을 수 없습니다.' };
    }

    const distance = this.calculateDistance(fromCity, toCity);
    const maxDistance = isForced ? 3 : 1;

    try {
      ValidatorService.validateMovement(general, fromCity, toCity, distance, maxDistance);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const cost: Cost = isForced
      ? { gold: GameBalance.develCost * 5, rice: 0 }
      : { gold: GameBalance.develCost, rice: 0 };

    try {
      CostService.validate(general, cost);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    general.city = targetCityId;

    if (isForced) {
      general.train = Math.max(0, general.train - 5);
      general.atmos = Math.max(0, general.atmos - 5);
    } else {
      general.atmos = Math.max(0, general.atmos - 5);
    }

    CostService.consume(general, cost);
    ExperienceService.applyMovement(general, isForced);

    await generalRepo.update(general.id, {
      city: general.city,
      train: general.train,
      atmos: general.atmos,
      gold: general.gold,
      rice: general.rice,
      exp: general.exp,
      leadership_exp: general.leadership_exp,
      leadership: general.leadership,
    });

    const commandName = isForced ? '강행' : '이동';
    return {
      success: true,
      message: `${commandName} 완료 (${toCity.name || targetCityId})`,
      changes: {
        fromCityId: fromCity.id,
        toCityId: toCity.id,
        distance,
        trainDecrease: isForced ? 5 : 0,
        atmosDecrease: 5,
      },
    };
  }

  /**
   * 귀환 처리 (수도로 이동)
   */
  private async handleReturn(context: CommandContext): Promise<CommandResult> {
    const { generalId, generalRepo, cityRepo, nationRepo } = context;

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    if (!general.nation) {
      return { success: false, message: '국가에 소속되어 있지 않습니다.' };
    }

    const nation = await nationRepo.findById(general.nation);
    if (!nation) {
      return { success: false, message: '국가를 찾을 수 없습니다.' };
    }

    if (!nation.capital) {
      return { success: false, message: '수도가 지정되지 않았습니다.' };
    }

    const capitalCity = await cityRepo.findById(nation.capital);
    if (!capitalCity) {
      return { success: false, message: '수도를 찾을 수 없습니다.' };
    }

    if (general.city === nation.capital) {
      return { success: false, message: '이미 수도에 있습니다.' };
    }

    const oldCityId = general.city;
    general.city = nation.capital;

    await generalRepo.update(general.id, {
      city: general.city,
    });

    return {
      success: true,
      message: `귀환 완료 (${capitalCity.name || nation.capital})`,
      changes: {
        fromCityId: oldCityId,
        toCityId: nation.capital,
      },
    };
  }

  /**
   * 접경귀환 처리 (비점령 도시에서 아군 도시로)
   */
  private async handleBorderReturn(context: CommandContext): Promise<CommandResult> {
    const { generalId, generalRepo, cityRepo, nationRepo } = context;

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    if (!general.nation) {
      return { success: false, message: '국가에 소속되어 있지 않습니다.' };
    }

    const currentCity = await cityRepo.findById(general.city);
    if (!currentCity) {
      return { success: false, message: '현재 도시를 찾을 수 없습니다.' };
    }

    if (currentCity.nation === general.nation) {
      return { success: false, message: '자국 도시에서는 접경귀환을 사용할 수 없습니다.' };
    }

    const nation = await nationRepo.findById(general.nation);
    if (!nation) {
      return { success: false, message: '국가를 찾을 수 없습니다.' };
    }

    if (!nation.capital) {
      return { success: false, message: '수도가 지정되지 않았습니다.' };
    }

    const nearestOwnCity = await this.findNearestOwnCity(
      generalRepo,
      cityRepo,
      general.nation,
      currentCity
    );

    if (!nearestOwnCity) {
      const capitalCity = await cityRepo.findById(nation.capital);
      if (capitalCity) {
        general.city = nation.capital;
      } else {
        return { success: false, message: '귀환할 도시를 찾을 수 없습니다.' };
      }
    } else {
      general.city = nearestOwnCity.id;
    }

    await generalRepo.update(general.id, {
      city: general.city,
    });

    return {
      success: true,
      message: `접경귀환 완료 (${nearestOwnCity?.name || general.city})`,
      changes: {
        fromCityId: currentCity.id,
        toCityId: general.city,
      },
    };
  }

  /**
   * 도시 간 거리 계산 (간단한 구현)
   */
  private calculateDistance(fromCity: any, toCity: any): number {
    if (!fromCity.x || !fromCity.y || !toCity.x || !toCity.y) {
      return 1;
    }

    const dx = Math.abs(fromCity.x - toCity.x);
    const dy = Math.abs(fromCity.y - toCity.y);
    return Math.max(dx, dy);
  }

  /**
   * 가장 가까운 아군 도시 찾기
   */
  private async findNearestOwnCity(
    generalRepo: any,
    cityRepo: any,
    nationId: string,
    currentCity: any
  ): Promise<any> {
    const cities = await cityRepo.findByNation(nationId);
    if (!cities || cities.length === 0) {
      return null;
    }

    let nearest = cities[0];
    let minDistance = this.calculateDistance(currentCity, nearest);

    for (const city of cities) {
      const distance = this.calculateDistance(currentCity, city);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = city;
      }
    }

    return nearest;
  }
}
