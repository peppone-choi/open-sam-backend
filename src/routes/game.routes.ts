import { Router } from 'express';
import { Session } from '../models/session.model';

const router = Router();

// 세션 설정 조회 (완전 동적!)
router.get('/session/:sessionId/config', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    // 전체 설정 반환
    res.json({
      session_id: session.session_id,
      name: session.name,
      game_mode: session.game_mode,
      resources: session.resources,
      attributes: session.attributes,
      field_mappings: session.field_mappings,
      commands: session.commands,
      game_constants: session.game_constants
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 게임 상수 조회 (하위 호환)
router.get('/const', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string || 'sangokushi_default';
    const session = await Session.findOne({ session_id: sessionId });
    
    res.json(session?.game_constants || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 현재 턴 조회
router.get('/turn', async (req, res) => {
  try {
    res.json({
      turn: 1,
      year: 184,
      month: 1
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 랭킹 조회
router.get('/ranking', async (req, res) => {
  try {
    res.json({
      ranking: []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { City } from '../models/city.model';

// 도시 목록 (완전 동적!)
router.get('/cities', async (req, res) => {
  try {
    const sessionId = req.query.session as string || 'sangokushi_default';
    
    const cities = await City.find({ session_id: sessionId });
    
    res.json({
      cities: cities.map(c => ({
        city: c.city,
        name: c.name,
        data: c.data  // 완전 동적!
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 도시 상세 (완전 동적!)
router.get('/cities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.query.session as string || 'sangokushi_default';
    
    const city = await City.findOne({ session_id: sessionId, city: parseInt(id) });
    if (!city) {
      return res.status(404).json({ error: '도시를 찾을 수 없습니다' });
    }
    
    res.json({
      city: city.city,
      name: city.name,
      data: city.data  // 세션 설정에 따라 구조가 다름!
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
