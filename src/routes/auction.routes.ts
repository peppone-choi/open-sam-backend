import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BidBuyRiceAuctionService } from '../services/auction/BidBuyRiceAuction.service';
import { BidSellRiceAuctionService } from '../services/auction/BidSellRiceAuction.service';
import { BidUniqueAuctionService } from '../services/auction/BidUniqueAuction.service';
import { GetActiveResourceAuctionListService } from '../services/auction/GetActiveResourceAuctionList.service';
import { GetUniqueItemAuctionDetailService } from '../services/auction/GetUniqueItemAuctionDetail.service';
import { GetUniqueItemAuctionListService } from '../services/auction/GetUniqueItemAuctionList.service';
import { OpenBuyRiceAuctionService } from '../services/auction/OpenBuyRiceAuction.service';
import { OpenSellRiceAuctionService } from '../services/auction/OpenSellRiceAuction.service';
import { OpenUniqueAuctionService } from '../services/auction/OpenUniqueAuction.service';

const router = Router();

/**
 * @swagger
 * /api/auction/bid-buy-rice-auction:
 *   post:
 *     summary: 쌀 구매 경매 입찰
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/bid-buy-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await BidBuyRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/bid-sell-rice-auction:
 *   post:
 *     summary: 쌀 판매 경매 입찰
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/bid-sell-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await BidSellRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/bid-unique-auction:
 *   post:
 *     summary: 명품 경매 입찰
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/bid-unique-auction', authenticate, async (req, res) => {
  try {
    const result = await BidUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/get-active-resource-auction-list:
 *   get:
 *     summary: 활성 자원 경매 목록 조회
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-active-resource-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetActiveResourceAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/get-unique-item-auction-detail:
 *   get:
 *     summary: 명품 경매 상세 조회
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-unique-item-auction-detail', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/get-unique-item-auction-list:
 *   get:
 *     summary: 명품 경매 목록 조회
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-unique-item-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/open-buy-rice-auction:
 *   post:
 *     summary: 쌀 구매 경매 개설
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/open-buy-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenBuyRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/open-sell-rice-auction:
 *   post:
 *     summary: 쌀 판매 경매 개설
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/open-sell-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenSellRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/open-unique-auction:
 *   post:
 *     summary: 명품 경매 개설
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/open-unique-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
