import { MilitaryService } from '../../../../common/services/military.service';
import { CostService, Cost } from '../../../../common/services/cost.service';
import { ExperienceService } from '../../../../common/services/experience.service';
import { ValidatorService } from '../../../../common/services/validator.service';
import { GameBalance, GameCalc } from '../../../../common/constants/game-balance';

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
 * 군사 커맨드 핸들러
 * 
 * 5개 군사 커맨드를 처리:
 * - TRAIN (훈련): GameCalc.calculateTrainIncrease 사용
 * - BOOST_MORALE (사기진작): GameCalc.calculateMoraleIncrease 사용
 * - CONSCRIPT (징병): costOffset=1, defaultTrain/Atmos=40
 * - RECRUIT (모병): costOffset=2, defaultTrain/Atmos=70
 * - DEMOBILIZE (소집해제): 병력 해산, 인구 복귀
 */
export class MilitaryHandler implements CommandHandler {
  async handle(context: CommandContext): Promise<CommandResult> {
    const { type } = context;

    switch (type) {
      case 'TRAIN':
        return this.handleTrain(context);
      case 'BOOST_MORALE':
        return this.handleBoostMorale(context);
      case 'CONSCRIPT':
        return this.handleRecruit(context, 1, GameBalance.defaultTrainLow, GameBalance.defaultAtmosLow);
      case 'RECRUIT':
        return this.handleRecruit(context, 2, GameBalance.defaultTrainHigh, GameBalance.defaultAtmosHigh);
      case 'DEMOBILIZE':
        return this.handleDemobilize(context);
      default:
        return { success: false, message: `알 수 없는 군사 커맨드: ${type}` };
    }
  }

  private async handleTrain(context: CommandContext): Promise<CommandResult> {
    const { generalId, generalRepo, cityRepo } = context;

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    try {
      ValidatorService.validateMilitaryPreconditions(general, {
        crew: general.crew,
        crewType: general.crewType,
        train: general.train,
        atmos: general.atmos,
      });
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    if (general.crew <= 0) {
      return { success: false, message: '병사가 없습니다.' };
    }

    const trainIncrease = GameCalc.calculateTrainIncrease(
      general.leadership,
      general.crew,
      general.train
    );

    const sideEffect = GameCalc.calculateTrainSideEffect(general.atmos);

    general.train = Math.min(general.train + trainIncrease, GameBalance.maxTrainByCommand);
    general.atmos = sideEffect;

    ExperienceService.applyMilitary(general, 100, 70, 'leadership');

    await generalRepo.update(general.id, {
      train: general.train,
      atmos: general.atmos,
      exp: general.exp,
      ded: general.ded,
      leadership_exp: general.leadership_exp,
      leadership: general.leadership,
    });

    return {
      success: true,
      message: `훈련 완료 (훈련도 +${trainIncrease})`,
      changes: {
        trainIncrease,
        newTrain: general.train,
        newAtmos: general.atmos,
      },
    };
  }

  private async handleBoostMorale(context: CommandContext): Promise<CommandResult> {
    const { generalId, generalRepo } = context;

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    try {
      ValidatorService.validateMilitaryPreconditions(general, {
        crew: general.crew,
        crewType: general.crewType,
        train: general.train,
        atmos: general.atmos,
      });
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    if (general.crew <= 0) {
      return { success: false, message: '병사가 없습니다.' };
    }

    const cost: Cost = {
      gold: MilitaryService.calculateMoraleCost(general.crew),
      rice: 0,
    };

    try {
      CostService.validate(general, cost);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const moraleIncrease = GameCalc.calculateMoraleIncrease(
      general.leadership,
      general.crew,
      general.atmos
    );

    const sideEffect = GameCalc.calculateMoraleSideEffect(general.train);

    general.atmos = Math.min(general.atmos + moraleIncrease, GameBalance.maxAtmosByCommand);
    general.train = sideEffect;

    CostService.consume(general, cost);
    ExperienceService.applyMilitary(general, 100, 70, 'leadership');

    await generalRepo.update(general.id, {
      train: general.train,
      atmos: general.atmos,
      gold: general.gold,
      rice: general.rice,
      exp: general.exp,
      ded: general.ded,
      leadership_exp: general.leadership_exp,
      leadership: general.leadership,
    });

    return {
      success: true,
      message: `사기진작 완료 (사기 +${moraleIncrease})`,
      changes: {
        moraleIncrease,
        newAtmos: general.atmos,
        newTrain: general.train,
      },
    };
  }

  private async handleRecruit(
    context: CommandContext,
    costOffset: number,
    defaultTrain: number,
    defaultAtmos: number
  ): Promise<CommandResult> {
    const { generalId, payload, generalRepo, cityRepo, nationRepo } = context;
    const { unitType, amount } = payload;

    if (!unitType || !amount || amount <= 0) {
      return { success: false, message: '잘못된 징병/모병 정보입니다.' };
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
      ValidatorService.validateRecruitPreconditions(general, city, amount, costOffset);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const sameType = general.crewType === unitType;
    const maxCrew = MilitaryService.calculateMaxCrew(general.leadership, general.crew, sameType);

    if (amount > maxCrew) {
      return { success: false, message: `최대 ${maxCrew}명까지 모집할 수 있습니다.` };
    }

    const unitCost = 50;
    const reqGold = MilitaryService.calculateRecruitCost(unitCost, amount, nation.tech || 0, costOffset);
    const reqRice = MilitaryService.calculateRecruitRice(amount);

    const cost: Cost = { gold: reqGold, rice: reqRice };

    try {
      CostService.validate(general, cost);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    let newCrew: number;
    let newTrain: number;
    let newAtmos: number;

    if (sameType) {
      newCrew = general.crew + amount;
      newTrain = MilitaryService.calculateAverageTrain(
        general.crew,
        general.train,
        amount,
        defaultTrain
      );
      newAtmos = MilitaryService.calculateAverageAtmos(
        general.crew,
        general.atmos,
        amount,
        defaultAtmos
      );
    } else {
      newCrew = amount;
      newTrain = defaultTrain;
      newAtmos = defaultAtmos;
    }

    const popDecrease = MilitaryService.calculatePopulationDecrease(amount);
    const newPop = city.pop - popDecrease;
    const newTrust = MilitaryService.calculateTrustDecrease(city.trust, amount, city.pop, costOffset);

    await cityRepo.update(city.id, {
      pop: Math.max(newPop, 0),
      trust: newTrust,
    });

    general.crew = newCrew;
    general.crewType = unitType;
    general.train = Math.round(newTrain);
    general.atmos = Math.round(newAtmos);

    CostService.consume(general, cost);
    ExperienceService.applyRecruit(general, amount);

    await generalRepo.update(general.id, {
      crew: general.crew,
      crewType: general.crewType,
      train: general.train,
      atmos: general.atmos,
      gold: general.gold,
      rice: general.rice,
      exp: general.exp,
      ded: general.ded,
      leadership_exp: general.leadership_exp,
      leadership: general.leadership,
    });

    const commandName = costOffset === 1 ? '징병' : '모병';
    return {
      success: true,
      message: `${commandName} 완료 (${amount}명 모집)`,
      changes: {
        amount,
        newCrew: general.crew,
        newTrain: general.train,
        newAtmos: general.atmos,
        popDecrease,
      },
    };
  }

  private async handleDemobilize(context: CommandContext): Promise<CommandResult> {
    const { generalId, generalRepo, cityRepo } = context;

    const general = await generalRepo.findById(generalId);
    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다.' };
    }

    const city = await cityRepo.findById(general.city);
    if (!city) {
      return { success: false, message: '도시를 찾을 수 없습니다.' };
    }

    if (general.crew <= 0) {
      return { success: false, message: '소집해제할 병사가 없습니다.' };
    }

    const returnPop = general.crew;

    await cityRepo.update(city.id, {
      pop: city.pop + returnPop,
    });

    await generalRepo.update(general.id, {
      crew: 0,
      crewType: 0,
      train: 0,
      atmos: 0,
    });

    return {
      success: true,
      message: `소집해제 완료 (${returnPop}명 복귀)`,
      changes: {
        returnPop,
      },
    };
  }
}
