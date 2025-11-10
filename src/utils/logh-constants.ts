/**
 * LOGH 게임 상수
 * config/scenarios/legend-of-galactic-heroes/data/game-constants.json에서 로드
 */

import * as path from 'path';
import * as fs from 'fs';

interface LoghGameConstants {
  timeConstants: {
    realTimeMultiplier: number;
    cpRecoveryInterval: { gameTime: number; realTime: number; unit: string };
    autoPromotionCheckInterval: { gameTime: number; unit: string };
    operationDuration: { gameTime: number; unit: string };
    gameEndDate: string;
  };
  sessionConstants: {
    maxPlayers: number;
    maxJobCardsPerCharacter: number;
    maxAddressBookEntries: number;
    maxMailboxCapacity: number;
    characterContinuationMaxAge: number;
  };
  gridConstants: {
    gridSize: number;
    gridSizeUnit: string;
    maxUnitsPerFactionPerGrid: number;
    maxFactionsPerGrid: number;
  };
  warpConstants: {
    minimumNavigationCost: number;
  };
  rankLimits: {
    marshal: number;
    seniorAdmiral: number;
    admiral: number;
    viceAdmiral: number;
    rearAdmiral: number;
    commodore: number;
    colonelAndBelow: string;
  };
  promotionDemotionConstants: {
    promotionMeritReset: number;
    demotionMeritSet: number;
  };
  experienceConstants: {
    experienceToLevelUp: number;
    levelUpExperienceReset: number;
  };
  commandConstants: {
    cpSubstitutionMultiplier: number;
  };
  tacticalConstants: {
    evaluationPointCalculationInterval: { gameTime: number; unit: string };
    commandProcessingTimeRange: { min: number; max: number; unit: string };
    retreatPreparationTime: { gameTime: number; unit: string };
    groundForceDeploymentTime: number;
    groundForceWithdrawalTime: number;
    sortieTimePerUnit: number;
    parallelMoveSpeedMultiplier: number;
    maxGroundUnitsPerFaction: number;
    groundUnitFullDeploymentPercentage: number;
  };
  shipUnitConstants: {
    shipsPerUnit: number;
  };
}

class LoghConstants {
  private static instance: LoghConstants;
  private constants: LoghGameConstants;

  private constructor() {
    const constantsPath = path.join(
      __dirname,
      '../../config/scenarios/legend-of-galactic-heroes/data/game-constants.json'
    );
    
    try {
      const data = fs.readFileSync(constantsPath, 'utf-8');
      this.constants = JSON.parse(data);
    } catch (error) {
      console.error('LOGH 게임 상수 로드 실패:', error);
      // 기본값 설정
      this.constants = this.getDefaultConstants();
    }
  }

  private getDefaultConstants(): LoghGameConstants {
    return {
      timeConstants: {
        realTimeMultiplier: 24,
        cpRecoveryInterval: { gameTime: 2, realTime: 5, unit: '분' },
        autoPromotionCheckInterval: { gameTime: 30, unit: '일' },
        operationDuration: { gameTime: 30, unit: '일' },
        gameEndDate: '우주력 801년 7월 27일 00시 00분',
      },
      sessionConstants: {
        maxPlayers: 2000,
        maxJobCardsPerCharacter: 16,
        maxAddressBookEntries: 100,
        maxMailboxCapacity: 120,
        characterContinuationMaxAge: 60,
      },
      gridConstants: {
        gridSize: 100,
        gridSizeUnit: '광년',
        maxUnitsPerFactionPerGrid: 300,
        maxFactionsPerGrid: 2,
      },
      warpConstants: {
        minimumNavigationCost: 100,
      },
      rankLimits: {
        marshal: 5,
        seniorAdmiral: 5,
        admiral: 10,
        viceAdmiral: 20,
        rearAdmiral: 40,
        commodore: 80,
        colonelAndBelow: 'unlimited',
      },
      promotionDemotionConstants: {
        promotionMeritReset: 0,
        demotionMeritSet: 100,
      },
      experienceConstants: {
        experienceToLevelUp: 100,
        levelUpExperienceReset: 0,
      },
      commandConstants: {
        cpSubstitutionMultiplier: 2,
      },
      tacticalConstants: {
        evaluationPointCalculationInterval: { gameTime: 30, unit: '일' },
        commandProcessingTimeRange: { min: 0, max: 20, unit: '초' },
        retreatPreparationTime: { gameTime: 2.5, unit: '분' },
        groundForceDeploymentTime: 20,
        groundForceWithdrawalTime: 20,
        sortieTimePerUnit: 20,
        parallelMoveSpeedMultiplier: 0.5,
        maxGroundUnitsPerFaction: 30,
        groundUnitFullDeploymentPercentage: 100,
      },
      shipUnitConstants: {
        shipsPerUnit: 300,
      },
    };
  }

  public static getInstance(): LoghConstants {
    if (!LoghConstants.instance) {
      LoghConstants.instance = new LoghConstants();
    }
    return LoghConstants.instance;
  }

  public get SHIPS_PER_UNIT(): number {
    return this.constants.shipUnitConstants.shipsPerUnit;
  }

  public get CREW_PER_SHIP(): number {
    return 100; // 매뉴얼 역산값
  }

  public get TROOPS_PER_UNIT(): number {
    return 2000; // 연대급 추정값
  }

  public get MAX_UNITS_PER_GRID(): number {
    return this.constants.gridConstants.maxUnitsPerFactionPerGrid;
  }

  public get MAX_FACTIONS_PER_GRID(): number {
    return this.constants.gridConstants.maxFactionsPerGrid;
  }

  public get GRID_SIZE(): number {
    return this.constants.gridConstants.gridSize;
  }

  public get REAL_TIME_MULTIPLIER(): number {
    return this.constants.timeConstants.realTimeMultiplier;
  }

  public get CP_RECOVERY_INTERVAL(): { gameTime: number; realTime: number; unit: string } {
    return this.constants.timeConstants.cpRecoveryInterval;
  }

  public get MAX_PLAYERS(): number {
    return this.constants.sessionConstants.maxPlayers;
  }

  public get MAX_JOB_CARDS(): number {
    return this.constants.sessionConstants.maxJobCardsPerCharacter;
  }

  public getRankLimit(rank: string): number {
    const key = rank as keyof typeof this.constants.rankLimits;
    const value = this.constants.rankLimits[key];
    return typeof value === 'number' ? value : Infinity;
  }

  public getAll(): LoghGameConstants {
    return this.constants;
  }
}

export default LoghConstants.getInstance();
