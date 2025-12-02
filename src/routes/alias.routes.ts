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

// ============================================
// Inherit Aliases
// ============================================

// POST /api/inherit/get-point → POST /api/inheritance/get-point
router.post('/inherit/get-point', (req, res, next) => {
  req.url = '/api/inheritance/get-point';
  next('route');
});

// POST /api/inherit/use-point → POST /api/inheritance/use-point
router.post('/inherit/use-point', (req, res, next) => {
  req.url = '/api/inheritance/use-point';
  next('route');
});

// ============================================
// User Aliases
// ============================================

// POST /api/user/upload-icon → POST /api/gateway/change-icon
router.post('/user/upload-icon', (req, res, next) => {
  req.url = '/api/gateway/change-icon';
  next('route');
});

// ============================================
// Game Info Aliases (for API_CALL_MAPPING compatibility)
// ============================================

// POST /api/game/get-tournament-info → POST /api/info/tournament
router.post('/game/get-tournament-info', (req, res, next) => {
  req.url = '/api/info/tournament';
  next('route');
});

// POST /api/game/get-inherit-point → POST /api/inheritance/get-point
router.post('/game/get-inherit-point', (req, res, next) => {
  req.url = '/api/inheritance/get-point';
  next('route');
});

// ============================================
// Betting Info Aliases
// ============================================

// POST /api/betting/get-betting-info → POST /api/info/betting
router.post('/betting/get-betting-info', (req, res, next) => {
  req.url = '/api/info/betting';
  next('route');
});

// ============================================
// Nation Info Aliases
// ============================================

// POST /api/nation/get-officer-info → POST /api/info/officer
router.post('/nation/get-officer-info', (req, res, next) => {
  req.url = '/api/info/officer';
  next('route');
});

export default router;
