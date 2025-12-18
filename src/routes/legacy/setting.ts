// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { General } from '../../models';
import { saveGeneral } from '../../common/cache/model-cache.helper';

const router = Router();

/**
 * 내 설정 저장 (j_set_my_setting.php)
 * - tnmt: 토너먼트 참가 여부 (0: 불참, 1: 참가)
 * - defence_train: 수비 훈련도 기준 (40~90 또는 999)
 * - use_treatment: 치료 자원 사용 기준 (10~100)
 * - use_auto_nation_turn: 국가 자동 턴 사용 여부
 */
router.post('/setting/save', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = req.body.session_id || 'sangokushi_default';
    const general = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    });
    
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { 
      useTreatment, 
      autoNationTurn, 
      customCSS,
      tnmt,
      defence_train
    } = req.body;

    // data 객체 업데이트
    const data = general.data || {};
    
    // tnmt (토너먼트) 설정
    if (tnmt !== undefined) {
      let tnmtVal = parseInt(tnmt);
      if (tnmtVal < 0 || tnmtVal > 1) {
        tnmtVal = 1;
      }
      data.tnmt = tnmtVal;
    }
    
    // defence_train (수비 훈련도) 설정
    if (defence_train !== undefined) {
      let defTrainVal = parseInt(defence_train);
      
      if (defTrainVal <= 40) {
        defTrainVal = 40;
      } else if (defTrainVal <= 90) {
        // 10 단위로 반올림
        defTrainVal = Math.round(defTrainVal / 10) * 10;
      } else {
        defTrainVal = 999; // 무조건 수비
      }
      
      const prevDefenceTrain = data.defence_train || 80;
      
      // 수비 훈련도 변경 시 myset 감소 및 능력치 변화 (999로 변경 시)
      if (defTrainVal !== prevDefenceTrain) {
        data.myset = (data.myset || 0) - 1;
        data.defence_train = defTrainVal;
        
        // 999(무조건 수비)로 변경 시 훈련도/사기 감소
        if (defTrainVal === 999) {
          const trainReduction = -3;
          const atmosReduction = -6;
          
          data.train = Math.max(20, Math.min((data.train || 100) + trainReduction, 130));
          data.atmos = Math.max(20, Math.min((data.atmos || 100) + atmosReduction, 130));
        }
      }
    }

    // aux 객체 업데이트
    const aux = data.aux || general.aux || {};
    
    if (useTreatment !== undefined) {
      let useTreatmentVal = parseInt(useTreatment);
      useTreatmentVal = Math.max(10, Math.min(100, useTreatmentVal));
      aux.use_treatment = useTreatmentVal;
    }
    
    if (autoNationTurn !== undefined) {
      aux.use_auto_nation_turn = parseInt(autoNationTurn);
    }
    
    if (customCSS !== undefined) {
      aux.custom_css = customCSS;
    }

    data.aux = aux;
    general.data = data;
    general.aux = aux;
    
    // CQRS: 캐시에 저장
    const generalNo = general.no || data.no;
    await saveGeneral(sessionId, generalNo, general.toObject());

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in setting/save:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/setting/get', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const general: any = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    })
      .select('data aux')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const data = general.data || {};
    const aux = data.aux || general.aux || {};

    const settings = {
      useTreatment: aux.use_treatment || 10,
      autoNationTurn: aux.use_auto_nation_turn || 1,
      customCSS: aux.custom_css || '',
      tnmt: data.tnmt !== undefined ? data.tnmt : 1,
      defenceTrain: data.defence_train || 80,
    };

    res.json({
      result: true,
      settings,
    });
  } catch (error) {
    console.error('Error in setting/get:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
