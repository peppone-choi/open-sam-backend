/**
 * CreateAdminNPC.ts
 * 관리자 NPC 생성 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/CreateAdminNPC.php
 * 
 * 관리자가 지정한 특수 NPC를 생성
 * PHP에서는 NYI (Not Yet Implemented) 상태였으나 Node.js에서 구현
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { Nation } from '../../../models/nation.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';
import { JosaUtil } from '../../../utils/JosaUtil';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CreateAdminNPC');

// 관리자 NPC 설정 인터페이스
interface AdminNPCConfig {
  name: string;
  picturePath?: string;
  nationId?: number;
  cityId?: number | string;
  leadership: number;
  strength: number;
  intel: number;
  officerLevel?: number;
  birth?: number;
  death?: number;
  special?: string;
  special2?: string;
  npcType?: number;  // 기본값 5 (관리자 NPC)
  affinity?: number;
  gold?: number;
  rice?: number;
}

/**
 * 관리자 NPC 생성 액션
 */
export class CreateAdminNPC extends Action {
  private config: AdminNPCConfig;

  constructor(config?: AdminNPCConfig) {
    super();
    this.config = config || {
      name: '관리자NPC',
      leadership: 99,
      strength: 99,
      intel: 99
    };
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 설정이 없으면 NYI 반환 (PHP와 동일)
    if (!this.config || !this.config.name) {
      logger.info('[CreateAdminNPC] 설정 없음 - NYI');
      return [CreateAdminNPC.name, 'NYI'];
    }

    logger.info('[CreateAdminNPC] 관리자 NPC 생성 시작', {
      sessionId,
      name: this.config.name
    });

    // 시드 생성
    const seed = `${sessionId}_CreateAdminNPC_${this.config.name}_${year}_${month}`;
    const rng = new RandUtil(new LiteHashDRBG(seed));

    // 도시 ID 확인
    let cityId = this.config.cityId || 1;
    if (typeof cityId === 'string') {
      const city = await City.findOne({ session_id: sessionId, name: cityId });
      cityId = city?.city || 1;
    }

    // 국가 ID 확인 (기본값 0 = 재야)
    const nationId = this.config.nationId || 0;

    // 새 장수 ID 생성
    const maxGeneral = await General.findOne({ session_id: sessionId }).sort({ no: -1 });
    const newGeneralId = (maxGeneral?.no || 0) + 1;

    // 나이 계산
    const birthYear = this.config.birth || (year - 30);
    const deathYear = this.config.death || (year + 100);
    const age = year - birthYear;

    // 숙련도 초기값 (관리자 NPC는 높게 설정)
    const dexValues = {
      dex1: 9000,
      dex2: 9000,
      dex3: 9000,
      dex4: 9000,
      dex5: 9000
    };

    // 관리자 NPC 데이터
    const npcData = {
      session_id: sessionId,
      no: newGeneralId,
      name: this.config.name,
      nation: nationId,
      city: cityId,
      officer_level: this.config.officerLevel || 0,
      data: {
        no: newGeneralId,
        name: this.config.name,
        leadership: this.config.leadership,
        strength: this.config.strength,
        intel: this.config.intel,
        age,
        startage: age,
        birth: birthYear,
        death: deathYear,
        npc: this.config.npcType || 5,  // 관리자 NPC 타입
        affinity: this.config.affinity || 150,
        picture: this.config.picturePath || 'default.png',
        imgsvr: 0,
        gold: this.config.gold || 100000,
        rice: this.config.rice || 100000,
        crew: 0,
        train: 100,
        atmos: 100,
        injury: 0,
        experience: 0,
        dedication: 1000,
        special: this.config.special || 'None',
        special2: this.config.special2 || 'None',
        ...dexValues
      }
    };

    // 장수 생성 및 저장
    const general = new General(npcData);
    await general.save();
    await saveGeneral(sessionId, newGeneralId, npcData);

    // 로그 기록
    const actionLogger = new ActionLogger(0, nationId, year, month, sessionId);
    const josaYi = JosaUtil.pick(this.config.name, '이');
    actionLogger.pushGlobalHistoryLog(
      `<Y><b>【등장】</b></><Y>${this.config.name}</>${josaYi} 등장했습니다.`
    );
    await actionLogger.flush();

    logger.info('[CreateAdminNPC] 관리자 NPC 생성 완료', {
      sessionId,
      generalId: newGeneralId,
      name: this.config.name
    });

    return [CreateAdminNPC.name, { generalId: newGeneralId, name: this.config.name }];
  }
}

