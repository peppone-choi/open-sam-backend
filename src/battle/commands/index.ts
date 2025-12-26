/**
 * 전투 명령 모듈 export
 */

export {
  BattleCommand,
  BattleCommandType,
  CommandResult,
  CommandContext,
  CommandRequirement
} from './BattleCommand';

export { AttackCommand } from './AttackCommand';
export { MoveCommand } from './MoveCommand';
export { AmbushCommand } from './AmbushCommand';
export { FireAttackCommand } from './FireAttackCommand';
export { RockDropCommand } from './RockDropCommand';
export { EmergencyRetreatCommand } from './EmergencyRetreatCommand';
export { ChargeCommand } from './ChargeCommand';
export { DefendCommand } from './DefendCommand';

// 명령 인스턴스 생성 팩토리
import { BattleCommand, BattleCommandType } from './BattleCommand';
import { AttackCommand } from './AttackCommand';
import { MoveCommand } from './MoveCommand';
import { AmbushCommand } from './AmbushCommand';
import { FireAttackCommand } from './FireAttackCommand';
import { RockDropCommand } from './RockDropCommand';
import { EmergencyRetreatCommand } from './EmergencyRetreatCommand';
import { ChargeCommand } from './ChargeCommand';
import { DefendCommand } from './DefendCommand';

const commandRegistry: Map<BattleCommandType, BattleCommand> = new Map();

export function getCommand(type: BattleCommandType): BattleCommand | null {
  if (!commandRegistry.has(type)) {
    switch (type) {
      case BattleCommandType.ATTACK:
        commandRegistry.set(type, new AttackCommand());
        break;
      case BattleCommandType.MOVE:
        commandRegistry.set(type, new MoveCommand());
        break;
      case BattleCommandType.AMBUSH:
        commandRegistry.set(type, new AmbushCommand());
        break;
      case BattleCommandType.FIRE_ATTACK:
        commandRegistry.set(type, new FireAttackCommand());
        break;
      case BattleCommandType.ROCK_DROP:
        commandRegistry.set(type, new RockDropCommand());
        break;
      case BattleCommandType.EMERGENCY_RETREAT:
        commandRegistry.set(type, new EmergencyRetreatCommand());
        break;
      case BattleCommandType.CHARGE:
        commandRegistry.set(type, new ChargeCommand());
        break;
      case BattleCommandType.DEFEND:
        commandRegistry.set(type, new DefendCommand());
        break;
      default:
        return null;
    }
  }
  return commandRegistry.get(type) ?? null;
}

export function getAllCommands(): BattleCommand[] {
  const types = Object.values(BattleCommandType);
  return types.map(t => getCommand(t)).filter((c): c is BattleCommand => c !== null);
}
