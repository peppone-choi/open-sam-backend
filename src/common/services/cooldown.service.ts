import { NationEnvRepository } from '../../api/nation-env/repository/nation-env.repository';

/**
 * 쿨다운 서비스
 * 
 * 국가 전략 커맨드의 재사용 대기 시간 관리
 */
export class CooldownService {
  private nationEnvRepo: NationEnvRepository;

  constructor() {
    this.nationEnvRepo = new NationEnvRepository();
  }

  /**
   * 커맨드 실행 가능 여부 확인
   */
  async canExecute(
    nationId: string,
    commandKey: string,
    currentTurn: number
  ): Promise<boolean> {
    const key = `next_execute_${commandKey}`;
    const env = await this.nationEnvRepo.findByNamespaceAndKey(
      parseInt(nationId),
      key
    );

    if (!env) {
      return true;
    }

    const nextTurn = env.value as number;
    return currentTurn >= nextTurn;
  }

  /**
   * 다음 실행 가능 턴 설정
   */
  async setNext(
    nationId: string,
    commandKey: string,
    nextTurn: number
  ): Promise<void> {
    const key = `next_execute_${commandKey}`;
    await this.nationEnvRepo.upsert(parseInt(nationId), key, nextTurn);
  }

  /**
   * 재사용 대기 시간 계산
   * delay = round(sqrt(genNum × coefficient) × 10)
   */
  calculateDelay(genNum: number, coefficient: number): number {
    return Math.round(Math.sqrt(genNum * coefficient) * 10);
  }

  /**
   * 쿨다운 적용 (현재 턴 + 딜레이)
   */
  async applyCooldown(
    nationId: string,
    commandKey: string,
    currentTurn: number,
    genNum: number,
    coefficient: number
  ): Promise<number> {
    const delay = this.calculateDelay(genNum, coefficient);
    const nextTurn = currentTurn + delay;
    await this.setNext(nationId, commandKey, nextTurn);
    return delay;
  }

  /**
   * 남은 턴 수 조회
   */
  async getRemainingTurns(
    nationId: string,
    commandKey: string,
    currentTurn: number
  ): Promise<number> {
    const key = `next_execute_${commandKey}`;
    const env = await this.nationEnvRepo.findByNamespaceAndKey(
      parseInt(nationId),
      key
    );

    if (!env) {
      return 0;
    }

    const nextTurn = env.value as number;
    const remaining = nextTurn - currentTurn;
    return Math.max(0, remaining);
  }

  /**
   * 쿨다운 제거
   */
  async removeCooldown(
    nationId: string,
    commandKey: string
  ): Promise<void> {
    const key = `next_execute_${commandKey}`;
    const env = await this.nationEnvRepo.findByNamespaceAndKey(
      parseInt(nationId),
      key
    );

    if (env && env.id) {
      await this.nationEnvRepo.delete(env.id);
    }
  }
}
