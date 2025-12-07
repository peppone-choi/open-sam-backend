import { v4 as uuidv4 } from 'uuid';
import { Gin7Conspiracy, IGin7Conspiracy } from '../../models/gin7/Conspiracy';
import { Gin7Character } from '../../models/gin7/Character';

export interface StartConspiracyParams {
  sessionId: string;
  leaderId: string;
  leaderName: string;
  targetFactionId: string;
  targetLeaderId?: string;
}

export interface RecruitResult {
  success: boolean;
  accepted: boolean;
  discovered: boolean;
  message: string;
}

class ConspiracyService {
  /**
   * Start a new conspiracy
   */
  async startConspiracy(params: StartConspiracyParams): Promise<IGin7Conspiracy> {
    const { sessionId, leaderId, leaderName, targetFactionId, targetLeaderId } = params;

    // Check if leader already has active conspiracy
    const existing = await Gin7Conspiracy.findOne({
      sessionId,
      leaderId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    if (existing) {
      throw new Error('Already leading an active conspiracy');
    }

    const conspiracy = await Gin7Conspiracy.create({
      conspiracyId: uuidv4(),
      sessionId,
      targetFactionId,
      targetLeaderId,
      leaderId,
      participants: [{
        characterId: leaderId,
        characterName: leaderName,
        joinedAt: new Date(),
        role: 'leader',
        loyalty: 100
      }],
      status: 'planning',
      resources: {
        gold: 0,
        supporters: 1,
        militaryStrength: 0
      },
      requirements: {
        minSupporters: 5,
        minMilitary: 1000,
        minGold: 10000
      },
      secrecy: 100,
      discoveryRisk: 0
    });

    return conspiracy;
  }

  /**
   * Recruit a new participant
   */
  async recruitParticipant(
    sessionId: string,
    conspiracyId: string,
    recruiterId: string,
    targetId: string
  ): Promise<RecruitResult> {
    const conspiracy = await Gin7Conspiracy.findOne({
      sessionId,
      conspiracyId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    if (!conspiracy) {
      return { success: false, accepted: false, discovered: false, message: 'Conspiracy not found' };
    }

    // Check if recruiter is participant
    const isParticipant = conspiracy.participants.some(p => p.characterId === recruiterId);
    if (!isParticipant) {
      return { success: false, accepted: false, discovered: false, message: 'Not a participant' };
    }

    // Check if target already participant
    if (conspiracy.participants.some(p => p.characterId === targetId)) {
      return { success: false, accepted: false, discovered: false, message: 'Already a participant' };
    }

    // Get target character
    const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
    if (!target) {
      return { success: false, accepted: false, discovered: false, message: 'Target not found' };
    }

    // Calculate acceptance chance based on target's traits and loyalty
    const baseLoyalty = target.data?.factionLoyalty || 50;
    const acceptChance = Math.max(0.1, (100 - baseLoyalty) / 100);
    
    // Discovery chance increases when recruiting
    conspiracy.secrecy -= 5;
    conspiracy.discoveryRisk += 3;

    // Check for discovery
    if (Math.random() < conspiracy.discoveryRisk / 100) {
      conspiracy.status = 'discovered';
      conspiracy.discoveredAt = new Date();
      await conspiracy.save();
      return {
        success: false,
        accepted: false,
        discovered: true,
        message: 'Conspiracy discovered during recruitment!'
      };
    }

    // Check if target accepts
    const accepted = Math.random() < acceptChance;
    if (accepted) {
      conspiracy.participants.push({
        characterId: targetId,
        characterName: target.name,
        joinedAt: new Date(),
        role: 'supporter',
        loyalty: 50 + Math.floor(Math.random() * 30)
      });
      conspiracy.resources.supporters = conspiracy.participants.length;
      
      if (conspiracy.status === 'planning') {
        conspiracy.status = 'recruiting';
      }

      // Check if ready
      if (this.checkReadyRequirements(conspiracy)) {
        conspiracy.status = 'ready';
      }
    } else {
      // Rejection might increase discovery risk
      conspiracy.discoveryRisk += 10;
    }

    await conspiracy.save();

    return {
      success: true,
      accepted,
      discovered: false,
      message: accepted ? 'Target joined the conspiracy' : 'Target refused to join'
    };
  }

  /**
   * Check if conspiracy meets requirements
   */
  private checkReadyRequirements(conspiracy: IGin7Conspiracy): boolean {
    return (
      conspiracy.resources.supporters >= conspiracy.requirements.minSupporters &&
      conspiracy.resources.gold >= conspiracy.requirements.minGold &&
      conspiracy.resources.militaryStrength >= conspiracy.requirements.minMilitary
    );
  }

  /**
   * Contribute resources to conspiracy
   */
  async contributeResources(
    sessionId: string,
    conspiracyId: string,
    characterId: string,
    gold: number,
    military: number
  ): Promise<{ success: boolean; message: string }> {
    const conspiracy = await Gin7Conspiracy.findOne({
      sessionId,
      conspiracyId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    if (!conspiracy) {
      return { success: false, message: 'Conspiracy not found' };
    }

    const isParticipant = conspiracy.participants.some(p => p.characterId === characterId);
    if (!isParticipant) {
      return { success: false, message: 'Not a participant' };
    }

    // Add resources
    conspiracy.resources.gold += gold;
    conspiracy.resources.militaryStrength += military;

    // Update participant role if significant contribution
    const participant = conspiracy.participants.find(p => p.characterId === characterId);
    if (participant && gold >= 5000 && participant.role === 'supporter') {
      participant.role = 'financier';
    }

    // Check if ready
    if (this.checkReadyRequirements(conspiracy)) {
      conspiracy.status = 'ready';
    }

    await conspiracy.save();

    return { success: true, message: 'Resources contributed' };
  }

  /**
   * Launch the uprising
   */
  async launchUprising(
    sessionId: string,
    conspiracyId: string,
    leaderId: string
  ): Promise<{ success: boolean; message: string; newFactionId?: string }> {
    const conspiracy = await Gin7Conspiracy.findOne({
      sessionId,
      conspiracyId,
      leaderId,
      status: 'ready'
    });

    if (!conspiracy) {
      return { success: false, message: 'Conspiracy not ready or not found' };
    }

    conspiracy.status = 'uprising';
    await conspiracy.save();

    // Calculate success chance based on resources vs target faction strength
    const successChance = this.calculateUprisingSuccess(conspiracy);
    const uprisingSucceeds = Math.random() < successChance;

    if (uprisingSucceeds) {
      // Create new faction
      const newFactionId = uuidv4();
      
      // Update all participants' faction
      for (const participant of conspiracy.participants) {
        await Gin7Character.updateOne(
          { sessionId, characterId: participant.characterId },
          { 'data.factionId': newFactionId }
        );
      }

      conspiracy.status = 'succeeded';
      conspiracy.result = {
        success: true,
        newFactionId,
        casualties: Math.floor(conspiracy.resources.militaryStrength * 0.3)
      };
      await conspiracy.save();

      return {
        success: true,
        message: 'Uprising succeeded! New faction established.',
        newFactionId
      };
    } else {
      // Uprising failed
      conspiracy.status = 'failed';
      
      // Punishments for participants
      const punishments = conspiracy.participants.map(p => ({
        characterId: p.characterId,
        punishment: p.role === 'leader' ? 'execution' as const : 'imprisonment' as const
      }));

      conspiracy.result = {
        success: false,
        casualties: Math.floor(conspiracy.resources.militaryStrength * 0.7),
        punishments
      };
      await conspiracy.save();

      return {
        success: false,
        message: 'Uprising failed. Conspirators face punishment.'
      };
    }
  }

  /**
   * Calculate uprising success chance
   */
  private calculateUprisingSuccess(conspiracy: IGin7Conspiracy): number {
    // Base 50% chance, modified by resources
    let chance = 0.5;
    
    // More supporters increase chance
    chance += (conspiracy.resources.supporters - 5) * 0.05;
    
    // More gold helps
    chance += Math.min(0.2, conspiracy.resources.gold / 100000);
    
    // Military strength important
    chance += Math.min(0.3, conspiracy.resources.militaryStrength / 10000);
    
    // Low secrecy hurts
    chance -= (100 - conspiracy.secrecy) / 200;

    return Math.max(0.1, Math.min(0.9, chance));
  }

  /**
   * Get conspiracy details
   */
  async getConspiracy(sessionId: string, conspiracyId: string): Promise<IGin7Conspiracy | null> {
    return Gin7Conspiracy.findOne({ sessionId, conspiracyId });
  }

  /**
   * Get conspiracies targeting a faction (for detection)
   */
  async detectConspiracies(
    sessionId: string,
    factionId: string,
    detectorIntel: number
  ): Promise<IGin7Conspiracy[]> {
    const conspiracies = await Gin7Conspiracy.find({
      sessionId,
      targetFactionId: factionId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    // Only return conspiracies that can be detected based on secrecy vs intel
    return conspiracies.filter(c => {
      const detectChance = (100 - c.secrecy) / 100 * (detectorIntel / 100);
      return Math.random() < detectChance;
    });
  }

  /**
   * Suppress a discovered conspiracy
   */
  async suppressConspiracy(
    sessionId: string,
    conspiracyId: string
  ): Promise<{ success: boolean; punishments: Array<{ characterId: string; punishment: string }> }> {
    const conspiracy = await Gin7Conspiracy.findOne({
      sessionId,
      conspiracyId,
      status: 'discovered'
    });

    if (!conspiracy) {
      return { success: false, punishments: [] };
    }

    // Apply punishments
    const punishments = conspiracy.participants.map(p => ({
      characterId: p.characterId,
      punishment: p.role === 'leader' ? 'execution' : 'imprisonment'
    }));

    conspiracy.status = 'failed';
    conspiracy.result = {
      success: false,
      punishments: punishments.map(p => ({
        ...p,
        punishment: p.punishment as 'execution' | 'imprisonment' | 'exile' | 'pardon'
      }))
    };
    await conspiracy.save();

    return { success: true, punishments };
  }

  /**
   * Get active conspiracy for a character
   */
  async getActiveConspiracy(sessionId: string, characterId: string): Promise<IGin7Conspiracy | null> {
    return Gin7Conspiracy.findOne({
      sessionId,
      'participants.characterId': characterId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });
  }

  /**
   * Leave a conspiracy
   */
  async leaveConspiracy(
    sessionId: string,
    conspiracyId: string,
    characterId: string
  ): Promise<boolean> {
    const conspiracy = await Gin7Conspiracy.findOne({
      sessionId,
      conspiracyId,
      status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    if (!conspiracy) return false;

    // Leader cannot leave
    if (conspiracy.leaderId === characterId) {
      throw new Error('Leader cannot leave conspiracy');
    }

    // Remove participant
    conspiracy.participants = conspiracy.participants.filter(
      p => p.characterId !== characterId
    );
    conspiracy.resources.supporters = conspiracy.participants.length;

    // Leaving increases discovery risk
    conspiracy.discoveryRisk += 15;
    conspiracy.secrecy -= 10;

    await conspiracy.save();
    return true;
  }
}

export default new ConspiracyService();

