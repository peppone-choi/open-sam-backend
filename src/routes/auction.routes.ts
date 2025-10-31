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


// BidBuyRiceAuction
router.post('/bid-buy-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await BidBuyRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// BidSellRiceAuction
router.post('/bid-sell-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await BidSellRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// BidUniqueAuction
router.post('/bid-unique-auction', authenticate, async (req, res) => {
  try {
    const result = await BidUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetActiveResourceAuctionList
router.get('/get-active-resource-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetActiveResourceAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetUniqueItemAuctionDetail
router.get('/get-unique-item-auction-detail', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetUniqueItemAuctionList
router.get('/get-unique-item-auction-list', authenticate, async (req, res) => {
  try {
    const result = await GetUniqueItemAuctionListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// OpenBuyRiceAuction
router.post('/open-buy-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenBuyRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// OpenSellRiceAuction
router.post('/open-sell-rice-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenSellRiceAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// OpenUniqueAuction
router.post('/open-unique-auction', authenticate, async (req, res) => {
  try {
    const result = await OpenUniqueAuctionService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
