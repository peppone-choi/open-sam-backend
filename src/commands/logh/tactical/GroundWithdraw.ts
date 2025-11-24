/**
 * [전술] 육전대 철수 (陸戦隊撤収, Ground Withdraw)
 * 강하/출격한 육전대 철수(탑재)
 */

import { BaseTacticalCommand } from './BaseTacticalCommand';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class GroundWithdrawTacticalCommand extends BaseTacticalCommand {
  getName(): string {
    return 'ground_withdraw';
  }

  getDisplayName(): string {
    return '육전대 철수';
  }

  getDescription(): string {
    return '행성에 배치된 육전대를 함대로 회수합니다. 양륙함이 필요합니다.';
  }

  getShortcut(): string {
    return 'h';
  }

  getExecutionDelay(): number {
    return 10;
  }

  getExecutionDuration(): number {
    return 20;
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
    const { sessionId, sourcePlanetId, troopCount } = params;

    const fleet = await Fleet.findOne({ session_id: sessionId, fleetId });
    if (!fleet) return { success: false, message: '함대를 찾을 수 없습니다.' };
    if (!this.hasLandingCraft(fleet)) return { success: false, message: '양륙함이 필요합니다.' };

    const planet = await Planet.findOne({ session_id: sessionId, planetId: sourcePlanetId });
    if (!planet || !planet.garrison) return { success: false, message: '철수할 육전대가 없습니다.' };

    const withdrawCount = Math.min(troopCount || planet.garrison.totalTroops, planet.garrison.totalTroops);
    
    const withdrawn = planet.garrison.troops.slice(0, withdrawCount);
    planet.garrison.troops = planet.garrison.troops.slice(withdrawCount);
    planet.garrison.totalTroops = planet.garrison.troops.length;
    
    if (!fleet.groundTroops) fleet.groundTroops = [];
    fleet.groundTroops.push(...withdrawn);
    fleet.totalGroundTroops = fleet.groundTroops.length;

    await fleet.save();
    await planet.save();

    return { success: true, message: `${planet.name}에서 육전대 ${withdrawCount} 유닛을 철수했습니다.` };
  }
}
