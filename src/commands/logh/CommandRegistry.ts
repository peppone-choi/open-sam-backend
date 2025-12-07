/**
 * CommandRegistry - LOGH 커맨드 동적 로딩 레지스트리
 * 
 * 모든 strategic 및 tactical 커맨드를 자동으로 로드하고 매핑합니다.
 */

import { BaseLoghCommand } from './BaseLoghCommand';

// Strategic Commands
import * as StrategicCommands from './strategic';
import * as TacticalCommands from './tactical';

// Legacy Commands (기존 route에서 사용하던 것들)
import { MoveFleetCommand } from './MoveFleet';
import { IssueOperationCommand } from './IssueOperation';

type CommandConstructor = new () => BaseLoghCommand;

// Type guard to check if a value is a CommandConstructor
function isCommandConstructor(value: any): value is CommandConstructor {
  return typeof value === 'function' && value.prototype instanceof BaseLoghCommand;
}

class CommandRegistry {
  private commands: Map<string, CommandConstructor> = new Map();
  private commandInstances: Map<string, BaseLoghCommand> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * 모든 커맨드를 레지스트리에 등록
   */
  private initialize(): void {
    // Legacy commands (backward compatibility)
    this.registerCommand('move_fleet', MoveFleetCommand);
    this.registerCommand('issue_operation', IssueOperationCommand);

    // Strategic Commands (83개)
    this.registerCommand('air_tactical_training', StrategicCommands.AirTacticalTrainingCommand);
    this.registerCommand('air_training', StrategicCommands.AirTrainingCommand);
    this.registerCommand('alert_dispatch', StrategicCommands.AlertDispatchCommand);
    this.registerCommand('allocation', StrategicCommands.AllocationCommand);
    this.registerCommand('appointment', StrategicCommands.AppointmentCommand);
    this.registerCommand('armed_suppression', StrategicCommands.ArmedSuppressionCommand);
    this.registerCommand('arrest', StrategicCommands.ArrestCommand);
    this.registerCommand('arrest_order', StrategicCommands.ArrestOrderCommand);
    this.registerCommand('arrest_permit', StrategicCommands.ArrestPermitCommand);
    this.registerCommand('assault', StrategicCommands.AssaultCommand);
    this.registerCommand('budget_management', StrategicCommands.BudgetManagementCommand);
    this.registerCommand('complete_repair', StrategicCommands.CompleteRepairCommand);
    this.registerCommand('complete_supply', StrategicCommands.CompleteSupplyCommand);
    this.registerCommand('conference', StrategicCommands.ConferenceCommand);
    this.registerCommand('conspiracy', StrategicCommands.ConspiracyCommand);
    this.registerCommand('coup', StrategicCommands.CoupCommand);
    this.registerCommand('decoration', StrategicCommands.DecorationCommand);
    this.registerCommand('defection', StrategicCommands.DefectionCommand);
    this.registerCommand('demotion', StrategicCommands.DemotionCommand);
    this.registerCommand('diplomacy', StrategicCommands.DiplomacyCommand);
    this.registerCommand('discipline_maintenance', StrategicCommands.DisciplineMaintenanceCommand);
    this.registerCommand('dismissal', StrategicCommands.DismissalCommand);
    this.registerCommand('distribution', StrategicCommands.DistributionCommand);
    this.registerCommand('espionage', StrategicCommands.EspionageCommand);
    this.registerCommand('execution_order', StrategicCommands.ExecutionOrderCommand);
    this.registerCommand('fief_direct', StrategicCommands.FiefDirectCommand);
    this.registerCommand('fief_grant', StrategicCommands.FiefGrantCommand);
    this.registerCommand('flagship_change', StrategicCommands.FlagshipChangeCommand);
    this.registerCommand('flagship_purchase', StrategicCommands.FlagshipPurchaseCommand);
    this.registerCommand('fuel_supply', StrategicCommands.FuelSupplyCommand);
    this.registerCommand('fund_investment', StrategicCommands.FundInvestmentCommand);
    this.registerCommand('governance_goal', StrategicCommands.GovernanceGoalCommand);
    this.registerCommand('ground_forces_deploy', StrategicCommands.GroundForcesDeployCommand);
    this.registerCommand('ground_forces_withdraw', StrategicCommands.GroundForcesWithdrawCommand);
    this.registerCommand('ground_tactical_training', StrategicCommands.GroundTacticalTrainingCommand);
    this.registerCommand('ground_training', StrategicCommands.GroundTrainingCommand);
    this.registerCommand('hunting', StrategicCommands.HuntingCommand);
    this.registerCommand('infiltration', StrategicCommands.InfiltrationCommand);
    this.registerCommand('inspection', StrategicCommands.InspectionCommand);
    this.registerCommand('issue_order', StrategicCommands.IssueOrderCommand);
    this.registerCommand('join', StrategicCommands.JoinCommand);
    this.registerCommand('lecture', StrategicCommands.LectureCommand);
    this.registerCommand('long_distance_move', StrategicCommands.LongDistanceMoveCommand);
    this.registerCommand('mass_search', StrategicCommands.MassSearchCommand);
    this.registerCommand('meeting', StrategicCommands.MeetingCommand);
    this.registerCommand('national_goal', StrategicCommands.NationalGoalCommand);
    this.registerCommand('operation_plan', StrategicCommands.OperationPlanCommand);
    this.registerCommand('parade', StrategicCommands.ParadeCommand);
    this.registerCommand('peerage', StrategicCommands.PeerageCommand);
    this.registerCommand('persuasion', StrategicCommands.PersuasionCommand);
    this.registerCommand('politician_punishment', StrategicCommands.PoliticianPunishmentCommand);
    this.registerCommand('port', StrategicCommands.PortCommand);
    this.registerCommand('production', StrategicCommands.ProductionCommand);
    this.registerCommand('promotion', StrategicCommands.PromotionCommand);
    this.registerCommand('punishment', StrategicCommands.PunishmentCommand);
    this.registerCommand('rebellion_intention', StrategicCommands.RebellionIntentionCommand);
    this.registerCommand('reorganization', StrategicCommands.ReorganizationCommand);
    this.registerCommand('replenishment', StrategicCommands.ReplenishmentCommand);
    this.registerCommand('requisition', StrategicCommands.RequisitionCommand);
    this.registerCommand('resignation', StrategicCommands.ResignationCommand);
    this.registerCommand('retirement', StrategicCommands.RetirementCommand);
    this.registerCommand('revolt', StrategicCommands.RevoltCommand);
    this.registerCommand('sabotage', StrategicCommands.SabotageCommand);
    this.registerCommand('short_distance_move', StrategicCommands.ShortDistanceMoveCommand);
    this.registerCommand('soiree', StrategicCommands.SoireeCommand);
    this.registerCommand('space_training', StrategicCommands.SpaceTrainingCommand);
    this.registerCommand('special_promotion', StrategicCommands.SpecialPromotionCommand);
    this.registerCommand('special_security', StrategicCommands.SpecialSecurityCommand);
    this.registerCommand('speech', StrategicCommands.SpeechCommand);
    this.registerCommand('study', StrategicCommands.StudyCommand);
    this.registerCommand('surveillance', StrategicCommands.SurveillanceCommand);
    this.registerCommand('talk', StrategicCommands.TalkCommand);
    this.registerCommand('tariff_rate', StrategicCommands.TariffRateCommand);
    this.registerCommand('tax_rate', StrategicCommands.TaxRateCommand);
    this.registerCommand('transport', StrategicCommands.TransportCommand);
    this.registerCommand('transport_cancel', StrategicCommands.TransportCancelCommand);
    this.registerCommand('transport_plan', StrategicCommands.TransportPlanCommand);
    this.registerCommand('unit_dissolution', StrategicCommands.UnitDissolutionCommand);
    this.registerCommand('unit_formation', StrategicCommands.UnitFormationCommand);
    this.registerCommand('volunteer', StrategicCommands.VolunteerCommand);
    this.registerCommand('war_game', StrategicCommands.WarGameCommand);
    this.registerCommand('warp', StrategicCommands.WarpCommand);
    this.registerCommand('withdraw_operation', StrategicCommands.WithdrawOperationCommand);

    // Tactical Commands (14개) - now properly extend BaseTacticalCommand
    this.registerCommand('air_combat', TacticalCommands.AirCombatTacticalCommand);
    this.registerCommand('attack', TacticalCommands.AttackTacticalCommand);
    this.registerCommand('fire', TacticalCommands.FireTacticalCommand);
    this.registerCommand('formation', TacticalCommands.FormationTacticalCommand);
    this.registerCommand('ground_deploy', TacticalCommands.GroundDeployTacticalCommand);
    this.registerCommand('ground_withdraw', TacticalCommands.GroundWithdrawTacticalCommand);
    this.registerCommand('move', TacticalCommands.MoveTacticalCommand);
    this.registerCommand('parallel_move', TacticalCommands.ParallelMoveTacticalCommand);
    this.registerCommand('retreat', TacticalCommands.RetreatTacticalCommand);
    this.registerCommand('reverse', TacticalCommands.ReverseTacticalCommand);
    this.registerCommand('sortie', TacticalCommands.SortieTacticalCommand);
    this.registerCommand('stance_change', TacticalCommands.StanceChangeTacticalCommand);
    this.registerCommand('stop', TacticalCommands.StopTacticalCommand);
    this.registerCommand('turn', TacticalCommands.TurnTacticalCommand);

    console.log(`[CommandRegistry] Registered ${this.commands.size} commands`);
  }

  /**
   * 커맨드를 레지스트리에 등록
   */
  private registerCommand(name: string, CommandClass: CommandConstructor): void {
    this.commands.set(name, CommandClass);
  }

  /**
   * 커맨드 인스턴스 가져오기 (싱글톤 패턴)
   */
  getCommand(commandName: string): BaseLoghCommand | null {
    // 이미 인스턴스가 있으면 재사용
    if (this.commandInstances.has(commandName)) {
      return this.commandInstances.get(commandName)!;
    }

    // 생성자 가져오기
    const CommandClass = this.commands.get(commandName);
    if (!CommandClass) {
      console.warn(`[CommandRegistry] Unknown command: ${commandName}`);
      return null;
    }

    // 인스턴스 생성 및 캐싱
    const instance = new CommandClass();
    this.commandInstances.set(commandName, instance);
    return instance;
  }

  /**
   * 등록된 모든 커맨드 이름 목록
   */
  getAllCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 커맨드 존재 여부 확인
   */
  hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }

  /**
   * 카테고리별 커맨드 목록
   */
  getCommandsByCategory(category: 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin'): BaseLoghCommand[] {
    const results: BaseLoghCommand[] = [];
    
    const commandNames = Array.from(this.commands.keys());
    for (const name of commandNames) {
      const cmd = this.getCommand(name);
      if (cmd && cmd.getCategory() === category) {
        results.push(cmd);
      }
    }

    return results;
  }

  /**
   * 레지스트리 상태 정보
   */
  getStats(): { total: number; strategic: number; tactical: number; legacy: number } {
    let strategic = 0;
    let tactical = 0;
    let legacy = 0;

    const commandNames = Array.from(this.commands.keys());
    for (const name of commandNames) {
      const cmd = this.getCommand(name);
      if (!cmd) continue;

      const category = cmd.getCategory();
      if (category === 'strategic') strategic++;
      else if (category === 'tactical') tactical++;
      else if (name === 'move_fleet' || name === 'issue_operation') legacy++;
    }

    return {
      total: this.commands.size,
      strategic,
      tactical,
      legacy,
    };
  }
}

// 싱글톤 인스턴스
export const commandRegistry = new CommandRegistry();
