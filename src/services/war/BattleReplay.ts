
export interface ReplayMetadata {
  sessionId: string;
  battleId: string;
  date: Date;
  seed: string;
  attacker: {
    id: number;
    name: string;
    nationId: number;
    nationName: string;
    generalName: string;
    crew: number;
    crewType: string;
  };
  defender: {
    cityId: number;
    cityName: string;
    nationId: number;
    nationName: string;
    defenders: {
      id: number;
      name: string;
      crew: number;
      crewType: string;
    }[];
  };
}

export interface ReplayAction {
  type: 'attack' | 'skill' | 'move' | 'retreat' | 'win' | 'lose' | 'phase' | 'info';
  phase?: number;
  actorId: number | string; // General ID or 'city'
  targetId?: number | string;
  
  // Delta / Effect
  damage?: number;
  moraleDamage?: number;
  
  // Additional info
  message?: string;
  detail?: any; // Skill name, critical hit, etc.
}

export interface ReplayTurn {
  turnNumber: number; // or phase number
  actions: ReplayAction[];
  snapshot?: {
    // Optional snapshot for validation/sync
    attackerCrew: number;
    defenderCrew: number; // Current active defender
  };
}

export interface ReplayData {
  version: string;
  metadata: ReplayMetadata;
  turns: ReplayTurn[];
}

export class ReplayBuilder {
  private data: ReplayData;
  private currentTurn: ReplayTurn | null = null;

  constructor(metadata: ReplayMetadata) {
    this.data = {
      version: '1.0',
      metadata,
      turns: [],
    };
  }

  /**
   * Start a new turn/phase
   */
  startTurn(turnNumber: number) {
    // Finalize previous turn if open
    if (this.currentTurn) {
      this.data.turns.push(this.currentTurn);
    }
    
    this.currentTurn = {
      turnNumber,
      actions: [],
    };
  }

  /**
   * Add an action to the current turn
   */
  addAction(action: ReplayAction) {
    if (!this.currentTurn) {
      // If no turn is active, create a generic one (e.g. Turn 0 or setup)
      this.startTurn(0);
    }
    this.currentTurn!.actions.push(action);
  }

  /**
   * Log an attack action helper
   */
  logAttack(actorId: number | string, targetId: number | string, damage: number, currentHp: number, targetHp: number, isCritical: boolean = false) {
    this.addAction({
      type: 'attack',
      actorId,
      targetId,
      damage,
      detail: {
        currentHp,
        targetHp,
        isCritical
      }
    });
  }

  /**
   * Log a skill trigger
   */
  logSkill(actorId: number | string, skillName: string, targets: (number | string)[], effect: any) {
    this.addAction({
      type: 'skill',
      actorId,
      detail: {
        skillName,
        targets,
        effect
      }
    });
  }

  /**
   * Finalize and return the replay data
   */
  build(): ReplayData {
    if (this.currentTurn) {
      this.data.turns.push(this.currentTurn);
      this.currentTurn = null;
    }
    return this.data;
  }
}








