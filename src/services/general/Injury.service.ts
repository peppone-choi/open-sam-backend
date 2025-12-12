/**
 * Injury.service.ts - 부상 및 사망 시스템 서비스
 *
 * 장수의 부상 처리 및 사망 처리를 담당합니다.
 * 
 * 부상 등급:
 * - 0: 건강 (흰색)
 * - 1-20: 경상 (노란색)
 * - 21-40: 중상 (주황색)
 * - 41-60: 심각 (자홍색)
 * - 61+: 위독 (빨간색)
 */

import { IGeneral } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';
import { ActionLogger } from '../logger/ActionLogger';
import { JosaUtil } from '../../utils/JosaUtil';

/**
 * 부상 등급
 */
export enum InjuryLevel {
  HEALTHY = 'healthy',      // 0: 건강
  LIGHT = 'light',          // 1-20: 경상
  MODERATE = 'moderate',    // 21-40: 중상
  SEVERE = 'severe',        // 41-60: 심각
  CRITICAL = 'critical',    // 61+: 위독
}

/**
 * 부상 등급별 설정
 */
export const INJURY_LEVELS: Record<InjuryLevel, { min: number; max: number; name: string; color: string }> = {
  [InjuryLevel.HEALTHY]: { min: 0, max: 0, name: '건강', color: 'white' },
  [InjuryLevel.LIGHT]: { min: 1, max: 20, name: '경상', color: 'yellow' },
  [InjuryLevel.MODERATE]: { min: 21, max: 40, name: '중상', color: 'orange' },
  [InjuryLevel.SEVERE]: { min: 41, max: 60, name: '심각', color: 'magenta' },
  [InjuryLevel.CRITICAL]: { min: 61, max: 100, name: '위독', color: 'red' },
};

/**
 * 부상 시스템 설정값
 */
export const INJURY_CONFIG = {
  /** 턴당 자연 회복량 */
  NATURAL_RECOVERY: 3,
  
  /** 치료 명령 시 회복량 */
  HEAL_RECOVERY: 10,
  
  /** 부상으로 인한 사망 확률 기준 (부상도 61 이상) */
  DEATH_THRESHOLD: 61,
  
  /** 위독 시 사망 확률 (%) */
  CRITICAL_DEATH_RATE: 5,
  
  /** 노환 사망 시작 나이 */
  OLD_AGE_START: 60,
  
  /** 노환 사망 확률 증가율 (나이당 %) */
  OLD_AGE_DEATH_RATE_PER_YEAR: 2,
  
  /** 전투 중 부상 기본 확률 (%) */
  BATTLE_INJURY_BASE_RATE: 10,
  
  /** 병력 손실 1000명당 부상 확률 증가 (%) */
  INJURY_RATE_PER_1000_LOSS: 5,
  
  /** 최대 부상도 */
  MAX_INJURY: 80,
};

/**
 * 부상 결과
 */
export interface InjuryResult {
  injured: boolean;
  previousInjury: number;
  currentInjury: number;
  injuryLevel: InjuryLevel;
  message: string;
}

/**
 * 사망 결과
 */
export interface DeathResult {
  died: boolean;
  cause: 'injury' | 'old_age' | 'execution' | 'battle' | 'none';
  message: string;
}

/**
 * 부상 서비스 클래스
 */
export class InjuryService {
  /**
   * 부상 등급 조회
   */
  static getInjuryLevel(injury: number): InjuryLevel {
    if (injury <= 0) return InjuryLevel.HEALTHY;
    if (injury <= 20) return InjuryLevel.LIGHT;
    if (injury <= 40) return InjuryLevel.MODERATE;
    if (injury <= 60) return InjuryLevel.SEVERE;
    return InjuryLevel.CRITICAL;
  }

  /**
   * 부상 등급 정보 조회
   */
  static getInjuryLevelInfo(injury: number): { name: string; color: string } {
    const level = this.getInjuryLevel(injury);
    return INJURY_LEVELS[level];
  }

  /**
   * 부상으로 인한 능력치 감소 계산
   * PHP calcInjury 함수와 동일
   */
  static calcStatWithInjury(baseStat: number, injury: number): number {
    return Math.round(baseStat * (100 - injury) / 100);
  }

  /**
   * 전투 중 부상 처리
   *
   * @param sessionId 세션 ID
   * @param general 장수
   * @param crewLost 손실 병력
   * @param rng 난수 생성기
   * @returns 부상 결과
   */
  static async processBattleInjury(
    sessionId: string,
    general: IGeneral,
    crewLost: number,
    rng: any
  ): Promise<InjuryResult> {
    const generalName = general.getName();
    const previousInjury = general.getVar('injury') ?? 0;

    // 부상 확률 계산: 기본 10% + 병력 손실 1000명당 5%
    const injuryRate = INJURY_CONFIG.BATTLE_INJURY_BASE_RATE +
      Math.floor(crewLost / 1000) * INJURY_CONFIG.INJURY_RATE_PER_1000_LOSS;

    // 최대 50% 부상 확률
    const finalRate = Math.min(50, injuryRate);

    const injured = rng.nextBool(finalRate / 100);

    if (!injured) {
      return {
        injured: false,
        previousInjury,
        currentInjury: previousInjury,
        injuryLevel: this.getInjuryLevel(previousInjury),
        message: '',
      };
    }

    // 부상도 증가 (10-30)
    const injuryIncrease = rng.nextRangeInt(10, 30);
    const newInjury = Math.min(INJURY_CONFIG.MAX_INJURY, previousInjury + injuryIncrease);

    general.setVar('injury', newInjury);
    await general.save();

    const levelInfo = this.getInjuryLevelInfo(newInjury);
    const logger = general.getLogger();
    const josaYi = JosaUtil.pick(generalName, '이');
    
    logger?.pushGeneralActionLog(
      `<R>전투 중 부상!</> 부상도: <C>${newInjury}</> (${levelInfo.name})`
    );

    return {
      injured: true,
      previousInjury,
      currentInjury: newInjury,
      injuryLevel: this.getInjuryLevel(newInjury),
      message: `${generalName}${josaYi} 전투 중 부상을 입었습니다. (${levelInfo.name})`,
    };
  }

  /**
   * 부상 자연 회복 처리 (턴 전처리에서 호출)
   *
   * @param general 장수
   * @returns 회복된 부상도
   */
  static processNaturalRecovery(general: IGeneral): number {
    const currentInjury = general.getVar('injury') ?? 0;
    if (currentInjury <= 0) {
      return 0;
    }

    const recovery = Math.min(INJURY_CONFIG.NATURAL_RECOVERY, currentInjury);
    const newInjury = currentInjury - recovery;
    general.setVar('injury', Math.max(0, newInjury));

    return recovery;
  }

  /**
   * 치료 명령으로 부상 회복
   *
   * @param sessionId 세션 ID
   * @param generalId 장수 ID
   * @param healAmount 회복량 (기본: 10)
   * @returns 회복 결과
   */
  static async healInjury(
    sessionId: string,
    generalId: number,
    healAmount: number = INJURY_CONFIG.HEAL_RECOVERY
  ): Promise<InjuryResult> {
    const general = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: generalId,
    });

    if (!general) {
      return {
        injured: false,
        previousInjury: 0,
        currentInjury: 0,
        injuryLevel: InjuryLevel.HEALTHY,
        message: '장수를 찾을 수 없습니다.',
      };
    }

    const previousInjury = general.getVar('injury') ?? 0;
    if (previousInjury <= 0) {
      return {
        injured: false,
        previousInjury: 0,
        currentInjury: 0,
        injuryLevel: InjuryLevel.HEALTHY,
        message: '부상이 없습니다.',
      };
    }

    const newInjury = Math.max(0, previousInjury - healAmount);
    general.setVar('injury', newInjury);
    await general.save();

    const generalName = general.getName();
    const levelInfo = this.getInjuryLevelInfo(newInjury);
    const logger = general.getLogger();

    logger?.pushGeneralActionLog(
      `부상 치료: 부상도 <C>${previousInjury}</> → <S>${newInjury}</> (${levelInfo.name})`
    );

    return {
      injured: newInjury > 0,
      previousInjury,
      currentInjury: newInjury,
      injuryLevel: this.getInjuryLevel(newInjury),
      message: `부상이 치료되었습니다. (${levelInfo.name})`,
    };
  }

  /**
   * 부상으로 인한 사망 체크 (턴 처리 시 호출)
   *
   * @param sessionId 세션 ID
   * @param general 장수
   * @param rng 난수 생성기
   * @returns 사망 여부
   */
  static async checkInjuryDeath(
    sessionId: string,
    general: IGeneral,
    rng: any
  ): Promise<DeathResult> {
    const injury = general.getVar('injury') ?? 0;
    
    if (injury < INJURY_CONFIG.DEATH_THRESHOLD) {
      return { died: false, cause: 'none', message: '' };
    }

    // 위독 상태에서 사망 확률 체크
    const deathRate = INJURY_CONFIG.CRITICAL_DEATH_RATE;
    const died = rng.nextBool(deathRate / 100);

    if (!died) {
      return { died: false, cause: 'none', message: '' };
    }

    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');
    const logger = general.getLogger();

    logger?.pushGeneralActionLog(
      `<R>부상으로 인해 사망</>하였습니다.`
    );
    logger?.pushGlobalHistoryLog(
      `<R><b>【사망】</b></><Y>${generalName}</>${josaYi} 부상으로 인해 사망하였습니다.`
    );

    // 사망 처리
    await general.kill({
      sendDyingMessage: true,
      dyingMessage: `${generalName}이(가) 부상으로 인해 사망하였습니다.`,
    });

    return {
      died: true,
      cause: 'injury',
      message: `${generalName}${josaYi} 부상으로 사망하였습니다.`,
    };
  }

  /**
   * 노환으로 인한 사망 체크 (턴 처리 시 호출)
   *
   * @param sessionId 세션 ID
   * @param general 장수
   * @param rng 난수 생성기
   * @returns 사망 여부
   */
  static async checkOldAgeDeath(
    sessionId: string,
    general: IGeneral,
    rng: any
  ): Promise<DeathResult> {
    const age = general.getVar('age') ?? 20;
    
    if (age < INJURY_CONFIG.OLD_AGE_START) {
      return { died: false, cause: 'none', message: '' };
    }

    // 사망 확률: (나이 - 60) * 2%
    // 예: 70세 = 20%, 80세 = 40%
    const deathRate = (age - INJURY_CONFIG.OLD_AGE_START) * INJURY_CONFIG.OLD_AGE_DEATH_RATE_PER_YEAR;
    const died = rng.nextBool(Math.min(80, deathRate) / 100);

    if (!died) {
      return { died: false, cause: 'none', message: '' };
    }

    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');
    const logger = general.getLogger();

    logger?.pushGeneralActionLog(
      `<R>노환으로 인해 사망</>하였습니다.`
    );
    logger?.pushGlobalHistoryLog(
      `<R><b>【사망】</b></><Y>${generalName}</>${josaYi} 노환(${age}세)으로 세상을 떠났습니다.`
    );

    // 사망 처리
    await general.kill({
      sendDyingMessage: true,
      dyingMessage: `${generalName}이(가) 노환(${age}세)으로 세상을 떠났습니다.`,
    });

    return {
      died: true,
      cause: 'old_age',
      message: `${generalName}${josaYi} 노환으로 사망하였습니다.`,
    };
  }

  /**
   * 턴 처리 시 사망 체크 (부상 + 노환)
   *
   * @param sessionId 세션 ID
   * @param general 장수
   * @param rng 난수 생성기
   * @returns 사망 여부
   */
  static async checkDeath(
    sessionId: string,
    general: IGeneral,
    rng: any
  ): Promise<DeathResult> {
    // 1. 부상으로 인한 사망 체크
    const injuryDeath = await this.checkInjuryDeath(sessionId, general, rng);
    if (injuryDeath.died) {
      return injuryDeath;
    }

    // 2. 노환으로 인한 사망 체크
    const oldAgeDeath = await this.checkOldAgeDeath(sessionId, general, rng);
    if (oldAgeDeath.died) {
      return oldAgeDeath;
    }

    return { died: false, cause: 'none', message: '' };
  }
}

export default InjuryService;













