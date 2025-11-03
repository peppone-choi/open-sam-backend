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

// === Advanced Routes (src/api/) ===
// TEMPORARILY DISABLED - Missing dependencies/implementation
// TODO: Fix these routes after core services are implemented
import adminRouter from './admin/router/admin.router';
// import battleRouter from './battle/router/battle.router';
// import commandRouter from './command/router/command.router';
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
  
  // Game Session Management
  app.use('/api/game-sessions', gameSessionRouter);
  app.use('/api/game-session', gameSessionRouter); // 단수형 별칭 (호환성)
  
  // Advanced Command System
  // app.use('/api/v2/command', commandRouter);
  
  // Advanced Battle System
  // app.use('/api/v2/battle', battleRouter);
  
  // Entity System (v2)
  // app.use('/api/v2/entities', entityV2Router);
  app.use('/api/entities', entityUnifiedRouter);
  
  console.log('✅ Core API routes mounted successfully');
  console.log('📍 Active routes: 21 (18 core + 3 advanced)');
  console.log('   P0 (Critical): 4 routes');
  console.log('   P1 (High): 7 routes');
  console.log('   P2 (Medium): 7 routes');
  console.log('   P3 (Low): 3 routes (3 disabled)');
  console.log('✅ Admin routes enabled - requires grade >= 5');
  console.log('⚠️  Some advanced routes disabled - see src/api/index.ts for details');
};
