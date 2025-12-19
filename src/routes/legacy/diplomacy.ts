// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { NgDiplomacy, General, Nation, Message as MessageModel } from '../../models';

const router = Router();

/**
 * 권한 체크 헬퍼 (수뇌부 권한 = 4 이상)
 */
function checkSecretPermission(general: any): number {
  const officerLevel = general?.data?.officer_level || general?.officer_level || 0;
  const permission = general?.data?.permission || general?.permission || 0;
  
  // 군주(12), 참모(11)은 기본 수뇌부
  if (officerLevel >= 11) return 5;
  // 외교특기가 있으면 수뇌부
  if ((permission & 0x04) !== 0) return 4;
  return 0;
}

/**
 * GET /diplomacy/letters - 외교 서신 목록 조회
 */
router.get('/diplomacy/letters', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    }).lean();
    
    const nationId = general?.data?.nation || general?.nation;
    if (!general || !nationId) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const letters = await NgDiplomacy.find({
      session_id: sessionId,
      $or: [
        { 'data.src_nation_id': nationId },
        { 'data.dest_nation_id': nationId },
      ],
    })
      .sort({ 'data.date': -1 })
      .lean();

    res.json({
      result: true,
      letters: letters.map((l: any) => ({
        no: l.data?.no || l._id,
        srcNationId: l.data?.src_nation_id,
        destNationId: l.data?.dest_nation_id,
        type: l.data?.type,
        brief: l.data?.brief,
        state: l.data?.state || 'proposed',
        date: l.data?.date,
        aux: l.data?.aux || {},
      })),
    });
  } catch (error) {
    console.error('Error in diplomacy/letters:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /diplomacy/send - 외교 서신 발송
 */
router.post('/diplomacy/send', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    }).lean();

    const nationId = general?.data?.nation || general?.nation;
    if (!general || !nationId) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const permission = checkSecretPermission(general);
    if (permission < 4) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    const { targetNationId, type, message, brief, prevLetter } = req.body;

    // 다음 번호 생성
    const lastLetter = await NgDiplomacy.findOne({ session_id: sessionId })
      .sort({ 'data.no': -1 })
      .lean();
    const nextNo = (lastLetter?.data?.no || 0) + 1;

    const diplomacy = new NgDiplomacy({
      session_id: sessionId,
      data: {
        no: nextNo,
        src_nation_id: nationId,
        dest_nation_id: targetNationId,
        src_signer: general.data?.no || general.no,
        type: type || 'normal',
        brief: brief || message || '',
        state: 'proposed',
        date: new Date(),
        prev_no: prevLetter || null,
        aux: {
          src: {
            generalName: general.data?.name || general.name,
            generalIcon: general.data?.picture || '',
          }
        }
      }
    });

    await diplomacy.save();

    res.json({ result: true, reason: 'success', letterNo: nextNo });
  } catch (error) {
    console.error('Error in diplomacy/send:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /diplomacy/respond - 외교 서신 응답 (승인/거부)
 * PHP: j_diplomacy_respond_letter.php
 */
router.post('/diplomacy/respond', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { letterNo, isAgree, reason } = req.body;
    
    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '올바르지 않은 입력입니다.' });
    }

    const general: any = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    }).lean();

    const nationId = general?.data?.nation || general?.nation;
    if (!general || !nationId) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const permission = checkSecretPermission(general);
    if (permission < 4) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    // 내 국가가 수신자이고 state='proposed'인 서신만
    const letter: any = await NgDiplomacy.findOne({
      session_id: sessionId,
      'data.no': letterNo,
      'data.dest_nation_id': nationId,
      'data.state': 'proposed'
    });

    if (!letter) {
      return res.status(404).json({ result: false, reason: '서신이 없습니다.' });
    }

    const aux = letter.data?.aux || {};
    const generalName = general.data?.name || general.name;

    if (isAgree) {
      // 승인
      aux.dest = {
        generalName: generalName,
        generalIcon: general.data?.picture || '',
      };

      letter.data.state = 'activated';
      letter.data.dest_signer = general.data?.no || general.no;
      letter.data.aux = aux;
      letter.markModified('data');
      await letter.save();

      // 이전 서신들을 'replaced'로 변경
      let prevLetterNo = letter.data.prev_no;
      while (prevLetterNo) {
        const prevLetter: any = await NgDiplomacy.findOne({
          session_id: sessionId,
          'data.no': prevLetterNo,
          'data.state': { $ne: 'cancelled' }
        });
        if (!prevLetter) break;
        
        prevLetter.data.state = 'replaced';
        prevLetter.markModified('data');
        await prevLetter.save();
        prevLetterNo = prevLetter.data?.prev_no;
      }

      res.json({ result: true, reason: 'success', message: `외교 서신(#${letterNo})이 승인되었습니다.` });
    } else {
      // 거부
      aux.reason = {
        who: general.data?.no || general.no,
        action: 'disagree',
        reason: reason || ''
      };

      letter.data.state = 'cancelled';
      letter.data.aux = aux;
      letter.markModified('data');
      await letter.save();

      let message = `외교 서신(#${letterNo})이 거부되었습니다.`;
      if (reason) {
        message += ` 이유: ${reason}`;
      }

      res.json({ result: true, reason: 'success', message });
    }
  } catch (error) {
    console.error('Error in diplomacy/respond:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /diplomacy/rollback - 외교 서신 회수
 * PHP: j_diplomacy_rollback_letter.php
 */
router.post('/diplomacy/rollback', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { letterNo } = req.body;
    
    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '올바르지 않은 입력입니다.' });
    }

    const general: any = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    }).lean();

    const nationId = general?.data?.nation || general?.nation;
    if (!general || !nationId) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const permission = checkSecretPermission(general);
    if (permission < 4) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    // 내 국가가 발신자이고 state='proposed'인 서신만
    const letter: any = await NgDiplomacy.findOne({
      session_id: sessionId,
      'data.no': letterNo,
      'data.src_nation_id': nationId,
      'data.state': 'proposed'
    });

    if (!letter) {
      return res.status(404).json({ result: false, reason: '서신이 없습니다.' });
    }

    const aux = letter.data?.aux || {};
    aux.reason = {
      who: general.data?.no || general.no,
      action: 'cancelled',
      reason: '회수'
    };

    letter.data.state = 'cancelled';
    letter.data.aux = aux;
    letter.markModified('data');
    await letter.save();

    res.json({ result: true, reason: 'success', message: `외교 서신(#${letterNo})이 회수되었습니다.` });
  } catch (error) {
    console.error('Error in diplomacy/rollback:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /diplomacy/destroy - 외교 서신 파기 (쌍방 동의 필요)
 * PHP: j_diplomacy_destroy_letter.php
 */
router.post('/diplomacy/destroy', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { letterNo } = req.body;
    
    if (!letterNo) {
      return res.status(400).json({ result: false, reason: '올바르지 않은 입력입니다.' });
    }

    const general: any = await General.findOne({ 
      session_id: sessionId,
      owner: userId 
    }).lean();

    const nationId = general?.data?.nation || general?.nation;
    if (!general || !nationId) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const permission = checkSecretPermission(general);
    if (permission < 4) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    // 관련 국가이고 state='activated'인 서신
    const letter: any = await NgDiplomacy.findOne({
      session_id: sessionId,
      'data.no': letterNo,
      $or: [
        { 'data.src_nation_id': nationId },
        { 'data.dest_nation_id': nationId }
      ],
      'data.state': 'activated'
    });

    if (!letter) {
      return res.status(404).json({ result: false, reason: '서신이 없습니다.' });
    }

    const aux = letter.data?.aux || {};
    const stateOpt = aux.state_opt || null;
    const isSrcNation = letter.data.src_nation_id === nationId;

    // 이미 파기 신청했는지 확인
    if ((stateOpt === 'try_destroy_src' && isSrcNation) ||
        (stateOpt === 'try_destroy_dest' && !isSrcNation)) {
      return res.status(400).json({ result: false, reason: '이미 파기 신청을 했습니다.' });
    }

    let lastState: string;
    let message: string;

    // 상대방도 파기 요청을 했으면 완전 파기
    if (stateOpt === 'try_destroy_src' || stateOpt === 'try_destroy_dest') {
      aux.reason = {
        who: general.data?.no || general.no,
        action: 'destroy',
        reason: '파기'
      };
      letter.data.state = 'cancelled';
      letter.data.aux = aux;
      
      // 관련 replaced 서신들도 파기
      let currentNo = letterNo;
      while (true) {
        const relatedLetter: any = await NgDiplomacy.findOne({
          session_id: sessionId,
          'data.no': currentNo,
          'data.state': 'replaced'
        });
        if (!relatedLetter) break;
        
        const relatedAux = relatedLetter.data?.aux || {};
        relatedAux.reason = {
          who: general.data?.no || general.no,
          action: 'destroy',
          reason: '파기'
        };
        relatedLetter.data.state = 'cancelled';
        relatedLetter.data.aux = relatedAux;
        relatedLetter.markModified('data');
        await relatedLetter.save();
        
        currentNo = relatedLetter.data?.prev_no;
        if (!currentNo) break;
      }

      lastState = 'cancelled';
      message = `외교 서신(#${letterNo})을 파기했습니다.`;
    } else {
      // 파기 요청만
      aux.state_opt = isSrcNation ? 'try_destroy_src' : 'try_destroy_dest';
      letter.data.aux = aux;
      lastState = 'activated';
      message = `외교 서신(#${letterNo})을 파기 요청합니다.`;
    }

    letter.markModified('data');
    await letter.save();

    res.json({ result: true, reason: 'success', state: lastState, message });
  } catch (error) {
    console.error('Error in diplomacy/destroy:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
