/**
 * AIProfileService
 * 
 * Converts commander (admiral) stats to AI behavior profiles.
 * Used when a fleet needs AI control (offline player, NPC, delegation).
 * 
 * Maps character stats to AI parameters:
 * - command (통솔) → Formation preference, unit coordination
 * - might (무력) → Aggressiveness, damage dealing priority
 * - intellect (지력) → Decision quality, tactical awareness
 * - politics (정치) → Morale management, retreat timing
 * - charm (매력) → Subordinate coordination, alliance behavior
 */

import { IGin7Character, Gin7Character } from '../../../models/gin7/Character';
import { AIStrategy, AIDifficulty } from './BattleAIService';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';

/**
 * AI Battle Profile generated from commander stats
 */
export interface IAIBattleProfile {
  // Core behavior parameters (0-100)
  aggressiveness: number;     // How likely to attack vs defend
  caution: number;            // How risk-averse the AI is
  retreatThreshold: number;   // HP% at which AI considers retreat
  moraleThreshold: number;    // Morale% at which AI retreats
  
  // Tactical preferences
  formationPreference: string;      // Preferred formation
  targetPriority: TargetPriority[]; // Priority for target selection
  
  // Timing
  attackInterval: number;     // Ticks between attack decisions
  reactionTime: number;       // Ticks to react to changes
  
  // Strategy selection
  preferredStrategy: AIStrategy;
  fallbackStrategy: AIStrategy;
  
  // Difficulty mapping for BattleAIService integration
  effectiveDifficulty: AIDifficulty;
  
  // Derived from character
  commanderId: string;
  commanderName: string;
  commandSkill: number;       // 0-100, affects coordination
  tacticalSkill: number;      // 0-100, affects decision quality
}

/**
 * Target priority types
 */
export type TargetPriority = 
  | 'NEAREST'       // Attack closest enemy
  | 'WEAKEST'       // Attack lowest HP enemy
  | 'STRONGEST'     // Attack highest threat
  | 'FLAGSHIP'      // Target enemy commanders
  | 'DAMAGED'       // Finish off wounded fleets
  | 'ISOLATED';     // Target separated enemies

/**
 * Profile generation options
 */
export interface IProfileOptions {
  baseAggression?: number;    // Override base aggression
  forceStrategy?: AIStrategy; // Force specific strategy
  modeModifier?: 'OFFENSIVE' | 'DEFENSIVE' | 'BALANCED';
}

/**
 * Formation preferences based on commander type
 */
const FORMATION_BY_STYLE: Record<string, string[]> = {
  aggressive: ['wedge', 'arrow', 'assault'],
  defensive: ['line', 'box', 'defensive'],
  balanced: ['standard', 'column', 'flexible'],
  tactical: ['echelon', 'pincer', 'flanking']
};

/**
 * AIProfileService class
 */
class AIProfileService {
  private static instance: AIProfileService;
  
  // Cache profiles for performance
  private profileCache: Map<string, { profile: IAIBattleProfile; expires: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): AIProfileService {
    if (!AIProfileService.instance) {
      AIProfileService.instance = new AIProfileService();
    }
    return AIProfileService.instance;
  }

  /**
   * Create AI profile from commander character
   */
  async createProfile(
    sessionId: string,
    commanderId: string,
    options: IProfileOptions = {}
  ): Promise<IAIBattleProfile> {
    // Check cache first
    const cacheKey = `${sessionId}:${commanderId}`;
    const cached = this.profileCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return this.applyOptions(cached.profile, options);
    }

    // Load character from database
    const character = await Gin7Character.findOne({ sessionId, characterId: commanderId });
    if (!character) {
      // Return default profile for unknown commander
      return this.createDefaultProfile(commanderId, options);
    }

    const profile = this.generateProfileFromStats(character, options);
    
    // Cache the profile
    this.profileCache.set(cacheKey, {
      profile,
      expires: Date.now() + this.CACHE_TTL
    });

    return profile;
  }

  /**
   * Create profile directly from character object
   */
  createProfileFromCharacter(
    character: IGin7Character,
    options: IProfileOptions = {}
  ): IAIBattleProfile {
    return this.generateProfileFromStats(character, options);
  }

  /**
   * Generate profile from character stats
   */
  private generateProfileFromStats(
    character: IGin7Character,
    options: IProfileOptions
  ): IAIBattleProfile {
    const stats = character.stats;
    
    // Calculate derived values from stats
    const aggressiveness = this.calculateAggressiveness(stats.might, stats.command);
    const caution = this.calculateCaution(stats.intellect, stats.politics);
    const retreatThreshold = this.calculateRetreatThreshold(stats.politics, stats.intellect);
    const moraleThreshold = this.calculateMoraleThreshold(stats.charm, stats.command);
    
    // Determine strategy based on stats balance
    const preferredStrategy = this.determineStrategy(stats);
    const fallbackStrategy = this.determineFallbackStrategy(preferredStrategy);
    
    // Calculate timing values
    const reactionTime = this.calculateReactionTime(stats.intellect, stats.agility);
    const attackInterval = this.calculateAttackInterval(stats.might, stats.command);
    
    // Map to effective difficulty
    const effectiveDifficulty = this.mapToDifficulty(stats);
    
    // Determine formation preference
    const formationPreference = this.selectFormation(stats);
    
    // Build target priorities
    const targetPriority = this.buildTargetPriorities(stats);

    return {
      aggressiveness: options.baseAggression ?? aggressiveness,
      caution,
      retreatThreshold,
      moraleThreshold,
      formationPreference,
      targetPriority,
      attackInterval,
      reactionTime,
      preferredStrategy: options.forceStrategy ?? preferredStrategy,
      fallbackStrategy,
      effectiveDifficulty,
      commanderId: character.characterId,
      commanderName: character.name,
      commandSkill: Math.round((stats.command + stats.charm) / 2),
      tacticalSkill: Math.round((stats.intellect + stats.command) / 2)
    };
  }

  /**
   * Calculate aggressiveness (0-100)
   * High might + high command = aggressive
   */
  private calculateAggressiveness(might: number, command: number): number {
    // Might contributes 60%, command 40%
    const base = (might * 0.6 + command * 0.4);
    // Add some variance
    return Math.min(100, Math.max(10, base + (Math.random() - 0.5) * 10));
  }

  /**
   * Calculate caution (0-100)
   * High intellect + high politics = cautious
   */
  private calculateCaution(intellect: number, politics: number): number {
    const base = (intellect * 0.5 + politics * 0.5);
    return Math.min(100, Math.max(10, base));
  }

  /**
   * Calculate retreat threshold (HP%)
   * Higher politics = knows when to retreat
   * Higher intellect = better timing
   */
  private calculateRetreatThreshold(politics: number, intellect: number): number {
    // Base retreat at 20%, high politics increases it (smarter retreat)
    const base = 20;
    const politicsBonus = (politics - 50) * 0.3; // -15 to +15
    const intellectBonus = (intellect - 50) * 0.2; // -10 to +10
    
    return Math.min(50, Math.max(10, base + politicsBonus + intellectBonus));
  }

  /**
   * Calculate morale threshold
   * High charm = better morale management
   */
  private calculateMoraleThreshold(charm: number, command: number): number {
    const base = 25;
    const charmBonus = (charm - 50) * 0.2;
    const commandBonus = (command - 50) * 0.1;
    
    return Math.min(40, Math.max(10, base + charmBonus + commandBonus));
  }

  /**
   * Determine preferred AI strategy based on stats
   */
  private determineStrategy(stats: IGin7Character['stats']): AIStrategy {
    const { command, might, intellect, politics, charm } = stats;
    
    // Calculate style scores
    const aggressiveScore = might + command * 0.5;
    const defensiveScore = politics + intellect * 0.5;
    const tacticalScore = intellect + command * 0.5;
    const supportScore = charm + politics * 0.3;
    
    // Find highest score
    const scores: Array<{ strategy: AIStrategy; score: number }> = [
      { strategy: 'AGGRESSIVE', score: aggressiveScore },
      { strategy: 'DEFENSIVE', score: defensiveScore },
      { strategy: 'FLANKING', score: tacticalScore },
      { strategy: 'CAUTIOUS', score: defensiveScore * 0.8 + tacticalScore * 0.2 },
      { strategy: 'FOCUS_FIRE', score: command + might * 0.5 },
      { strategy: 'KITING', score: intellect * 0.7 + (stats.agility || 50) * 0.3 }
    ];
    
    // Special case: high charm + command = formation strategy
    if (charm > 70 && command > 60) {
      return 'FORMATION';
    }
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    return scores[0].strategy;
  }

  /**
   * Determine fallback strategy
   */
  private determineFallbackStrategy(primary: AIStrategy): AIStrategy {
    const fallbacks: Record<AIStrategy, AIStrategy> = {
      'AGGRESSIVE': 'FOCUS_FIRE',
      'DEFENSIVE': 'CAUTIOUS',
      'CAUTIOUS': 'KITING',
      'FLANKING': 'AGGRESSIVE',
      'FOCUS_FIRE': 'AGGRESSIVE',
      'SCATTER': 'DEFENSIVE',
      'KITING': 'CAUTIOUS',
      'FORMATION': 'DEFENSIVE'
    };
    
    return fallbacks[primary] || 'AGGRESSIVE';
  }

  /**
   * Calculate reaction time in ticks
   * Higher intellect = faster reactions
   */
  private calculateReactionTime(intellect: number, agility?: number): number {
    // Base reaction: 15 ticks (1.5 seconds at 10 ticks/sec)
    const base = 15;
    const intellectBonus = (intellect - 50) * 0.1; // -5 to +5 ticks
    const agilityBonus = ((agility || 50) - 50) * 0.05; // -2.5 to +2.5 ticks
    
    return Math.max(3, Math.min(30, Math.round(base - intellectBonus - agilityBonus)));
  }

  /**
   * Calculate attack interval in ticks
   */
  private calculateAttackInterval(might: number, command: number): number {
    // Base: 10 ticks between attack decisions
    const base = 10;
    const mightBonus = (might - 50) * 0.05;
    const commandBonus = (command - 50) * 0.03;
    
    return Math.max(5, Math.min(20, Math.round(base - mightBonus - commandBonus)));
  }

  /**
   * Map character stats to AI difficulty level
   */
  private mapToDifficulty(stats: IGin7Character['stats']): AIDifficulty {
    // Calculate overall skill level
    const avgStat = (stats.command + stats.might + stats.intellect + stats.politics + stats.charm) / 5;
    
    if (avgStat >= 85) return 'EXPERT';
    if (avgStat >= 70) return 'HARD';
    if (avgStat >= 50) return 'NORMAL';
    return 'EASY';
  }

  /**
   * Select formation based on stats
   */
  private selectFormation(stats: IGin7Character['stats']): string {
    const { command, might, intellect } = stats;
    
    if (might > intellect + 20) {
      // Aggressive commander
      return FORMATION_BY_STYLE.aggressive[Math.floor(Math.random() * FORMATION_BY_STYLE.aggressive.length)];
    }
    
    if (intellect > might + 20) {
      // Tactical commander
      return FORMATION_BY_STYLE.tactical[Math.floor(Math.random() * FORMATION_BY_STYLE.tactical.length)];
    }
    
    if (command > 70) {
      // High command = good at formations
      return FORMATION_BY_STYLE.balanced[Math.floor(Math.random() * FORMATION_BY_STYLE.balanced.length)];
    }
    
    // Default: defensive
    return FORMATION_BY_STYLE.defensive[Math.floor(Math.random() * FORMATION_BY_STYLE.defensive.length)];
  }

  /**
   * Build target priority list based on stats
   */
  private buildTargetPriorities(stats: IGin7Character['stats']): TargetPriority[] {
    const priorities: TargetPriority[] = [];
    const { command, might, intellect, charm } = stats;
    
    // High might = finish off damaged, attack strongest
    if (might > 70) {
      priorities.push('DAMAGED', 'STRONGEST');
    }
    
    // High intellect = target isolated, weakest
    if (intellect > 70) {
      priorities.push('ISOLATED', 'WEAKEST');
    }
    
    // High command = target flagships (decapitation strike)
    if (command > 70) {
      priorities.push('FLAGSHIP');
    }
    
    // Default fallbacks
    if (priorities.length === 0) {
      priorities.push('NEAREST');
    }
    
    // Always include nearest as final fallback
    if (!priorities.includes('NEAREST')) {
      priorities.push('NEAREST');
    }
    
    return priorities;
  }

  /**
   * Create default profile for unknown commanders
   */
  private createDefaultProfile(commanderId: string, options: IProfileOptions): IAIBattleProfile {
    return {
      aggressiveness: options.baseAggression ?? 50,
      caution: 50,
      retreatThreshold: 25,
      moraleThreshold: 20,
      formationPreference: 'standard',
      targetPriority: ['NEAREST', 'WEAKEST'],
      attackInterval: 10,
      reactionTime: 15,
      preferredStrategy: options.forceStrategy ?? 'AGGRESSIVE',
      fallbackStrategy: 'DEFENSIVE',
      effectiveDifficulty: 'NORMAL',
      commanderId,
      commanderName: 'Unknown Commander',
      commandSkill: 50,
      tacticalSkill: 50
    };
  }

  /**
   * Apply options to profile
   */
  private applyOptions(profile: IAIBattleProfile, options: IProfileOptions): IAIBattleProfile {
    const result = { ...profile };
    
    if (options.baseAggression !== undefined) {
      result.aggressiveness = options.baseAggression;
    }
    
    if (options.forceStrategy) {
      result.preferredStrategy = options.forceStrategy;
    }
    
    if (options.modeModifier) {
      switch (options.modeModifier) {
        case 'OFFENSIVE':
          result.aggressiveness = Math.min(100, result.aggressiveness + 20);
          result.retreatThreshold = Math.max(10, result.retreatThreshold - 10);
          break;
        case 'DEFENSIVE':
          result.aggressiveness = Math.max(10, result.aggressiveness - 20);
          result.retreatThreshold = Math.min(50, result.retreatThreshold + 10);
          result.caution = Math.min(100, result.caution + 15);
          break;
        case 'BALANCED':
          // No modification
          break;
      }
    }
    
    return result;
  }

  /**
   * Get profile for a fleet (looks up commander)
   */
  async getFleetProfile(
    sessionId: string,
    fleetId: string,
    options: IProfileOptions = {}
  ): Promise<IAIBattleProfile> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return this.createDefaultProfile('unknown', options);
    }
    
    return this.createProfile(sessionId, fleet.commanderId, options);
  }

  /**
   * Get profiles for multiple fleets (batch operation)
   */
  async getFleetProfiles(
    sessionId: string,
    fleetIds: string[],
    options: IProfileOptions = {}
  ): Promise<Map<string, IAIBattleProfile>> {
    const result = new Map<string, IAIBattleProfile>();
    
    // Load all fleets
    const fleets = await Fleet.find({ sessionId, fleetId: { $in: fleetIds } });
    const commanderIds = [...new Set(fleets.map(f => f.commanderId))];
    
    // Load all commanders
    const commanders = await Gin7Character.find({
      sessionId,
      characterId: { $in: commanderIds }
    });
    const commanderMap = new Map(commanders.map(c => [c.characterId, c]));
    
    // Generate profiles
    for (const fleet of fleets) {
      const commander = commanderMap.get(fleet.commanderId);
      if (commander) {
        result.set(fleet.fleetId, this.createProfileFromCharacter(commander, options));
      } else {
        result.set(fleet.fleetId, this.createDefaultProfile(fleet.commanderId, options));
      }
    }
    
    return result;
  }

  /**
   * Adjust profile based on battle situation
   */
  adjustProfileForSituation(
    profile: IAIBattleProfile,
    situation: {
      outnumbered?: boolean;
      winning?: boolean;
      lowSupply?: boolean;
      reinforcementsIncoming?: boolean;
    }
  ): IAIBattleProfile {
    const adjusted = { ...profile };
    
    if (situation.outnumbered) {
      adjusted.caution = Math.min(100, adjusted.caution + 20);
      adjusted.retreatThreshold = Math.min(50, adjusted.retreatThreshold + 15);
      adjusted.preferredStrategy = 'DEFENSIVE';
    }
    
    if (situation.winning) {
      adjusted.aggressiveness = Math.min(100, adjusted.aggressiveness + 10);
    }
    
    if (situation.lowSupply) {
      adjusted.retreatThreshold = Math.min(60, adjusted.retreatThreshold + 20);
      adjusted.caution = Math.min(100, adjusted.caution + 15);
    }
    
    if (situation.reinforcementsIncoming) {
      adjusted.retreatThreshold = Math.max(10, adjusted.retreatThreshold - 10);
      adjusted.preferredStrategy = 'DEFENSIVE'; // Hold position until reinforcements
    }
    
    return adjusted;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.profileCache.clear();
  }

  /**
   * Clear specific profile from cache
   */
  invalidateProfile(sessionId: string, commanderId: string): void {
    this.profileCache.delete(`${sessionId}:${commanderId}`);
  }
}

export const aiProfileService = AIProfileService.getInstance();
export default AIProfileService;
