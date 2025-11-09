import { nationRepository } from '../../repositories/nation.repository';
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { generalRepository } from '../../repositories/general.repository';
import { GameConst } from '../../constants/GameConst';
import { NationTurn } from '../../models/nation_turn.model';

export class RaiseArmyCommandService {
  /**
   * 거병 - 재야 장수가 새로운 세력을 결성
   */
  static async execute(general: any, sessionId: string): Promise<void> {
    let nationName = general.name;

    // 중복 국가명 체크
    const existingCount = await nationRepository.count({
      session_id: sessionId,
      name: nationName
    });

    if (existingCount > 0) {
      nationName = '㉥' + nationName.substring(0, 16);
      
      const existingCount2 = await nationRepository.count({
        session_id: sessionId,
        name: nationName
      });

      if (existingCount2 > 0) {
        nationName = '㉥' + nationName;
      }
    }

    // 새 국가 번호 생성 - 직접 쿼리 필요 (Repository에 sort/select 메서드 없음)
    const allNations = await nationRepository.findBySession(sessionId);
    const maxNationNum = allNations.reduce((max: number, nation: any) => {
      const nationNum = nation.nation || nation.data?.nation || 0;
      return Math.max(max, nationNum);
    }, 0);
    const nationID = maxNationNum + 1;

    // 국가 생성
    await nationRepository.create({
      session_id: sessionId,
      data: {
        nation: nationID,
        name: nationName,
        color: '#330000',
        gold: 0,
        rice: GameConst.baserice || 50000,
        rate_tmp: 20,
        bill: 100,
        strategic_cmd_limit: 12,
        surlimit: 72,
        secretlimit: 3,
        type: GameConst.neutralNationID || 0,
        gennum: 1,
        capital: general.city,
        level: 0
      }
    });

    // 다른 모든 국가와 외교 관계 초기화 (전쟁 상태)
    const otherNations = allNations.filter((n: any) => {
      const nId = n.nation || n.data?.nation;
      return nId !== nationID;
    });

    const diplomacyDocs = [];
    for (const destNation of otherNations) {
      const destNationId = destNation.nation || destNation.data?.nation;
      
      // destNationId가 유효한 경우에만 추가
      if (destNationId && typeof destNationId === 'number') {
        diplomacyDocs.push({
          session_id: sessionId,
          me: destNationId,
          you: nationID,
          state: 2,  // 전쟁
          term: 0
        });
        diplomacyDocs.push({
          session_id: sessionId,
          me: nationID,
          you: destNationId,
          state: 2,  // 전쟁
          term: 0
        });
      }
    }

    if (diplomacyDocs.length > 0) {
      await diplomacyRepository.insertMany(diplomacyDocs);
    }

    // 국가 턴 초기화
    const maxChiefTurn = GameConst.maxChiefTurn || 12;
    const turnDocs = [];
    for (const chiefLevel of [12, 11]) {
      for (let turnIdx = 0; turnIdx < maxChiefTurn; turnIdx++) {
        turnDocs.push({
          session_id: sessionId,
          data: {
            nation_id: nationID,
            officer_level: chiefLevel,
            turn_idx: turnIdx,
            action: '휴식',
            arg: null,
            brief: '휴식'
          }
        });
      }
    }
    
    // NationTurn.insertMany 직접 호출 (대량 삽입)
    await NationTurn.insertMany(turnDocs);

    // 장수 정보 업데이트 - Repository에 updateOne이 없으므로 직접 쿼리
    const targetGeneral = await generalRepository.findOneByFilter({
      session_id: sessionId,
      $or: [
        { 'data.no': general.no },
        { no: general.no }
      ]
    });

    if (targetGeneral) {
      targetGeneral.data = targetGeneral.data || {};
      targetGeneral.data.belong = 1;
      targetGeneral.data.officer_level = 12;
      targetGeneral.data.officer_city = 0;
      targetGeneral.data.nation = nationID;
      targetGeneral.data.experience = (targetGeneral.data.experience || 0) + 100;
      targetGeneral.data.dedication = (targetGeneral.data.dedication || 0) + 100;
      
      await generalRepository.save(targetGeneral);
    }
  }
}
