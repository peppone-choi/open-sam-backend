/**
 * PlayerPresenceService
 * 
 * Manages player online status tracking for MMO-Battle integration.
 * Used to determine if fleets should be AI-controlled during battles.
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';

/**
 * Player presence info
 */
export interface IPlayerPresence {
  characterId: string;
  sessionId: string;
  factionId?: string;
  isOnline: boolean;
  lastActiveAt: Date;
  socketId?: string;
  inBattle?: string;  // battleId if in battle
}

/**
 * Presence update event data
 */
export interface IPresenceUpdate {
  sessionId: string;
  characterId: string;
  isOnline: boolean;
  previousStatus: boolean;
}

/**
 * Activity timeout configuration (ms)
 */
const ACTIVITY_TIMEOUT = 5 * 60 * 1000;  // 5 minutes without heartbeat = inactive
const HEARTBEAT_INTERVAL = 30 * 1000;    // Expected heartbeat every 30 seconds

class PlayerPresenceService extends EventEmitter {
  private static instance: PlayerPresenceService;
  
  // In-memory cache for faster lookups
  private presenceCache: Map<string, IPlayerPresence> = new Map();  // characterId -> presence
  private sessionOnlinePlayers: Map<string, Set<string>> = new Map();  // sessionId -> characterIds
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startCleanupInterval();
  }

  static getInstance(): PlayerPresenceService {
    if (!PlayerPresenceService.instance) {
      PlayerPresenceService.instance = new PlayerPresenceService();
    }
    return PlayerPresenceService.instance;
  }

  /**
   * Set player online status
   */
  async setOnline(
    sessionId: string, 
    characterId: string, 
    socketId: string
  ): Promise<IPlayerPresence> {
    const character = await Gin7Character.findOneAndUpdate(
      { sessionId, characterId },
      { 
        isOnline: true, 
        lastActiveAt: new Date(),
        socketId 
      },
      { new: true }
    );

    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    const presence: IPlayerPresence = {
      characterId,
      sessionId,
      factionId: character.factionId,
      isOnline: true,
      lastActiveAt: new Date(),
      socketId
    };

    // Update cache
    const wasOnline = this.presenceCache.get(characterId)?.isOnline || false;
    this.presenceCache.set(characterId, presence);

    // Update session tracking
    if (!this.sessionOnlinePlayers.has(sessionId)) {
      this.sessionOnlinePlayers.set(sessionId, new Set());
    }
    this.sessionOnlinePlayers.get(sessionId)!.add(characterId);

    // Emit event if status changed
    if (!wasOnline) {
      this.emit('presence:online', {
        sessionId,
        characterId,
        isOnline: true,
        previousStatus: false
      } as IPresenceUpdate);
    }

    return presence;
  }

  /**
   * Set player offline status
   */
  async setOffline(sessionId: string, characterId: string): Promise<void> {
    await Gin7Character.findOneAndUpdate(
      { sessionId, characterId },
      { 
        isOnline: false, 
        lastActiveAt: new Date(),
        socketId: undefined 
      }
    );

    // Update cache
    const presence = this.presenceCache.get(characterId);
    const wasOnline = presence?.isOnline || false;
    
    if (presence) {
      presence.isOnline = false;
      presence.socketId = undefined;
      presence.lastActiveAt = new Date();
    }

    // Update session tracking
    this.sessionOnlinePlayers.get(sessionId)?.delete(characterId);

    // Emit event if status changed
    if (wasOnline) {
      this.emit('presence:offline', {
        sessionId,
        characterId,
        isOnline: false,
        previousStatus: true
      } as IPresenceUpdate);
    }
  }

  /**
   * Update player activity (heartbeat)
   */
  async updateActivity(sessionId: string, characterId: string): Promise<void> {
    await Gin7Character.findOneAndUpdate(
      { sessionId, characterId },
      { lastActiveAt: new Date() }
    );

    const presence = this.presenceCache.get(characterId);
    if (presence) {
      presence.lastActiveAt = new Date();
    }
  }

  /**
   * Check if player is online
   */
  async isPlayerOnline(sessionId: string, characterId: string): Promise<boolean> {
    // Check cache first
    const cached = this.presenceCache.get(characterId);
    if (cached && cached.sessionId === sessionId) {
      // Check if not timed out
      const timeSinceActivity = Date.now() - cached.lastActiveAt.getTime();
      if (timeSinceActivity < ACTIVITY_TIMEOUT) {
        return cached.isOnline;
      }
    }

    // Query database
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return false;

    // Check activity timeout
    if (character.isOnline && character.lastActiveAt) {
      const timeSinceActivity = Date.now() - character.lastActiveAt.getTime();
      if (timeSinceActivity >= ACTIVITY_TIMEOUT) {
        // Mark as offline due to inactivity
        await this.setOffline(sessionId, characterId);
        return false;
      }
    }

    return character.isOnline || false;
  }

  /**
   * Get last active time for a player
   */
  async getLastActiveTime(sessionId: string, characterId: string): Promise<Date | null> {
    const cached = this.presenceCache.get(characterId);
    if (cached && cached.sessionId === sessionId) {
      return cached.lastActiveAt;
    }

    const character = await Gin7Character.findOne({ sessionId, characterId });
    return character?.lastActiveAt || null;
  }

  /**
   * Get all online players in a session
   */
  async getOnlinePlayersInSession(sessionId: string): Promise<IPlayerPresence[]> {
    // Check cache first
    const cachedIds = this.sessionOnlinePlayers.get(sessionId);
    if (cachedIds && cachedIds.size > 0) {
      const presences: IPlayerPresence[] = [];
      for (const charId of cachedIds) {
        const presence = this.presenceCache.get(charId);
        if (presence && presence.isOnline) {
          presences.push(presence);
        }
      }
      if (presences.length > 0) return presences;
    }

    // Query database
    const characters = await Gin7Character.find({ 
      sessionId, 
      isOnline: true 
    });

    return characters.map(c => ({
      characterId: c.characterId,
      sessionId: c.sessionId,
      factionId: c.factionId,
      isOnline: true,
      lastActiveAt: c.lastActiveAt || new Date(),
      socketId: c.socketId
    }));
  }

  /**
   * Get online players in a battle
   */
  async getOnlinePlayersInBattle(
    sessionId: string, 
    battleId: string
  ): Promise<IPlayerPresence[]> {
    // Get fleets in battle
    const fleets = await Fleet.find({ 
      sessionId, 
      'battleState.battleId': battleId 
    });

    const commanderIds = fleets.map(f => f.commanderId);
    
    // Get online commanders
    const onlineCommanders = await Gin7Character.find({
      sessionId,
      characterId: { $in: commanderIds },
      isOnline: true
    });

    return onlineCommanders.map(c => ({
      characterId: c.characterId,
      sessionId: c.sessionId,
      factionId: c.factionId,
      isOnline: true,
      lastActiveAt: c.lastActiveAt || new Date(),
      socketId: c.socketId,
      inBattle: battleId
    }));
  }

  /**
   * Get offline players in a battle (need AI control)
   */
  async getOfflinePlayersInBattle(
    sessionId: string, 
    battleId: string
  ): Promise<string[]> {
    // Get fleets in battle
    const fleets = await Fleet.find({ 
      sessionId, 
      'battleState.battleId': battleId 
    });

    const commanderIds = fleets.map(f => f.commanderId);
    
    // Get offline commanders
    const offlineCommanders = await Gin7Character.find({
      sessionId,
      characterId: { $in: commanderIds },
      $or: [{ isOnline: false }, { isOnline: { $exists: false } }]
    });

    return offlineCommanders.map(c => c.characterId);
  }

  /**
   * Get online players by faction in a session
   */
  async getOnlinePlayersByFaction(
    sessionId: string, 
    factionId: string
  ): Promise<IPlayerPresence[]> {
    const characters = await Gin7Character.find({ 
      sessionId, 
      factionId,
      isOnline: true 
    });

    return characters.map(c => ({
      characterId: c.characterId,
      sessionId: c.sessionId,
      factionId: c.factionId,
      isOnline: true,
      lastActiveAt: c.lastActiveAt || new Date(),
      socketId: c.socketId
    }));
  }

  /**
   * Check if fleet commander is online
   */
  async isFleetCommanderOnline(sessionId: string, fleetId: string): Promise<boolean> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return false;

    return this.isPlayerOnline(sessionId, fleet.commanderId);
  }

  /**
   * Get presence info for multiple characters
   */
  async getPresenceForCharacters(
    sessionId: string, 
    characterIds: string[]
  ): Promise<Map<string, IPlayerPresence>> {
    const result = new Map<string, IPlayerPresence>();

    // Check cache first
    const uncachedIds: string[] = [];
    for (const charId of characterIds) {
      const cached = this.presenceCache.get(charId);
      if (cached && cached.sessionId === sessionId) {
        result.set(charId, cached);
      } else {
        uncachedIds.push(charId);
      }
    }

    // Query uncached
    if (uncachedIds.length > 0) {
      const characters = await Gin7Character.find({
        sessionId,
        characterId: { $in: uncachedIds }
      });

      for (const c of characters) {
        const presence: IPlayerPresence = {
          characterId: c.characterId,
          sessionId: c.sessionId,
          factionId: c.factionId,
          isOnline: c.isOnline || false,
          lastActiveAt: c.lastActiveAt || new Date(),
          socketId: c.socketId
        };
        result.set(c.characterId, presence);
        this.presenceCache.set(c.characterId, presence);
      }
    }

    return result;
  }

  /**
   * Mark player as in battle
   */
  async setInBattle(
    sessionId: string, 
    characterId: string, 
    battleId: string
  ): Promise<void> {
    const presence = this.presenceCache.get(characterId);
    if (presence) {
      presence.inBattle = battleId;
    }

    this.emit('presence:in_battle', {
      sessionId,
      characterId,
      battleId
    });
  }

  /**
   * Mark player as out of battle
   */
  async setOutOfBattle(sessionId: string, characterId: string): Promise<void> {
    const presence = this.presenceCache.get(characterId);
    if (presence) {
      presence.inBattle = undefined;
    }

    this.emit('presence:out_of_battle', {
      sessionId,
      characterId
    });
  }

  /**
   * Start cleanup interval for stale presence data
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePresence();
    }, ACTIVITY_TIMEOUT);
  }

  /**
   * Cleanup stale presence data
   */
  private async cleanupStalePresence(): Promise<void> {
    const now = Date.now();
    const staleCharacters: string[] = [];

    for (const [charId, presence] of this.presenceCache) {
      if (presence.isOnline) {
        const timeSinceActivity = now - presence.lastActiveAt.getTime();
        if (timeSinceActivity >= ACTIVITY_TIMEOUT) {
          staleCharacters.push(charId);
        }
      }
    }

    // Mark stale characters as offline
    for (const charId of staleCharacters) {
      const presence = this.presenceCache.get(charId);
      if (presence) {
        await this.setOffline(presence.sessionId, charId);
      }
    }

    // Also cleanup database
    const cutoffTime = new Date(now - ACTIVITY_TIMEOUT);
    await Gin7Character.updateMany(
      { 
        isOnline: true, 
        lastActiveAt: { $lt: cutoffTime } 
      },
      { 
        isOnline: false,
        socketId: undefined 
      }
    );
  }

  /**
   * Get online player count for a session
   */
  getOnlinePlayerCount(sessionId: string): number {
    return this.sessionOnlinePlayers.get(sessionId)?.size || 0;
  }

  /**
   * Clear cache for testing
   */
  clearCache(): void {
    this.presenceCache.clear();
    this.sessionOnlinePlayers.clear();
  }

  /**
   * Destroy service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearCache();
    this.removeAllListeners();
  }
}

export const playerPresenceService = PlayerPresenceService.getInstance();
export default PlayerPresenceService;
