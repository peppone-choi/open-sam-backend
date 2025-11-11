import { Express } from 'express';

// === Core Routes (src/routes/) ===
import sessionRoutes from '../routes/session.routes';
import generalRoutes from '../routes/general.routes';
import authRoutes from '../routes/auth.routes';
import commandRoutes from '../routes/command.routes';
import gameRoutes from '../routes/game.routes';
import globalRoutes from '../routes/global.routes';
import inheritactionRoutes from '../routes/inheritaction.routes';
import inheritanceRoutes from '../routes/inheritance.routes';
import nationRoutes from '../routes/nation.routes';
import nationcommandRoutes from '../routes/nationcommand.routes';
import troopRoutes from '../routes/troop.routes';
import miscRoutes from '../routes/misc.routes';
import battleRoutes from '../routes/battle.routes';
import battlemapRoutes from '../routes/battlemap-editor.routes';
import auctionRoutes from '../routes/auction.routes';
import bettingRoutes from '../routes/betting.routes';
import messageRoutes from '../routes/message.routes';
import voteRoutes from '../routes/vote.routes';
import legacyRoutes from '../routes/legacy';
import infoRoutes from '../routes/info.routes';
import worldRoutes from '../routes/world.routes';
import npcRoutes from '../routes/npc.routes';
import chiefRoutes from '../routes/chief.routes';
import processingRoutes from '../routes/processing.routes';
import systemRoutes from '../routes/system.routes';
import adminSessionRoutes from '../routes/admin-session.routes';

// === Advanced Routes (src/api/) ===
import adminRouter from './admin/router/admin.router';
// import battleRouter from './battle/router/battle.router';
import commandRouter from './command/router/command.router'; // ✅ CQRS Command Router
import gameSessionRouter from './game-session/router/game-session.router';
import entityUnifiedRouter from './unified/router/entity-unified.router';
// import entityV2Router from './v2/router/entity.router';

/**
 * Mount all API routes
 * 
 * Priority levels:
 * P0 = Critical (auth, commands, nation)
 * P1 = High (game, global, troop)
 * P2 = Medium (inheritance, misc)
 * P3 = Low (admin, v2)
 */
export const mountRoutes = (app: Express) => {
  // ============================================
  // P0: Critical Routes (게임 플레이 필수)
  // ============================================
  
  // Authentication
  app.use('/api/auth', authRoutes);
  
  // Command System (명령 제출/취소)
  app.use('/api/command', commandRoutes);
  app.use('/api/commands', commandRoutes); // alias for compatibility
  
  // Nation System (국가 관리)
  app.use('/api/nation', nationRoutes);
  app.use('/api/nation-command', nationcommandRoutes);
  
  // ============================================
  // P1: High Priority Routes (주요 기능)
  // ============================================
  
  // Game Core
  app.use('/api/session', sessionRoutes);
  app.use('/api/game', gameRoutes);
  app.use('/api/global', globalRoutes);
  
  // General (장수)
  app.use('/api/general', generalRoutes);
  
  // Military
  app.use('/api/troop', troopRoutes);
  app.use('/api/battle', battleRoutes);
  app.use('/api/battlemap', battlemapRoutes);
  
  // ============================================
  // P2: Medium Priority Routes (부가 기능)
  // ============================================
  
  // Features
  app.use('/api/auction', auctionRoutes);
  app.use('/api/betting', bettingRoutes);
  app.use('/api/message', messageRoutes);
  app.use('/api/vote', voteRoutes);
  app.use('/api/inheritance', inheritanceRoutes);
  app.use('/api/inheritaction', inheritactionRoutes);
  app.use('/api/misc', miscRoutes);
  
  // Info & World
  app.use('/api/info', infoRoutes);
  app.use('/api/world', worldRoutes);
  
  // NPC & Control
  app.use('/api/npc', npcRoutes);
  app.use('/api/chief', chiefRoutes);
  
  // Processing
  app.use('/api/processing', processingRoutes);
  
  // System Management
  app.use('/api/system', systemRoutes);
  
  // Legacy PHP Compatibility Layer
  app.use('/api/legacy', legacyRoutes);
  
  // ============================================
  // P3: Low Priority Routes (고급 기능)
  // ============================================
  
  // TEMPORARILY DISABLED - Missing dependencies
  // TODO: Re-enable after fixing:
  // - src/api/battle (missing StartBattle.service, battle.model)
  // - src/api/command (CommandService method mismatch)
  // - src/api/v2 (missing entity implementation)
  
  // Admin (Enabled - requires grade >= 5 in JWT)
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/session', adminSessionRoutes);
  
  // Game Session Management
  app.use('/api/game-sessions', gameSessionRouter);
  app.use('/api/game-session', gameSessionRouter); // 단수형 별칭 (호환성)
  
  // Advanced Command System (CQRS)
  app.use('/api/cqrs/command', commandRouter); // CQRS 기반 커맨드 API
  
  // Advanced Battle System
  // app.use('/api/v2/battle', battleRouter);
  
  // Entity System (v2)
  // app.use('/api/v2/entities', entityV2Router);
  app.use('/api/entities', entityUnifiedRouter);
};
