import { Router } from 'express';

const router = Router();

/**
 * API 호환성 앨리어스 라우트
 * 
 * 프론트엔드 API 클라이언트가 호출하는 엔드포인트를
 * 백엔드의 실제 구현으로 프록시합니다.
 * 
 * 이 파일은 임시 호환성 레이어이며, 추후 정식 API로 마이그레이션 예정입니다.
 */

// ============================================
// Auction Aliases
// ============================================

// POST /api/auction/get-unique-list → GET /get-unique-item-auction-list
router.post('/auction/get-unique-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/auction/get-unique-item-auction-list';
  next('route');
});

// POST /api/auction/bid-unique → POST /bid-unique-auction
router.post('/auction/bid-unique', (req, res, next) => {
  req.url = '/api/auction/bid-unique-auction';
  next('route');
});

// POST /api/auction/get-active-resource-list → GET /get-active-resource-auction-list
router.post('/auction/get-active-resource-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/auction/get-active-resource-auction-list';
  next('route');
});

// POST /api/auction/bid-buy-rice → POST /bid-buy-rice-auction
router.post('/auction/bid-buy-rice', (req, res, next) => {
  req.url = '/api/auction/bid-buy-rice-auction';
  next('route');
});

// POST /api/auction/bid-sell-rice → POST /bid-sell-rice-auction
router.post('/auction/bid-sell-rice', (req, res, next) => {
  req.url = '/api/auction/bid-sell-rice-auction';
  next('route');
});

// ============================================
// Vote Aliases
// ============================================

// POST /api/vote/get-list → GET /get-vote-list
router.post('/vote/get-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/vote/get-vote-list';
  next('route');
});

// ============================================
// Betting Aliases
// ============================================

// POST /api/betting/get-list → GET /get-betting-list
router.post('/betting/get-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/betting/get-betting-list';
  next('route');
});

// ============================================
// Message Aliases
// ============================================

// POST /api/message/send → POST /send-message
router.post('/message/send', (req, res, next) => {
  req.url = '/api/message/send-message';
  next('route');
});

// ============================================
// Game Aliases (to Legacy endpoints)
// ============================================

// POST /api/game/basic-info → GET /api/legacy/basic-info
router.post('/game/basic-info', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/legacy/basic-info';
  next('route');
});

// POST /api/game/general-list → GET /api/legacy/general-list
router.post('/game/general-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/legacy/general-list';
  next('route');
});

// POST /api/game/map → POST /api/legacy/map
router.post('/game/map', (req, res, next) => {
  req.url = '/api/legacy/map';
  next('route');
});

// POST /api/game/city-list → GET /api/legacy/city-list
router.post('/game/city-list', (req, res, next) => {
  req.method = 'GET';
  req.url = '/api/legacy/city-list';
  next('route');
});

// ============================================
// Game → General Aliases
// ============================================

// POST /api/game/select-npc → POST /api/general/select-npc
router.post('/game/select-npc', (req, res, next) => {
  req.url = '/api/general/select-npc';
  next('route');
});

// POST /api/game/select-picked-general → POST /api/general/select-picked-general
router.post('/game/select-picked-general', (req, res, next) => {
  req.url = '/api/general/select-picked-general';
  next('route');
});

// POST /api/game/set-my-setting → POST /api/general/set-my-setting
router.post('/game/set-my-setting', (req, res, next) => {
  req.url = '/api/general/set-my-setting';
  next('route');
});

// POST /api/game/vacation → POST /api/general/vacation
router.post('/game/vacation', (req, res, next) => {
  req.url = '/api/general/vacation';
  next('route');
});

export default router;
