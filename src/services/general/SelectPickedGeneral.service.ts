// @ts-nocheck - Type issues need investigation
import { SelectPool } from '../../models/select_pool.model';
import { GeneralTurn } from '../../models/general_turn.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';

/**
 * SelectPickedGeneral Service
 * 선택된 장수 생성 (npcmode==2 전용)
 * PHP: j_select_picked_general.php
 */
export class SelectPickedGeneralService {
  static async execute(data: any, user?: any) {
    const userId = user?.id;
    const sessionId = data.session_id || 'sangokushi_default';
    const pick = data.pick; // unique_name
    const leadership = parseInt(data.leadership) || 50;
    const strength = parseInt(data.strength) || 50;
    const intel = parseInt(data.intel) || 50;
    const personal = data.personal || 'Random';
    const use_own_picture = data.use_own_picture === true || data.use_own_picture === 'true';

    if (!userId) {
      return {
        result: false,
        reason: '로그인이 필요합니다'
      };
    }

    if (!pick) {
      return {
        result: false,
        reason: '장수를 선택하지 않았습니다'
      };
    }

    try {
      // 세션 정보 확인
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.config || session.data || {};
      const npcmode = sessionData.npcmode || 0;
      const maxgeneral = sessionData.maxgeneral || 50;
      const turnterm = sessionData.turnterm || 60; // 분 단위

      if (npcmode !== 2) {
        return {
          result: false,
          reason: '선택 가능한 서버가 아닙니다'
        };
      }

      // 이미 장수가 있는지 확인
      const existingGeneral = await generalRepository.findBySessionAndOwner(
        sessionId,
        userId.toString(),
        { npc: { $ne: 2 } }
      );

      if (existingGeneral) {
        return {
          result: false,
          reason: '이미 장수를 생성했습니다.'
        };
      }

      // 장수 수 확인
      const generalCount = await generalRepository.count({
        session_id: sessionId,
        npc: { $lt: 2 }
      });

      if (generalCount >= maxgeneral) {
        return {
          result: false,
          reason: '더 이상 등록할 수 없습니다.'
        };
      }

      // 선택 풀에서 정보 가져오기
      const now = new Date();
      const selectPool = await SelectPool.findOne({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.reserved_until': { $gte: now },
        'data.unique_name': pick
      });

      if (!selectPool || !selectPool.data?.info) {
        return {
          result: false,
          reason: '유효한 장수 목록이 없습니다.'
        };
      }

      const selectInfo = selectPool.data.info;

      // 스탯 검증
      const minStat = 40; // GameConst::$defaultStatMin
      const maxStat = 100; // GameConst::$defaultStatMax
      const maxTotal = 240; // GameConst::$defaultStatTotal

      const finalLeadership = Math.max(minStat, Math.min(maxStat, leadership));
      const finalStrength = Math.max(minStat, Math.min(maxStat, strength));
      const finalIntel = Math.max(minStat, Math.min(maxStat, intel));

      if (finalLeadership + finalStrength + finalIntel > maxTotal) {
        return {
          result: false,
          reason: '스탯의 총 합이 올바르지 않습니다.'
        };
      }

      // 회원 정보 가져오기 (picture, imgsvr)
      // TODO: RootDB에서 실제로 가져오기
      const ownerInfo = {
        name: user?.name || 'Unknown',
        picture: user?.picture || null,
        imgsvr: user?.imgsvr || 0
      };

      // 장수 생성
      const lastGeneral = await generalRepository.findOneByFilter({ session_id: sessionId  })
        .sort({ no: -1 })
        
        ;

      const generalNo = (lastGeneral?.no || 0) + 1;

      // 성격 결정
      const availablePersonality = ['brave', 'wise', 'loyal', 'ambitious'];
      let finalPersonal = personal;
      if (!finalPersonal || finalPersonal === 'Random') {
        finalPersonal = availablePersonality[Math.floor(Math.random() * availablePersonality.length)];
      }
      if (!availablePersonality.includes(finalPersonal)) {
        return {
          result: false,
          reason: '올바르지 않은 성격입니다.'
        };
      }

      // 장수 데이터 생성
      const generalData: any = {
        owner_name: ownerInfo.name,
        imgsvr: use_own_picture ? ownerInfo.imgsvr : (selectInfo.imgsvr || 0),
        nation: 0, // 재야로 시작
        city: selectInfo.city || 1,
        troop: 0,
        leadership: finalLeadership,
        strength: finalStrength,
        intel: finalIntel,
        experience: 0,
        dedication: 0,
        gold: sessionData.defaultGold || 1000,
        rice: sessionData.defaultRice || 1000,
        crew: 0,
        train: 0,
        atmos: 50,
        officer_level: 0,
        killturn: 5,
        crewtype: 0,
        personal: finalPersonal,
        special: selectInfo.specialDomestic || 'None',
        special2: selectInfo.specialWar || 'None',
        age: selectInfo.age || 20,
        startage: selectInfo.age || 20,
        npc: 0,
        penalty: {}
      };

      // dex 추가
      if (selectInfo.dex && Array.isArray(selectInfo.dex)) {
        generalData.dex1 = selectInfo.dex[0] || 0;
        generalData.dex2 = selectInfo.dex[1] || 0;
        generalData.dex3 = selectInfo.dex[2] || 0;
        generalData.dex4 = selectInfo.dex[3] || 0;
        generalData.dex5 = selectInfo.dex[4] || 0;
      }

      // aux 설정
      const nextChangeDate = new Date(Date.now() + 12 * turnterm * 60000);
      generalData.aux = {
        next_change: nextChangeDate.toISOString()
      };

      // 장수 생성
      const newGeneral = await generalRepository.create({
        no: generalNo,
        session_id: sessionId,
        owner: userId.toString(),
        name: selectInfo.generalName || `장수${generalNo}`,
        picture: use_own_picture ? ownerInfo.picture : (selectInfo.picture || null),
        npc: 0,
        data: generalData
      });

      // 턴 슬롯 생성 (최대 턴까지 휴식으로 채움)
      const turnRows = [];
      const maxTurn = sessionData.maxTurn || 30;
      for (let i = 0; i < maxTurn; i++) {
        turnRows.push({
          session_id: sessionId,
          data: {
            general_id: generalNo,
            turn_idx: i,
            action: '휴식',
            arg: {},
            brief: '휴식'
          }
        });
      }
      if (turnRows.length > 0) {
        try {
          await GeneralTurn.insertMany(turnRows, { ordered: false });
        } catch (error: any) {
          // 중복 키 에러는 무시 (이미 존재하는 경우)
          if (error.code !== 11000) {
            console.error('Failed to insert general turns:', error);
            throw error;
          }
        }
      }

      // 선택 풀 업데이트 (사용된 것 표시)
      await SelectPool.updateMany(
        {
          session_id: sessionId,
          'data.owner': userId.toString(),
          'data.general_id': null
        },
        {
          $set: {
            'data.owner': null,
            'data.reserved_until': null
          }
        }
      );

      // 선택된 풀에 general_id 연결
      await SelectPool.updateOne(
        {
          session_id: sessionId,
          'data.unique_name': pick
        },
        {
          $set: {
            'data.general_id': generalNo
          }
        }
      );

      // 도시 정보 가져오기
      const city = await cityRepository.findOneByFilter({
        session_id: sessionId,
        'data.id': generalData.city
      });

      const cityName = city?.data?.name || '도시';

      // TODO: ActionLogger로 로그 남기기
      console.log(`[SelectPickedGeneral] ${ownerInfo.name}이 ${selectInfo.generalName}으로 등장`);

      return {
        result: true,
        reason: 'success',
        general_id: generalNo,
        general_name: selectInfo.generalName,
        city_name: cityName
      };
    } catch (error: any) {
      console.error('SelectPickedGeneral error:', error);
      return {
        result: false,
        reason: error.message || '장수 등록 실패'
      };
    }
  }
}

