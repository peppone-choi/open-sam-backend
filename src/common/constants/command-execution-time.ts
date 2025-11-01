import { CommandType } from '../../api/command/@types/command.types';

/**
 * 커맨드 실행 시간 (초)
 * 실시간 모드에서 각 커맨드의 대기 시간
 */
export const COMMAND_EXECUTION_TIME: Record<CommandType, number> = {
  // 개인 커맨드
  [CommandType.REST]: 60,
  [CommandType.CURE]: 180,
  [CommandType.DRILL]: 300,
  [CommandType.CONVERT_MASTERY]: 240,
  [CommandType.ADVENTURE]: 600,
  [CommandType.RETIRE]: 0,
  [CommandType.TRADE_EQUIPMENT]: 120,
  [CommandType.TRADE_SUPPLY]: 60,
  [CommandType.RESET_DOMESTIC_SKILL]: 0,
  [CommandType.RESET_BATTLE_SKILL]: 0,

  // 내정 커맨드
  [CommandType.DEVELOP_AGRICULTURE]: 300,
  [CommandType.INVEST_COMMERCE]: 300,
  [CommandType.RESEARCH_TECH]: 360,
  [CommandType.FORTIFY_DEFENSE]: 300,
  [CommandType.REPAIR_WALL]: 240,
  [CommandType.IMPROVE_SECURITY]: 300,
  [CommandType.ENCOURAGE_SETTLEMENT]: 360,
  [CommandType.GOVERN_PEOPLE]: 360,

  // 군사 커맨드
  [CommandType.CONSCRIPT]: 300,
  [CommandType.RECRUIT]: 300,
  [CommandType.TRAIN]: 300,
  [CommandType.BOOST_MORALE]: 240,
  [CommandType.DEPLOY]: 600,
  [CommandType.ASSEMBLE]: 300,
  [CommandType.DISMISS_TROOPS]: 120,
  [CommandType.SPY]: 360,

  // 인사 커맨드
  [CommandType.MOVE]: 300,
  [CommandType.FORCE_MARCH]: 180,
  [CommandType.SEARCH_TALENT]: 300,
  [CommandType.RECRUIT_GENERAL]: 360,

  // 계략 커맨드
  [CommandType.AGITATE]: 360,
  [CommandType.PLUNDER]: 360,
  [CommandType.SABOTAGE]: 360,
  [CommandType.ARSON]: 360,

  // 국가 커맨드
  [CommandType.GRANT]: 60,
  [CommandType.TRIBUTE]: 120,
  [CommandType.REQUISITION]: 120,
  [CommandType.ABDICATE]: 0,

  // 사령부 커맨드
  [CommandType.APPOINT]: 0,
  [CommandType.REWARD]: 60,
  [CommandType.CONFISCATE]: 60,
  [CommandType.ORDER_LEAVE_UNIT]: 0,
  [CommandType.DIPLOMACY]: 180,
  [CommandType.AID]: 120,
  [CommandType.NON_AGGRESSION_PACT]: 180,
  [CommandType.DECLARE_WAR]: 0,
  [CommandType.PROPOSE_PEACE]: 180,
  [CommandType.BREAK_PACT]: 0,
  [CommandType.SCORCHED_EARTH]: 600,
  [CommandType.RELOCATE_CAPITAL]: 720,
  [CommandType.EXPAND_FACILITY]: 1200,
  [CommandType.REDUCE_FACILITY]: 600,

  // 전략 커맨드
  [CommandType.DO_OR_DIE]: 300,
  [CommandType.MOBILIZE_PEOPLE]: 360,
  [CommandType.FLOOD]: 720,
  [CommandType.FEINT]: 300,
  [CommandType.RECRUIT_MILITIA]: 300,
  [CommandType.TWO_TIGERS]: 600,
  [CommandType.RAID]: 480,
  [CommandType.COUNTER_STRATEGY]: 480,

  // 기타
  [CommandType.CHANGE_FLAG]: 0,
  [CommandType.CHANGE_NAME]: 0,
};

/**
 * 커맨드 실행 시간 조회
 */
export function getExecutionTime(commandType: CommandType): number {
  return COMMAND_EXECUTION_TIME[commandType] || 300; // 기본 5분
}
