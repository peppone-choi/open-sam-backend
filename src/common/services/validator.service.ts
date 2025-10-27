import { HttpException } from '../errors/HttpException';
import { GameBalance } from '../constants/game-balance';

/**
 * 장수 인터페이스 (검증용)
 */
export interface GeneralForValidation {
  id: string;
  nation?: string;
  city?: string;
  crew: number;
  crewType: number;
  gold: number;
  rice: number;
  injury: number;
  leadership: number;
  strength: number;
  intel: number;
}

/**
 * 도시 인터페이스 (검증용)
 */
export interface CityForValidation {
  id: string;
  nation?: string;
  pop: number;
  trust: number;
  agri: number;
  comm: number;
  secu: number;
  def: number;
  wall: number;
}

/**
 * 유닛 인터페이스 (검증용)
 */
export interface UnitForValidation {
  crew: number;
  crewType: number;
  train: number;
  atmos: number;
}

/**
 * 검증 서비스
 * 
 * 커맨드 실행 전 전제조건 검증
 */
export class ValidatorService {
  /**
   * 내정 커맨드 전제조건 검증
   */
  static validateDomesticPreconditions(
    general: GeneralForValidation,
    city: CityForValidation
  ): void {
    // 장수가 도시에 있는지 확인
    if (general.city !== city.id) {
      throw new HttpException(400, '해당 도시에 있지 않습니다.');
    }

    // 장수가 국가에 속해있는지 확인
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }

    // 도시가 자국 도시인지 확인
    if (city.nation !== general.nation) {
      throw new HttpException(400, '자국 도시가 아닙니다.');
    }

    // 부상 확인
    if (general.injury > 0) {
      throw new HttpException(400, '부상 상태에서는 내정을 할 수 없습니다.');
    }

    // 민심 확인
    if (city.trust < GameBalance.develRate) {
      throw new HttpException(400, `민심이 ${GameBalance.develRate} 이상이어야 합니다.`);
    }
  }

  /**
   * 군사 커맨드 전제조건 검증 (훈련, 사기진작)
   */
  static validateMilitaryPreconditions(
    general: GeneralForValidation,
    unit?: UnitForValidation
  ): void {
    // 장수가 국가에 속해있는지 확인
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }

    // 부상 확인
    if (general.injury > 0) {
      throw new HttpException(400, '부상 상태에서는 군사 활동을 할 수 없습니다.');
    }

    // 병사 확인
    if (unit && unit.crew <= 0) {
      throw new HttpException(400, '병사가 없습니다.');
    }
  }

  /**
   * 징병/모병 전제조건 검증
   */
  static validateRecruitPreconditions(
    general: GeneralForValidation,
    city: CityForValidation,
    amount: number,
    costOffset: number = 1
  ): void {
    // 기본 검증
    this.validateDomesticPreconditions(general, city);

    // 인구 확인
    if (city.pop < GameBalance.minAvailableRecruitPop) {
      throw new HttpException(400, `인구가 ${GameBalance.minAvailableRecruitPop} 이상이어야 합니다.`);
    }

    // 병력 수 확인
    if (amount <= 0) {
      throw new HttpException(400, '징병/모병 수는 0보다 커야 합니다.');
    }

    // 인구 부족 확인
    if (city.pop < amount) {
      throw new HttpException(400, '인구가 부족합니다.');
    }
  }

  /**
   * 이동 전제조건 검증
   */
  static validateMovement(
    general: GeneralForValidation,
    fromCity: CityForValidation,
    toCity: CityForValidation,
    distance: number,
    maxDistance: number = 1
  ): void {
    // 장수가 출발 도시에 있는지 확인
    if (general.city !== fromCity.id) {
      throw new HttpException(400, '출발 도시에 있지 않습니다.');
    }

    // 장수가 국가에 속해있는지 확인
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }

    // 출발 도시가 자국 도시인지 확인
    if (fromCity.nation !== general.nation) {
      throw new HttpException(400, '자국 도시가 아닙니다.');
    }

    // 목적지 도시가 자국 도시인지 확인
    if (toCity.nation !== general.nation) {
      throw new HttpException(400, '목적지가 자국 도시가 아닙니다.');
    }

    // 거리 확인
    if (distance > maxDistance) {
      throw new HttpException(400, `최대 ${maxDistance}칸까지만 이동할 수 있습니다.`);
    }

    // 부상 확인
    if (general.injury > 0) {
      throw new HttpException(400, '부상 상태에서는 이동할 수 없습니다.');
    }
  }

  /**
   * 계략 전제조건 검증
   */
  static validateSabotage(
    general: GeneralForValidation,
    targetCity: CityForValidation
  ): void {
    // 장수가 국가에 속해있는지 확인
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }

    // 부상 확인
    if (general.injury > 0) {
      throw new HttpException(400, '부상 상태에서는 계략을 사용할 수 없습니다.');
    }

    // 목표 도시가 적국인지 확인
    if (targetCity.nation === general.nation) {
      throw new HttpException(400, '자국 도시에는 계략을 사용할 수 없습니다.');
    }

    // 비용 확인
    if (general.gold < 120) {
      throw new HttpException(400, '금이 부족합니다. (필요: 120)');
    }

    if (general.rice < 120) {
      throw new HttpException(400, '쌀이 부족합니다. (필요: 120)');
    }
  }

  /**
   * 자원 확인 (금, 쌀)
   */
  static validateResources(
    general: GeneralForValidation,
    requiredGold: number,
    requiredRice: number
  ): void {
    if (general.gold < requiredGold) {
      throw new HttpException(400, `금이 부족합니다. (필요: ${requiredGold}, 보유: ${general.gold})`);
    }

    if (general.rice < requiredRice) {
      throw new HttpException(400, `쌀이 부족합니다. (필요: ${requiredRice}, 보유: ${general.rice})`);
    }
  }

  /**
   * 국가 소속 확인
   */
  static validateNationMembership(general: GeneralForValidation): void {
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }
  }

  /**
   * 부상 상태 확인
   */
  static validateInjury(general: GeneralForValidation): void {
    if (general.injury > 0) {
      throw new HttpException(400, '부상 상태에서는 이 활동을 할 수 없습니다.');
    }
  }

  /**
   * 도시 소속 확인
   */
  static validateCityOwnership(
    general: GeneralForValidation,
    city: CityForValidation
  ): void {
    if (!general.nation) {
      throw new HttpException(400, '국가에 소속되어 있지 않습니다.');
    }

    if (city.nation !== general.nation) {
      throw new HttpException(400, '자국 도시가 아닙니다.');
    }
  }
}
