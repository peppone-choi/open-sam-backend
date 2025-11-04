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
 *     description: 다른 플레이어가 판매하는 쌀을 구매하기 위해 입찰합니다. 최고가 입찰자가 낙찰받습니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auction_id:
 *                 type: number
 *               bid_price:
 *                 type: number
 *                 description: 입찰 가격 (금)
 *     responses:
 *       200:
 *         description: 입찰 성공
 *       400:
 *         description: 입찰 실패 (금액 부족, 최소가 미달 등)
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
 *     description: 다른 플레이어에게 쌀을 판매합니다. 최저가 입찰자가 낙찰받습니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auction_id:
 *                 type: number
 *               bid_price:
 *                 type: number
 *     responses:
 *       200:
 *         description: 입찰 성공
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
 *     summary: 유니크 아이템 경매 입찰
 *     description: 희귀 아이템, 명마, 명검 등 유니크 아이템에 입찰합니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auction_id:
 *                 type: number
 *               bid_price:
 *                 type: number
 *     responses:
 *       200:
 *         description: 입찰 성공
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
 *     summary: 진행 중인 자원 경매 목록
 *     description: 현재 진행 중인 쌀/금 경매 목록을 조회합니다.
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *     responses:
 *       200:
 *         description: 경매 목록 조회 성공
 */
router.get('/get-active-resource-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetActiveResourceAuctionListService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/get-unique-item-auction-detail:
 *   get:
 *     summary: 유니크 아이템 경매 상세
 *     description: 특정 유니크 아이템 경매의 상세 정보 및 입찰 현황을 조회합니다.
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: auction_id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 경매 상세 조회 성공
 */
router.get('/get-unique-item-auction-detail', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionDetailService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auction/get-unique-item-auction-list:
 *   get:
 *     summary: 유니크 아이템 경매 목록
 *     description: 진행 중인 유니크 아이템 경매 목록을 조회합니다.
 *     tags: [Auction]
 *     responses:
 *       200:
 *         description: 경매 목록 조회 성공
 */
router.get('/get-unique-item-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionListService.execute(req.query, req.user);
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
 *     description: 쌀을 사고 싶을 때 경매를 개설합니다. 판매자들이 입찰하여 최저가에 판매합니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: 구매할 쌀 양
 *               max_price:
 *                 type: number
 *                 description: 최대 구매 가격
 *     responses:
 *       200:
 *         description: 경매 개설 성공
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
 *     description: 보유한 쌀을 판매하기 위해 경매를 개설합니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: 판매할 쌀 양
 *               min_price:
 *                 type: number
 *                 description: 최소 판매 가격
 *     responses:
 *       200:
 *         description: 경매 개설 성공
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
 *     summary: 유니크 아이템 경매 개설
 *     description: 보유한 유니크 아이템을 경매에 올립니다.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               item_id:
 *                 type: number
 *               starting_price:
 *                 type: number
 *     responses:
 *       200:
 *         description: 경매 개설 성공
 */
router.post('/open-unique-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/get-unique-list', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bid-unique', authenticate, async (req, res) => {
  try {
    const result = await BidUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/get-active-resource-list', authenticate, async (req, res) => {
  try {
    const result = await GetActiveResourceAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bid-buy-rice', authenticate, async (req, res) => {
  try {
    const result = await BidBuyRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bid-sell-rice', authenticate, async (req, res) => {
  try {
    const result = await BidSellRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
