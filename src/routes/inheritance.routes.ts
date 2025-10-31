import { Router } from 'express';
import { General } from '../models/general.model';
import { Session } from '../models/session.model';

const router = Router();

// 턴 시각 변경 (유산 사용)
router.post('/change-turn-time', async (req, res) => {
  try {
    const { generalId, hour, minute } = req.body;
    
    const general = await General.findOne({ no: generalId });
    if (!general) {
      return res.status(404).json({ error: '장수를 찾을 수 없습니다' });
    }
    
    const session = await Session.findOne({ session_id: general.session_id });
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    // 턴제 모드인지 확인
    if (session.game_mode !== 'turn') {
      return res.status(400).json({ error: '턴제 모드에서만 사용 가능합니다' });
    }
    
    // 턴 시각 변경 허용 여부 확인
    if (!session.turn_config?.allow_custom) {
      return res.status(400).json({ error: '이 서버는 턴 시각 변경이 불가능합니다' });
    }
    
    // TODO: 유산 차감 로직
    
    // 턴 시각 변경
    general.custom_turn_hour = hour;
    general.custom_turn_minute = minute;
    await general.save();
    
    res.json({
      message: '턴 시각 변경 성공',
      newTurnTime: `${hour}:${minute.toString().padStart(2, '0')}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
