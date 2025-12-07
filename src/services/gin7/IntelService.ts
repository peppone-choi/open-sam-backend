import { v4 as uuidv4 } from 'uuid';
import { Gin7Spy, IGin7Spy } from '../../models/gin7/Spy';
import { Gin7IntelReport, IGin7IntelReport } from '../../models/gin7/IntelReport';
import { Gin7Character } from '../../models/gin7/Character';
import { Gin7Planet } from '../../models/gin7/Planet';

export interface DeploySpyParams {
  sessionId: string;
  ownerId: string;
  ownerFactionId?: string;
  targetType: 'planet' | 'fleet' | 'character' | 'faction';
  targetId: string;
  skills?: string[];
}

export interface IntelCheckResult {
  success: boolean;
  discovered: boolean;
  intelGathered?: IGin7IntelReport;
  message: string;
}

class IntelService {
  // Intel report expiry times (in milliseconds)
  private static readonly INTEL_EXPIRY = {
    1: 7 * 24 * 60 * 60 * 1000,   // Level 1: 7 days
    2: 3 * 24 * 60 * 60 * 1000,   // Level 2: 3 days
    3: 1 * 24 * 60 * 60 * 1000,   // Level 3: 1 day
  };

  /**
   * Deploy a spy to a target
   */
  async deploySpy(params: DeploySpyParams): Promise<IGin7Spy> {
    const { sessionId, ownerId, ownerFactionId, targetType, targetId, skills } = params;

    // Check if spy already exists at this target
    const existingSpy = await Gin7Spy.findOne({
      sessionId,
      ownerId,
      targetType,
      targetId,
      status: { $in: ['deploying', 'active'] }
    });

    if (existingSpy) {
      throw new Error('Already have an active spy at this target');
    }

    // Calculate initial cover based on owner's intellect
    const owner = await Gin7Character.findOne({ sessionId, characterId: ownerId });
    const baseCover = owner ? Math.min(50 + Math.floor(owner.stats.intellect / 2), 90) : 50;

    const spy = await Gin7Spy.create({
      spyId: uuidv4(),
      sessionId,
      ownerId,
      ownerFactionId,
      targetType,
      targetId,
      status: 'deploying',
      intelLevel: 0,
      infiltration: 0,
      cover: baseCover,
      suspicion: 0,
      deployedAt: new Date(),
      skills: skills || [],
      lastCheckAt: new Date()
    });

    return spy;
  }

  /**
   * Process spy infiltration progress (called each turn)
   */
  async processSpyTurn(sessionId: string, spyId: string): Promise<IntelCheckResult> {
    const spy = await Gin7Spy.findOne({ sessionId, spyId });
    if (!spy || spy.status !== 'active' && spy.status !== 'deploying') {
      return { success: false, discovered: false, message: 'Spy not active' };
    }

    // Progress infiltration
    const infiltrationGain = 5 + Math.floor(Math.random() * 10);
    spy.infiltration = Math.min(100, spy.infiltration + infiltrationGain);

    // Calculate discovery chance
    const targetDefense = await this.getTargetCounterIntel(sessionId, spy.targetType, spy.targetId);
    const discoveryChance = Math.max(0, (targetDefense - spy.cover) / 100);

    // Check for discovery
    if (Math.random() < discoveryChance) {
      spy.suspicion += 20 + Math.floor(Math.random() * 20);
    }

    // If suspicion too high, spy is discovered
    if (spy.suspicion >= 100) {
      spy.status = 'discovered';
      await spy.save();
      return {
        success: false,
        discovered: true,
        message: 'Spy was discovered!'
      };
    }

    // Check if spy can level up intel
    let intelReport: IGin7IntelReport | undefined;
    if (spy.infiltration >= 30 && spy.intelLevel < 1) {
      spy.intelLevel = 1;
      intelReport = await this.generateIntelReport(spy, 1);
    } else if (spy.infiltration >= 60 && spy.intelLevel < 2) {
      spy.intelLevel = 2;
      intelReport = await this.generateIntelReport(spy, 2);
    } else if (spy.infiltration >= 90 && spy.intelLevel < 3) {
      spy.intelLevel = 3;
      intelReport = await this.generateIntelReport(spy, 3);
    }

    // Deploying -> Active after first turn
    if (spy.status === 'deploying') {
      spy.status = 'active';
    }

    spy.lastCheckAt = new Date();
    await spy.save();

    return {
      success: true,
      discovered: false,
      intelGathered: intelReport,
      message: intelReport ? `Intel level ${spy.intelLevel} achieved` : 'Spy continues infiltration'
    };
  }

  /**
   * Generate an intel report based on spy's findings
   */
  async generateIntelReport(spy: IGin7Spy, level: number): Promise<IGin7IntelReport> {
    const expiresAt = new Date(Date.now() + IntelService.INTEL_EXPIRY[level as 1 | 2 | 3]);
    
    // Gather intel data based on target type
    const intelData = await this.gatherIntelData(spy.sessionId, spy.targetType, spy.targetId, level);

    const report = await Gin7IntelReport.create({
      reportId: uuidv4(),
      sessionId: spy.sessionId,
      spyId: spy.spyId,
      sourceType: 'spy',
      ownerId: spy.ownerId,
      ownerFactionId: spy.ownerFactionId,
      targetType: spy.targetType,
      targetId: spy.targetId,
      targetName: intelData.name,
      intelLevel: level,
      data: intelData,
      gatheredAt: new Date(),
      expiresAt,
      isExpired: false,
      accuracy: Math.min(100, 70 + spy.infiltration / 5),
      revealsFOW: level >= 2
    });

    return report;
  }

  /**
   * Gather intel data based on target
   */
  private async gatherIntelData(
    sessionId: string,
    targetType: string,
    targetId: string,
    level: number
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = { exists: true };

    if (targetType === 'planet') {
      const planet = await Gin7Planet.findOne({ sessionId, planetId: targetId });
      if (!planet) {
        return { exists: false };
      }

      data.name = planet.name;
      data.type = planet.type;

      if (level >= 1) {
        data.factionId = planet.data?.factionId;
        data.hasDefenses = (planet.data?.defense || 0) > 0;
      }

      if (level >= 2) {
        const pop = planet.data?.population || 0;
        const def = planet.data?.defense || 0;
        data.populationRange = [Math.floor(pop * 0.8), Math.ceil(pop * 1.2)];
        data.defenseRange = [Math.floor(def * 0.8), Math.ceil(def * 1.2)];
        data.resourcesEstimate = {
          gold: [Math.floor((planet.data?.gold || 0) * 0.7), Math.ceil((planet.data?.gold || 0) * 1.3)]
        };
      }

      if (level >= 3) {
        data.exactPopulation = planet.data?.population;
        data.exactDefense = planet.data?.defense;
        data.exactResources = {
          gold: planet.data?.gold,
          food: planet.data?.food
        };
        data.buildingDetails = planet.data?.buildings || [];
        data.garrisonDetails = planet.data?.garrison || [];
      }
    } else if (targetType === 'character') {
      const character = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!character) {
        return { exists: false };
      }

      data.name = character.name;

      if (level >= 1) {
        data.factionId = character.data?.factionId;
        data.state = character.state;
      }

      if (level >= 2) {
        data.statsRange = {
          command: [character.stats.command - 10, character.stats.command + 10],
          might: [character.stats.might - 10, character.stats.might + 10]
        };
      }

      if (level >= 3) {
        data.exactStats = character.stats;
        data.traits = character.traits;
        data.skills = character.skills;
        data.location = character.location;
      }
    }

    return data;
  }

  /**
   * Get target's counter-intelligence strength
   */
  private async getTargetCounterIntel(
    sessionId: string,
    targetType: string,
    targetId: string
  ): Promise<number> {
    if (targetType === 'planet') {
      const planet = await Gin7Planet.findOne({ sessionId, planetId: targetId });
      return planet?.data?.counterIntel || 20;
    }
    if (targetType === 'character') {
      const character = await Gin7Character.findOne({ sessionId, characterId: targetId });
      return character?.stats.intellect || 50;
    }
    return 30; // Default
  }

  /**
   * Get latest intel report for a target
   */
  async getLatestIntelReport(
    sessionId: string,
    ownerId: string,
    targetId: string
  ): Promise<IGin7IntelReport | null> {
    return Gin7IntelReport.findOne({
      sessionId,
      ownerId,
      targetId,
      isExpired: false,
      expiresAt: { $gt: new Date() }
    }).sort({ intelLevel: -1, gatheredAt: -1 });
  }

  /**
   * Get all active intel reports for owner
   */
  async getAllIntelReports(
    sessionId: string,
    ownerId: string
  ): Promise<IGin7IntelReport[]> {
    // Mark expired reports
    await Gin7IntelReport.updateMany(
      { sessionId, ownerId, expiresAt: { $lt: new Date() }, isExpired: false },
      { isExpired: true }
    );

    return Gin7IntelReport.find({
      sessionId,
      ownerId,
      isExpired: false
    }).sort({ gatheredAt: -1 });
  }

  /**
   * List all spies for an owner
   */
  async listSpies(sessionId: string, ownerId: string): Promise<IGin7Spy[]> {
    return Gin7Spy.find({
      sessionId,
      ownerId
    }).sort({ deployedAt: -1 });
  }

  /**
   * Extract (recall) a spy
   */
  async extractSpy(sessionId: string, spyId: string, ownerId: string): Promise<boolean> {
    const result = await Gin7Spy.updateOne(
      { sessionId, spyId, ownerId, status: { $in: ['active', 'deploying'] } },
      { status: 'extracted' }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Process all active spies for a session (turn processing)
   */
  async processAllSpies(sessionId: string): Promise<Array<{ spyId: string; result: IntelCheckResult }>> {
    const activeSpies = await Gin7Spy.find({
      sessionId,
      status: { $in: ['active', 'deploying'] }
    });

    const results: Array<{ spyId: string; result: IntelCheckResult }> = [];
    for (const spy of activeSpies) {
      const result = await this.processSpyTurn(sessionId, spy.spyId);
      results.push({ spyId: spy.spyId, result });
    }

    return results;
  }

  /**
   * Check FOW (Fog of War) visibility for a location
   */
  async checkFOWVisibility(
    sessionId: string,
    ownerId: string,
    x: number,
    y: number
  ): Promise<{ visible: boolean; intelLevel: number }> {
    // Check if any intel report reveals this location
    const reports = await Gin7IntelReport.find({
      sessionId,
      ownerId,
      revealsFOW: true,
      isExpired: false
    });

    for (const report of reports) {
      if (report.fowRegion) {
        const dx = x - report.fowRegion.centerX;
        const dy = y - report.fowRegion.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= report.fowRegion.radius) {
          return { visible: true, intelLevel: report.intelLevel };
        }
      }
    }

    return { visible: false, intelLevel: 0 };
  }
}

export default new IntelService();

