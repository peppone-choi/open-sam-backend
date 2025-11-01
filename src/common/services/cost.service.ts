import { GameBalance } from '../constants/game-balance';
import { HttpException } from '../errors/HttpException';

/**
 * 비용 처리 모드
 */
export enum CostMode {
  /** 실제로 비용 차감 */
  CONSUME = 'CONSUME',
  /** 비용 검증만 (차감하지 않음) */
  REQUIRE_ONLY = 'REQUIRE_ONLY',
}

/**
 * 비용 정보
 */
export interface Cost {
  gold: number;
  rice: number;
}

/**
 * 자원 보유자 인터페이스
 */
export interface ResourceHolder {
  gold: number;
  rice: number;
}

/**
 * 비용 서비스
 * 
 * 커맨드 실행 시 필요한 자원(금, 쌀) 검증 및 차감 처리
 */
export class CostService {
  /**
   * 비용 검증 (충분한 자원이 있는지 확인)
   */
  static validate(holder: ResourceHolder, cost: Cost): void {
    if (holder.gold < cost.gold) {
      throw new HttpException(400, `금이 부족합니다. 필요: ${cost.gold}, 보유: ${holder.gold}`);
    }
    if (holder.rice < cost.rice) {
      throw new HttpException(400, `쌀이 부족합니다. 필요: ${cost.rice}, 보유: ${holder.rice}`);
    }
  }

  /**
   * 비용 차감
   */
  static consume(holder: ResourceHolder, cost: Cost): void {
    this.validate(holder, cost);
    holder.gold -= cost.gold;
    holder.rice -= cost.rice;

    // 최소값 보장
    holder.gold = Math.max(holder.gold, GameBalance.minNationalGold);
    holder.rice = Math.max(holder.rice, GameBalance.minNationalRice);
  }

  /**
   * 비용 처리 (모드에 따라 검증만 또는 차감)
   */
  static process(holder: ResourceHolder, cost: Cost, mode: CostMode): void {
    if (mode === CostMode.REQUIRE_ONLY) {
      this.validate(holder, cost);
    } else {
      this.consume(holder, cost);
    }
  }

  /**
   * 자원 추가
   */
  static add(holder: ResourceHolder, gold: number, rice: number): void {
    holder.gold += gold;
    holder.rice += rice;
  }

  /**
   * 커맨드별 비용 계산
   */
  static getCost(commandType: string, params?: any): Cost {
    const develCost = GameBalance.develCost;

    switch (commandType) {
      // 내정 (금만 소비)
      case 'DEVELOP_AGRICULTURE':
      case 'DEVELOP_COMMERCE':
      case 'STRENGTHEN_DEFENSE':
      case 'REPAIR_WALL':
      case 'STRENGTHEN_SECURITY':
        return { gold: develCost, rice: 0 };

      case 'RESEARCH_TECH':
        return { gold: develCost + 5, rice: 0 };

      // 내정 (쌀만 소비)
      case 'ENCOURAGE_SETTLEMENT':
      case 'IMPROVE_TRUST':
        return { gold: 0, rice: develCost * 2 };

      // 이동
      case 'MOVE':
        return { gold: develCost, rice: 0 };

      case 'FORCE_MARCH':
        return { gold: develCost * 5, rice: 0 };

      // 계략
      case 'AGITATE':
      case 'SEIZE':
      case 'SABOTAGE':
      case 'FIRE_ATTACK':
        return { gold: 120, rice: 120 };

      // 첩보
      case 'ESPIONAGE':
        return { gold: 72, rice: 72 };

      // 사기진작 (병력 수에 따라)
      case 'BOOST_MORALE':
        const crew = params?.crew || 0;
        return { gold: Math.round(crew / 100), rice: 0 };

      // 징병/모병 (동적 계산)
      case 'CONSCRIPT':
      case 'RECRUIT':
        // 실제 비용은 MilitaryService에서 계산
        return { gold: 0, rice: 0 };

      // 비용 없음
      case 'REST':
      case 'RECOVER':
      case 'RETIRE':
      case 'RETURN':
      case 'BORDER_RETURN':
      case 'JOIN_NATION':
      case 'RANDOM_JOIN':
      case 'JOIN_GENERAL_NATION':
      case 'LEAVE_NATION':
      case 'ABDICATE':
      case 'DONATE':
      case 'TRIBUTE':
      case 'WITHDRAW':
        return { gold: 0, rice: 0 };

      // 훈련/단련
      case 'TRAIN':
      case 'PRACTICE':
        return { gold: develCost, rice: develCost };

      // 숙련전환
      case 'CONVERT_DEX':
        return { gold: develCost, rice: develCost };

      // 기본값
      default:
        return { gold: 0, rice: 0 };
    }
  }
}
