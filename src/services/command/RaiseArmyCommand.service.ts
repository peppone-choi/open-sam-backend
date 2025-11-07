import { Nation } from '../../models/nation.model';
import { Diplomacy } from '../../models/diplomacy.model';
import { NationTurn } from '../../models/nation_turn.model';
import { General } from '../../models/general.model';
import { GameConst } from '../../constants/GameConst';

export class RaiseArmyCommandService {
  /**
   * 거병 - 재야 장수가 새로운 세력을 결성
   */
  static async execute(general: any, sessionId: string): Promise<void> {
    let nationName = general.name;

    // 중복 국가명 체크
    const existingCount = await Nation.countDocuments({
      session_id: sessionId,
      name: nationName
    });

    if (existingCount > 0) {
      nationName = '㉥' + nationName.substring(0, 16);
      
      const existingCount2 = await Nation.countDocuments({
        session_id: sessionId,
        name: nationName
      });

      if (existingCount2 > 0) {
        nationName = '㉥' + nationName;
      }
    }

    // 새 국가 번호 생성
    const maxNation = await Nation.findOne({ session_id: sessionId })
      .sort({ nation: -1 })
      .select('nation')
      .lean();
    const nationID = (maxNation?.nation || 0) + 1;

    // 국가 생성
    await Nation.create({
      session_id: sessionId,
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
    });

    // 다른 모든 국가와 외교 관계 초기화 (전쟁 상태)
    const allNations = await Nation.find({ 
      session_id: sessionId,
      nation: { $ne: nationID }
    }).select('nation').lean();

    const diplomacyDocs = [];
    for (const destNation of allNations) {
      diplomacyDocs.push({
        session_id: sessionId,
        me: destNation.nation,
        you: nationID,
        state: 2,  // 전쟁
        term: 0
      });
      diplomacyDocs.push({
        session_id: sessionId,
        me: nationID,
        you: destNation.nation,
        state: 2,  // 전쟁
        term: 0
      });
    }

    if (diplomacyDocs.length > 0) {
      await Diplomacy.insertMany(diplomacyDocs);
    }

    // 국가 턴 초기화
    const maxChiefTurn = GameConst.maxChiefTurn || 12;
    const turnDocs = [];
    for (const chiefLevel of [12, 11]) {
      for (let turnIdx = 0; turnIdx < maxChiefTurn; turnIdx++) {
        turnDocs.push({
          session_id: sessionId,
          nation_id: nationID,
          officer_level: chiefLevel,
          turn_idx: turnIdx,
          action: '휴식',
          arg: null,
          brief: '휴식'
        });
      }
    }
    await NationTurn.insertMany(turnDocs);

    // 장수 정보 업데이트
    await General.updateOne(
      { session_id: sessionId, no: general.no },
      {
        $set: {
          belong: 1,
          officer_level: 12,
          officer_city: 0,
          nation: nationID
        },
        $inc: {
          experience: 100,
          dedication: 100
        }
      }
    );
  }
}
