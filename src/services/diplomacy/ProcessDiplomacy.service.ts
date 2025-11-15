import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';

/**
 * ProcessDiplomacy Service
 * 외교 서한 처리 (동맹 체결, 전쟁 선포 등)
 * PHP: j_diplomacy_respond_letter.php 참조
 */
export class ProcessDiplomacyService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id;
    const letterNo = data.letterNo;
    const action = data.action; // 'alliance', 'war', 'neutral', 'cancel' 등
    const actionData = data.data || {};

    try {
      if (!letterNo || !action) {
        return {
          success: false,
          result: false,
          reason: '필수 파라미터가 누락되었습니다'
        };
      }
      
      // 외교 서한 조회
      const letter = await ngDiplomacyRepository.findByLetterNo(sessionId, letterNo);

      if (!letter) {
        return {
          success: false,
          result: false,
          reason: '외교 서한을 찾을 수 없습니다'
        };
      }

      const letterData = letter.data || {};
      const letterState = letterData.state || letter.state || 'proposed';

      // 승인된 서한만 처리 가능
      if (letterState !== 'activated' && letterState !== 'proposed') {
        return {
          success: false,
          result: false,
          reason: '이미 처리되었거나 취소된 서한입니다'
        };
      }

      // 사용자의 장수 조회
      const general = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

      if (!general) {
        return {
          success: false,
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};
      const myNationId = genData.nation || 0;
      const srcNationId = letterData.srcNationId || letter.src_nation_id || 0;
      const destNationId = letterData.destNationId || letter.dest_nation_id || 0;

      // 권한 확인 (수뇌부만 가능)
      const officerLevel = genData.officer_level || 0;
      if (officerLevel < 4) {
        return {
          success: false,
          result: false,
          reason: '권한이 부족합니다. 수뇌부가 아닙니다'
        };
      }

      // 국가 정보 조회
      const srcNation = await nationRepository.findByNationNum(sessionId, srcNationId);

      const destNation = await nationRepository.findByNationNum(sessionId, destNationId);

      // 외교 타입에 따른 처리
      let updateData: any = {
        'data.status': 'processed',
        'data.processDate': new Date(),
        'data.processAction': action,
        'data.processData': actionData
      };

      // 동맹 체결
      if (action === 'alliance' || letterData.type === 'alliance') {
        // 국가 간 동맹 관계 설정
        if (srcNation && destNation) {
          const srcNationData = srcNation.data || {};
          const destNationData = destNation.data || {};
          
          // 동맹 목록 업데이트
          const srcAllies = srcNationData.allies || [];
          const destAllies = destNationData.allies || [];
          
          if (!srcAllies.includes(destNationId)) {
            srcAllies.push(destNationId);
          }
          if (!destAllies.includes(srcNationId)) {
            destAllies.push(srcNationId);
          }
          
          await nationRepository.updateById(srcNation._id, { 'data.allies': srcAllies });
          await nationRepository.updateById(destNation._id, { 'data.allies': destAllies });
        }
        
        updateData['data.state'] = 'activated';
      }
      
      // 전쟁 선포
      else if (action === 'war' || letterData.type === 'war') {
        // 국가 간 전쟁 관계 설정
        if (srcNation && destNation) {
          const srcNationData = srcNation.data || {};
          const destNationData = destNation.data || {};
          
          // 동맹 관계 해제
          const srcAllies = (srcNationData.allies || []).filter((id: number) => id !== destNationId);
          const destAllies = (destNationData.allies || []).filter((id: number) => id !== srcNationId);
          
          await nationRepository.updateById(srcNation._id, { 'data.allies': srcAllies });
          await nationRepository.updateById(destNation._id, { 'data.allies': destAllies });
        }
        
        updateData['data.state'] = 'activated';
      }
      
      // 중립
      else if (action === 'neutral') {
        updateData['data.state'] = 'activated';
      }
      
      // 취소
      else if (action === 'cancel') {
        updateData['data.state'] = 'cancelled';
      }

      // 서한 상태 업데이트
      await ngDiplomacyRepository.updateById(letter._id, updateData);

      // 메시지 발송
      const messageText = `외교 서신(#${letterNo})이 ${action === 'alliance' ? '동맹으로' : action === 'war' ? '전쟁으로' : '처리'}되었습니다.`;
      
      // FUTURE: Message 클래스 사용하여 메시지 발송
      // const msg = new Message(...);
      // await msg.send();

      return {
        success: true,
        result: true,
        reason: '외교 처리가 완료되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        result: false,
        reason: error.message || '외교 처리 중 오류가 발생했습니다'
      };
    }
  }
}

