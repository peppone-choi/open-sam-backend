/**
 * [전술] 육전대 배치 (陸戦隊出撃, Ground Deploy)
 * 육전대를 행성/요새로 강하/배치
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class GroundDeployTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'ground_deploy';
  }

  getDisplayName(): string {
    return '육전대 배치';
  }

  getDescription(): string {
    return '함대의 육전대를 행성에 배치합니다. 양륙함이 필요하며, 행성 점령 작전에 사용됩니다.';
  }

  getShortcut(): string {
    return 'g';
  }

  getExecutionDelay(): number {
    return 15;
  }

  getExecutionDuration(): number {
    return 30;
  }

  private hasGroundTroops(fleet: any): boolean {
    return fleet.groundTroops && fleet.groundTroops.length > 0;
  }

  private hasLandingCraft(fleet: any): boolean {
    return fleet.ships.some((s: any) => 
      s.type === 'landing_craft' || s.type === '양륙함' || s.type.includes('landing')
    );
  }

  async executeTactical(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, targetPlanetId, troopCount } = params;

    const fleet = await Fleet.findOne({ session_id: sessionId, fleetId });
    if (!fleet) return { success: false, message: '함대를 찾을 수 없습니다.' };
    if (!this.hasGroundTroops(fleet)) return { success: false, message: '육전대를 보유하고 있지 않습니다.' };
    if (!this.hasLandingCraft(fleet)) return { success: false, message: '양륙함이 필요합니다.' };

    const planet = await Planet.findOne({ session_id: sessionId, planetId: targetPlanetId });
    if (!planet) return { success: false, message: '행성을 찾을 수 없습니다.' };

    const deployCount = Math.min(troopCount || fleet.totalGroundTroops || 0, fleet.totalGroundTroops || 0);
    
    if (!planet.garrison) planet.garrison = { troops: [], totalTroops: 0, morale: 70, training: 50 };
    
    const deployed = fleet.groundTroops!.slice(0, deployCount);
    fleet.groundTroops = fleet.groundTroops!.slice(deployCount);
    fleet.totalGroundTroops = fleet.groundTroops.length;
    
    planet.garrison.troops.push(...deployed);
    planet.garrison.totalTroops += deployCount;

    await fleet.save();
    await planet.save();

    return { success: true, message: `육전대 ${deployCount} 유닛을 ${planet.name}에 배치했습니다.` };
  }
}
