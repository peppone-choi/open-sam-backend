import { logger } from '../common/utils/logger';
import { EntityRepository } from '../../common/repository/entity-repository';
import { Role } from '../../common/@types/role.types';
import { Entity } from '../../common/@types/entity.types';

export class GameLoop {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  start() {
    this.isRunning = true;
    logger.info('🎮 Game Loop 시작');
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    logger.info('⏸️  Game Loop 중지');
  }

  private async tick() {
    try {
      await this.regenerateCP();
      await this.produceResources();
    } catch (error) {
      logger.error('Game Loop 오류:', error);
    }
  }

  private async regenerateCP() {
    const commanders = await EntityRepository.findByQuery({ role: Role.COMMANDER }) as Entity[];
    
    for (const cmd of commanders) {
      if (!cmd.systems) cmd.systems = {};
      if (!cmd.systems.cp) cmd.systems.cp = { pcp: 0, mcp: 0, maxPCP: 100, maxMCP: 100 };
      
      cmd.systems.cp.pcp = Math.min(cmd.systems.cp.pcp + 1, cmd.systems.cp.maxPCP);
      cmd.systems.cp.mcp = Math.min(cmd.systems.cp.mcp + 0.5, cmd.systems.cp.maxMCP);
      
      const ref = { role: cmd.role, id: cmd.id, scenario: cmd.scenario };
      await EntityRepository.update(ref, { systems: cmd.systems });
    }
  }

  private async produceResources() {
    const settlements = await EntityRepository.findByQuery({ role: Role.SETTLEMENT }) as Entity[];
    
    for (const s of settlements) {
      if (!s.slots || !s.resources) continue;
      
      const goldProd = Math.floor((s.slots.production_2?.value || 0) / 100);
      const riceProd = Math.floor((s.slots.production_1?.value || 0) / 100);
      
      s.resources.gold = (s.resources.gold || 0) + goldProd;
      s.resources.rice = (s.resources.rice || 0) + riceProd;
      
      const ref = { role: s.role, id: s.id, scenario: s.scenario };
      await EntityRepository.update(ref, { resources: s.resources });
    }
  }
}
