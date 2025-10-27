import { Application } from 'express';

// Admin
import adminRouter from './admin/router/admin.router';

// Core domains
import generalRouter from './general/router/general.router';
import cityRouter from './city/router/city.router';
import nationRouter from './nation/router/nation.router';
import commandRouter from './command/router/command.router';
import gameSessionRouter from './game-session/router/game-session.router';

// General related
import generalTurnRouter from './general-turn/router/general-turn.router';
import generalAccessLogRouter from './general-access-log/router/general-access-log.router';
import generalRecordRouter from './general-record/router/general-record.router';

// Nation related
import nationTurnRouter from './nation-turn/router/nation-turn.router';
import nationEnvRouter from './nation-env/router/nation-env.router';

// Military
import troopRouter from './troop/router/troop.router';
import battleRouter from './battle/router/battle.router';
import battlefieldTileRouter from './battlefield-tile/router/battlefield-tile.router';
import itemRouter from './item/router/item.router';

// Communication
import messageRouter from './message/router/message.router';
import boardRouter from './board/router/board.router';
import commentRouter from './comment/router/comment.router';

// History
import worldHistoryRouter from './world-history/router/world-history.router';
import ngHistoryRouter from './ng-history/router/ng-history.router';

// Game system
import eventRouter from './event/router/event.router';
import plockRouter from './plock/router/plock.router';
import reservedOpenRouter from './reserved-open/router/reserved-open.router';
import storageRouter from './storage/router/storage.router';
import rankDataRouter from './rank-data/router/rank-data.router';

// Selection
import selectNpcTokenRouter from './select-npc-token/router/select-npc-token.router';
import selectPoolRouter from './select-pool/router/select-pool.router';

// User
import userRecordRouter from './user-record/router/user-record.router';

// Events
import ngBettingRouter from './ng-betting/router/ng-betting.router';
import voteRouter from './vote/router/vote.router';
import voteCommentRouter from './vote-comment/router/vote-comment.router';
import ngAuctionRouter from './ng-auction/router/ng-auction.router';
import ngAuctionBidRouter from './ng-auction-bid/router/ng-auction-bid.router';

/**
 * 도메인별 라우터 통합
 * 33개 도메인 (Admin 포함)
 */
export function mountRoutes(app: Application): void {
  // ==================== Admin ====================
  app.use('/api/admin', adminRouter);

  // ==================== Core Domains ====================
  app.use('/api/generals', generalRouter);
  app.use('/api/cities', cityRouter);
  app.use('/api/nations', nationRouter);
  app.use('/api/commands', commandRouter);
  app.use('/api/game-sessions', gameSessionRouter);

  // ==================== General Related ====================
  app.use('/api/general-turns', generalTurnRouter);
  app.use('/api/general-access-logs', generalAccessLogRouter);
  app.use('/api/general-records', generalRecordRouter);

  // ==================== Nation Related ====================
  app.use('/api/nation-turns', nationTurnRouter);
  app.use('/api/nation-envs', nationEnvRouter);

  // ==================== Military ====================
  app.use('/api/troops', troopRouter);
  app.use('/api/battles', battleRouter);
  app.use('/api/battlefield-tiles', battlefieldTileRouter);
  app.use('/api/items', itemRouter);

  // ==================== Communication ====================
  app.use('/api/messages', messageRouter);
  app.use('/api/boards', boardRouter);
  app.use('/api/comments', commentRouter);

  // ==================== History ====================
  app.use('/api/world-histories', worldHistoryRouter);
  app.use('/api/ng-histories', ngHistoryRouter);

  // ==================== Game System ====================
  app.use('/api/events', eventRouter);
  app.use('/api/plocks', plockRouter);
  app.use('/api/reserved-opens', reservedOpenRouter);
  app.use('/api/storages', storageRouter);
  app.use('/api/rank-data', rankDataRouter);

  // ==================== Selection ====================
  app.use('/api/select-npc-tokens', selectNpcTokenRouter);
  app.use('/api/select-pools', selectPoolRouter);

  // ==================== User ====================
  app.use('/api/user-records', userRecordRouter);

  // ==================== Events ====================
  app.use('/api/ng-bettings', ngBettingRouter);
  app.use('/api/votes', voteRouter);
  app.use('/api/vote-comments', voteCommentRouter);
  app.use('/api/ng-auctions', ngAuctionRouter);
  app.use('/api/ng-auction-bids', ngAuctionBidRouter);
}
