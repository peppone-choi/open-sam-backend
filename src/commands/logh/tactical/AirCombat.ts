/**
 * [전술] 공전 명령 (空戦命令, Air Combat)
 * 전투기/스파르타니안을 출격시켜 적 함대 공격
 * 
 * 기능:
 * - 항공모함에서 전투기 출격
 * - 적 함대에 대한 공대함 공격
 * - 적 전투기와의 공대공 전투
 * - 요격/호위 임무
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';

export class AirCombatTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'air_combat';
  }

  getDisplayName(): string {
    return '공전 명령';
  }

  getDescription(): string {
    return '항공모함에서 전투기를 출격시켜 적을 공격합니다. 공대함/공대공 전투를 수행합니다.';
  }

  getShortcut(): string {
    return 'a';
  }

  getExecutionDelay(): number {
    return 8; // 8 게임시간 (20초) - 전투기 출격 준비
  }

  getExecutionDuration(): number {
    return 0;
  }

  private hasCarrier(fleet: any): boolean {
    return fleet.ships.some((s: any) => 
      s.type === 'carrier' || 
      s.type === '항공모함' || 
      s.type.includes('carrier') ||
      s.type.includes('항모')
    );
  }

  private calculateAirPower(fleet: any): number {
    const carrierCount = fleet.ships.filter((s: any) => 
      s.type === 'carrier' || s.type === '항공모함'
    ).reduce((sum: number, s: any) => sum + (s.count || 0), 0);
    
    return carrierCount * 300; // 항공모함 1척당 전투기 300대 추정
  }

  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, targetFleetId, mission } = params;

    const fleet = await Fleet.findOne({ session_id: sessionId, fleetId });
    if (!fleet) return { success: false, message: '함대를 찾을 수 없습니다.' };
    if (!fleet.isInCombat) return { success: false, message: '전투 중이 아닙니다.' };
    if (!this.hasCarrier(fleet)) return { success: false, message: '항공모함이 없습니다.' };

    const airPower = this.calculateAirPower(fleet);
    if (airPower === 0) return { success: false, message: '출격 가능한 전투기가 없습니다.' };

    const targetFleet = await Fleet.findOne({ session_id: sessionId, fleetId: targetFleetId });
    if (!targetFleet) return { success: false, message: '목표를 찾을 수 없습니다.' };

    const missionType = mission || 'attack';
    const missionNames: Record<string, string> = {
      attack: '공격',
      intercept: '요격',
      escort: '호위',
      recon: '정찰',
    };

    if (!fleet.customData) fleet.customData = {};
    fleet.customData.airCombatActive = true;
    fleet.customData.airCombatTarget = targetFleetId;
    fleet.customData.airCombatMission = missionType;
    fleet.customData.airCombatPower = airPower;

    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'air_combat',
      target: targetFleet.name,
      mission: missionType,
      airPower,
    });

    await fleet.save();

    return { 
      success: true, 
      message: `전투기 ${airPower}대를 출격시켜 "${targetFleet.name}"에 대한 ${missionNames[missionType]} 임무를 수행합니다.` 
    };
  }
}
