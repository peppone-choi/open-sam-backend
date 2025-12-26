import { Request, Response } from 'express';
import { General } from '../models/general.model';
import { SimpleBattleEngine } from '../engine/battle/SimpleBattleEngine';
import { MudBattleLog } from '../models/mud-battle-log.model';
import { Nation } from '../models/nation.model';
import { City } from '../models/city.model';
import { nanoid } from 'nanoid';

export class BattleController {
  
  /**
   * 전투 시뮬레이션 실행 (테스트용)
   */
  static async simulate(req: Request, res: Response) {
    try {
      const { attackerId, defenderId } = req.body;
      const sessionId = req.body.session_id || 'sangokushi_default';

      const attacker = await General.findOne({ session_id: sessionId, no: attackerId });
      const defender = await General.findOne({ session_id: sessionId, no: defenderId });

      if (!attacker || !defender) {
        return res.status(404).json({ error: '장수를 찾을 수 없습니다.' });
      }

      // 국가 정보 조회
      const atkNation = await Nation.findOne({ session_id: sessionId, nation: attacker.getNationID() });
      const defNation = await Nation.findOne({ session_id: sessionId, nation: defender.getNationID() });
      const atkNationName = atkNation?.name || '재야';
      const defNationName = defNation?.name || '재야';

      // 전투 엔진 실행
      const engine = new SimpleBattleEngine(attacker, defender, atkNationName, defNationName);
      const result = engine.run();

      // 결과 저장
      const cityId = defender.getCityID(); // 보통 수비측 도시에서 전투 발생
      const city = await City.findOne({ session_id: sessionId, city: cityId });
      const cityName = city?.name || '황무지';

      const battleLog = new MudBattleLog({
        session_id: sessionId,
        battleId: nanoid(),
        cityId,
        cityName,
        attacker: {
          nationId: attacker.getNationID(),
          nationName: atkNationName,
          generalName: attacker.name,
          troops: attacker.getVar('crew')
        },
        defender: {
          nationId: defender.getNationID(),
          nationName: defNationName,
          generalName: defender.name,
          troops: defender.getVar('crew')
        },
        winner: result.winner,
        logs: result.logs,
        resultDetail: result.detail
      });

      await battleLog.save();

      // 실제 장수 데이터 업데이트 (병력 감소 등)
      // 주의: 테스트 시뮬레이션에서는 실제 데이터를 변경하지 않을 수도 있음.
      // 여기서는 시뮬레이션 결과만 반환하고 실제 반영은 하지 않음 (옵션 처리 가능)
      if (req.body.apply) {
         attacker.setVar('crew', Math.max(0, attacker.getVar('crew') - result.detail.attackerLoss));
         defender.setVar('crew', Math.max(0, defender.getVar('crew') - result.detail.defenderLoss));
         await attacker.save();
         await defender.save();
      }

      res.json({
        result: true,
        battleId: battleLog.battleId,
        winner: result.winner,
        logs: result.logs
      });

    } catch (error: any) {
      console.error('Battle simulation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 전투 로그 조회
   */
  static async getLog(req: Request, res: Response) {
    try {
      const { battleId } = req.params;
      const log = await MudBattleLog.findOne({ battleId });

      if (!log) {
        return res.status(404).json({ error: '전투 로그를 찾을 수 없습니다.' });
      }

      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
