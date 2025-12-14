/**
 * RegNeutralNPC.ts
 * 재야 NPC 등록 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/RegNeutralNPC.php
 * 
 * 특정 재야 NPC를 게임에 등록 (NPC 타입 6)
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';

/**
 * 재야 NPC 등록 액션
 */
export class RegNeutralNPC extends Action {
  private affinity: number;
  private name: string;
  private picturePath: string;
  private nationId: number;
  private locatedCity: number | string;
  private leadership: number;
  private strength: number;
  private intel: number;
  private birth: number;
  private death: number;
  private ego: string | null;
  private char: string;
  private text: string;

  constructor(
    affinity: number,
    name: string,
    picturePath: string,
    nationId: number,
    locatedCity: number | string,
    leadership: number,
    strength: number,
    intel: number,
    birth: number = 160,
    death: number = 300,
    ego: string | null = null,
    char: string = '',
    text: string = ''
  ) {
    super();
    this.affinity = affinity;
    this.name = name;
    this.picturePath = picturePath;
    this.nationId = nationId;
    this.locatedCity = locatedCity;
    this.leadership = leadership;
    this.strength = strength;
    this.intel = intel;
    this.birth = birth;
    this.death = death;
    this.ego = ego;
    this.char = char;
    this.text = text;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;

    // 시드 생성
    const seed = `${sessionId}_RegNeutralNPC_${this.name}_${this.nationId}_${this.leadership}_${this.strength}_${this.intel}`;
    const rng = new RandUtil(new LiteHashDRBG(seed));

    // 도시 ID 확인
    let cityId = this.locatedCity;
    if (typeof cityId === 'string') {
      const city = await City.findOne({ session_id: sessionId, name: cityId });
      cityId = city?.city || 1;
    }

    // 새 장수 ID 생성
    const maxGeneral = await General.findOne({ session_id: sessionId }).sort({ no: -1 });
    const newGeneralId = (maxGeneral?.no || 0) + 1;

    // 나이 계산
    const age = year - this.birth;

    // 숙련도 초기값
    const dexValues = {
      dex1: rng.nextRangeInt(500, 1000),
      dex2: rng.nextRangeInt(500, 1000),
      dex3: rng.nextRangeInt(500, 1000),
      dex4: rng.nextRangeInt(500, 1000),
      dex5: rng.nextRangeInt(500, 1000)
    };

    // 재야 NPC 생성 (npc 타입 6)
    const npcData = {
      session_id: sessionId,
      no: newGeneralId,
      name: this.name,
      nation: this.nationId,
      city: cityId,
      officer_level: 0,  // 재야는 직위 없음
      data: {
        no: newGeneralId,
        name: this.name,
        leadership: this.leadership,
        strength: this.strength,
        intel: this.intel,
        age,
        startage: age,
        birth: this.birth,
        death: this.death,
        npc: 6,  // 재야 NPC 타입
        affinity: this.affinity,
        picture: this.picturePath,
        imgsvr: 0,
        gold: 1000,
        rice: 1000,
        crew: 0,
        train: 0,
        atmos: 0,
        injury: 0,
        experience: 0,
        dedication: 0,
        special: this.char || 'None',
        special2: 'None',
        ego: this.ego,
        npcText: this.text,
        ...dexValues
      }
    };

    const general = new General(npcData);
    await general.save();
    await saveGeneral(sessionId, newGeneralId, npcData);

    return [RegNeutralNPC.name, { generalId: newGeneralId, name: this.name }];
  }
}




