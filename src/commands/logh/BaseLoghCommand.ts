/**
 * BaseLoghCommand - 은하영웅전설 커맨드 기반 클래스
 *
 * 모든 LOGH 커맨드는 이 클래스를 상속합니다.
 */

import { IConstraint } from '../../constraints/ConstraintHelper';

export interface ILoghCommandExecutor {
  no: number; // Commander ID
  session_id: string;
  data: any; // Commander data object (name, supplies, position, etc.)
  
  // 기본 속성
  name?: string; // 캐릭터 이름
  faction?: 'empire' | 'alliance' | 'neutral'; // 세력
  fame?: number; // 명성
  jobPosition?: string; // 직위 (황제, 원수, 대장, 등)
  
  getVar(key: string): any;
  setVar(key: string, value: any): void;
  increaseVar(key: string, value: number): void;
  decreaseVar(key: string, value: number): void;
  getNationID(): number;
  getFactionType(): 'empire' | 'alliance';
  getRank(): number; // 계급 번호 (숫자)
  getRankName?(): string; // 계급 이름 (문자열)
  getCommandPoints(): number;
  consumeCommandPoints(amount: number): void;
  getFleetId(): string | null;
  getPosition(): { x: number; y: number; z: number };
  startCommand(commandType: string, durationMs: number, data?: any): void;
  save(): Promise<any>;
}

export interface ILoghCommandContext {
  commander: ILoghCommandExecutor;
  fleet?: any;
  targetPlanet?: any;
  targetFleet?: any;
  session: any;
  env: any;
}

export abstract class BaseLoghCommand {
  /**
   * 커맨드 고유 이름 (영문)
   */
  abstract getName(): string;

  /**
   * 커맨드 표시 이름 (한국어)
   */
  abstract getDisplayName(): string;

  /**
   * 커맨드 설명
   */
  abstract getDescription(): string;

  /**
   * 커맨드 카테고리
   */
  abstract getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin';

  /**
   * 필요한 커맨드 포인트
   */
  abstract getRequiredCommandPoints(): number;

  /**
   * 소요 턴 수
   */
  abstract getRequiredTurns(): number;

  /**
   * 실행 제약 조건
   */
  getConstraints(): IConstraint[] {
    return [];
  }

  /**
   * 실행 가능 여부 체크
   */
  async checkConditionExecutable(context: ILoghCommandContext): Promise<string | null> {
    const constraints = this.getConstraints();

    for (const constraint of constraints) {
      const result = constraint.test(context, context.env);
      if (result !== null) {
        return result; // 실행 불가 사유 반환
      }
    }

    // 커맨드 포인트 체크
    const requiredCP = this.getRequiredCommandPoints();
    const currentCP = context.commander.getCommandPoints();

    if (currentCP < requiredCP) {
      return `커맨드 포인트가 부족합니다. (필요: ${requiredCP}, 보유: ${currentCP})`;
    }

    return null; // 실행 가능
  }

  /**
   * 커맨드 실행
   */
  abstract execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }>;

  /**
   * 턴 종료 시 실행 (스케줄된 커맨드용)
   */
  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 기본 구현: 아무것도 하지 않음
    // 서브클래스에서 필요시 오버라이드
  }
}
