/**
 * Commander Wrapper for Command Execution
 * ILoghCommandExecutor 인터페이스 구현
 */

import { ILoghCommander } from './Commander.model';
import { ILoghCommandExecutor } from '../../commands/logh/BaseLoghCommand';

export class CommanderWrapper implements ILoghCommandExecutor {
  private commander: ILoghCommander;

  constructor(commander: ILoghCommander) {
    this.commander = commander;
  }

  get no(): number {
    return this.commander.no;
  }

  get session_id(): string {
    return this.commander.session_id;
  }

  getVar(key: string): any {
    return this.commander.customData?.[key];
  }

  setVar(key: string, value: any): void {
    if (!this.commander.customData) {
      this.commander.customData = {};
    }
    this.commander.customData[key] = value;
    this.commander.markModified('customData');
  }

  increaseVar(key: string, value: number): void {
    const current = this.getVar(key) || 0;
    this.setVar(key, current + value);
  }

  decreaseVar(key: string, value: number): void {
    const current = this.getVar(key) || 0;
    this.setVar(key, current - value);
  }

  getNationID(): number {
    // LOGH는 faction 기반이므로 faction을 숫자로 변환
    return this.commander.faction === 'empire' ? 1 : 2;
  }

  getFactionType(): 'empire' | 'alliance' {
    return this.commander.faction;
  }

  getRank(): string {
    return this.commander.rank;
  }

  getCommandPoints(): number {
    return this.commander.commandPoints;
  }

  consumeCommandPoints(amount: number): void {
    this.commander.commandPoints = Math.max(0, this.commander.commandPoints - amount);
  }

  getFleetId(): string | null {
    return this.commander.fleetId || null;
  }

  getPosition(): { x: number; y: number; z: number } {
    return this.commander.position;
  }

  async save(): Promise<any> {
    return await this.commander.save();
  }

  /**
   * 원본 Commander 문서 접근
   */
  getDocument(): ILoghCommander {
    return this.commander;
  }

  /**
   * 커맨드 시작 (즉시 실행, 완료까지 시간 소요)
   */
  startCommand(commandType: string, durationMs: number, data: any = {}): void {
    const now = new Date();
    const completesAt = new Date(now.getTime() + durationMs);

    this.commander.activeCommands.push({
      commandType,
      startedAt: now,
      completesAt,
      data,
    });

    this.commander.markModified('activeCommands');
  }

  /**
   * 완료된 커맨드 가져오기 및 제거
   */
  getCompletedCommands(): Array<{ commandType: string; data: any }> {
    const now = new Date();
    const completed: Array<{ commandType: string; data: any }> = [];
    const remaining = [];

    for (const cmd of this.commander.activeCommands) {
      if (cmd.completesAt <= now) {
        completed.push({
          commandType: cmd.commandType,
          data: cmd.data,
        });
      } else {
        remaining.push(cmd);
      }
    }

    this.commander.activeCommands = remaining;
    this.commander.markModified('activeCommands');

    return completed;
  }

  /**
   * CP 회복 (2 게임시간마다 = 실시간 5분)
   * 전술 게임 중이 아닐 때만
   */
  regenerateCP(baseAmount: number = 1): void {
    // 정치, 운영 능력에 따라 회복량 증가
    const politics = this.commander.stats.politics || 50;
    const bonus = Math.floor(politics / 20); // 정치 20당 +1 CP
    
    const maxCP = 100; // 최대 CP
    const regenAmount = baseAmount + bonus;

    this.commander.commandPoints = Math.min(
      maxCP,
      this.commander.commandPoints + regenAmount
    );
  }
}
