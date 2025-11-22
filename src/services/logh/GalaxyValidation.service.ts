import { Fleet } from '../../models/logh/Fleet.model';
import {
  GalaxyCharacter,
  IGalaxyCharacter,
} from '../../models/logh/GalaxyCharacter.model';
import {
  GalaxySession,
  IGalaxySession,
  GalaxyFactionCode,
} from '../../models/logh/GalaxySession.model';
import { MapGrid } from '../../models/logh/MapGrid.model';

export interface CommandPointCost {
  pcp?: number;
  mcp?: number;
}

export interface TerrainAssessment {
  terrainType: string;
  hazardLevel: number;
  impassable: boolean;
  coordinates: { x: number; y: number };
}

export class GalaxyValidationService {
  static ensureSessionCapacity(
    session: IGalaxySession,
    faction: GalaxyFactionCode
  ): void {
    if (session.activePlayers >= session.maxPlayers) {
      throw new Error('Session has reached the maximum capacity of 2000 players.');
    }

    const factionSlot = session.factions.find((slot) => slot.name === faction);
    if (!factionSlot) {
      throw new Error(`Faction slot not configured for ${faction}.`);
    }

    if (factionSlot.activePlayers >= factionSlot.slots) {
      throw new Error(`Faction ${faction} is currently locked due to slot limit.`);
    }
  }

  static enforceReentryPolicy(
    session: IGalaxySession,
    existingCharacter: IGalaxyCharacter | null,
    nextFaction: GalaxyFactionCode,
    originType: 'original' | 'generated'
  ): void {
    if (existingCharacter) {
      if (
        session.reentryPolicy.factionLock &&
        existingCharacter.faction !== nextFaction
      ) {
        throw new Error('Faction lock active. Re-entry must use the previous faction.');
      }

      if (
        originType === 'original' &&
        session.reentryPolicy.allowOriginalCharacter === false
      ) {
        throw new Error('Original characters cannot be reused in this session.');
      }
    }
  }

  static applyCommandPointCost(
    character: IGalaxyCharacter,
    cost: CommandPointCost
  ): { substituted: boolean } {
    const result = { substituted: false };
    const pcpCost = cost.pcp ?? 0;
    const mcpCost = cost.mcp ?? 0;

    if (pcpCost > 0) {
      result.substituted =
        this.consumeCostWithSubstitution(character, 'pcp', pcpCost) ||
        result.substituted;
    }

    if (mcpCost > 0) {
      result.substituted =
        this.consumeCostWithSubstitution(character, 'mcp', mcpCost) ||
        result.substituted;
    }

    return result;
  }

  private static consumeCostWithSubstitution(
    character: IGalaxyCharacter,
    primary: 'pcp' | 'mcp',
    amount: number
  ): boolean {
    const secondary: 'pcp' | 'mcp' = primary === 'pcp' ? 'mcp' : 'pcp';
    const gauge = character.commandPoints;
    if (gauge[primary] >= amount) {
      gauge[primary] -= amount;
      return false;
    }

    const deficit = amount - gauge[primary];
    gauge[primary] = 0;
    const substitutionCost = deficit * 2; // Manual Chapter3 Command Points
    if (gauge[secondary] < substitutionCost) {
      throw new Error('Insufficient Command Points even with substitution.');
    }

    gauge[secondary] -= substitutionCost;
    return true;
  }

  static async verifyGridEntryLimit(
    sessionId: string,
    target: { x: number; y: number },
    faction: GalaxyFactionCode,
    incomingUnits: number
  ): Promise<void> {
    const terrain = await this.assessTerrain(sessionId, target);
    if (terrain.impassable) {
      throw new Error(
        `Grid (${terrain.coordinates.x},${terrain.coordinates.y}) is impassable due to ${terrain.terrainType}.`
      );
    }

    const fleets = await Fleet.find({
      session_id: sessionId,
      'strategicPosition.x': target.x,
      'strategicPosition.y': target.y,
    });

    const factionUnits = fleets
      .filter((fleet) => fleet.faction === faction)
      .reduce((sum, fleet) => sum + (fleet.totalShips || 0), 0);

    if (factionUnits + incomingUnits > 300) {
      throw new Error('Grid unit capacity exceeded (max 300 per faction).');
    }

    const factions = new Set<string>(fleets.map((fleet) => fleet.faction));
    factions.add(faction);

    if (factions.size > 2) {
      throw new Error(
        'Only two factions (including rebels as separate) may occupy a grid simultaneously.'
      );
    }
  }

  static async assessTerrain(
    sessionId: string,
    target: { x: number; y: number }
  ): Promise<TerrainAssessment> {
    const mapGrid = await MapGrid.findOne({ session_id: sessionId });
    if (!mapGrid) {
      throw new Error('Map grid not found');
    }

    const x = Math.floor(target.x);
    const y = Math.floor(target.y);
    const outOfBounds =
      x < 0 ||
      y < 0 ||
      x >= (mapGrid.gridSize?.width ?? 100) ||
      y >= (mapGrid.gridSize?.height ?? 50);

    const cellValue = outOfBounds ? -1 : mapGrid.grid?.[y]?.[x] ?? 0;

    const terrainLookup: Record<number, { type: string; hazard: number; impassable?: boolean }> = {
      [-1]: { type: 'void', hazard: 10, impassable: true },
      0: { type: 'void', hazard: 10, impassable: true },
      1: { type: 'space', hazard: 0 },
      2: { type: 'plasma-storm', hazard: 2 },
      3: { type: 'nebula', hazard: 1 },
      4: { type: 'asteroid-field', hazard: 1 },
    };

    const terrain = terrainLookup[cellValue] || { type: 'anomaly', hazard: 1 };
    return {
      terrainType: terrain.type,
      hazardLevel: terrain.hazard,
      impassable: Boolean(terrain.impassable),
      coordinates: { x, y },
    };
  }

  static async refreshSessionCounters(
    sessionId: string,
    faction: GalaxyFactionCode
  ): Promise<void> {
    const session = await GalaxySession.findOne({ session_id: sessionId });
    if (!session) return;

    session.activePlayers = await GalaxyCharacter.countDocuments({ session_id: sessionId });

    const nextSlots: IGalaxySession['factions'] = [];
    for (const slot of session.factions) {
      if (slot.name === faction) {
        const count = await GalaxyCharacter.countDocuments({
          session_id: sessionId,
          faction: slot.name,
        });
        nextSlots.push({ ...slot, activePlayers: count });
      } else {
        nextSlots.push(slot);
      }
    }
    session.factions = nextSlots;

    await session.save();
  }
}
