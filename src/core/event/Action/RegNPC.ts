/**
 * RegNPC.ts
 * NPC 등록 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/RegNPC.php
 * 
 * 특정 NPC를 게임에 등록
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

/**
 * NPC 등록 액션
 */
export class RegNPC extends Action {
  private affinity: number;
  private name: string;
  private picturePath: string;
  private nationId: number;
  private locatedCity: number | string;
  private leadership: number;
  private strength: number;
  private intel: number;
  private officerLevel: number;
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
    officerLevel: number,
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
    this.officerLevel = officerLevel;
    this.birth = birth;
    this.death = death;
    this.ego = ego;
    this.char = char;
    this.text = text;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 시드 생성
    const seed = `${sessionId}_RegNPC_${this.name}_${this.nationId}_${this.leadership}_${this.strength}_${this.intel}`;
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

    // NPC 생성
    const npcData = {
      session_id: sessionId,
      no: newGeneralId,
      name: this.name,
      nation: this.nationId,
      city: cityId,
      officer_level: this.officerLevel,
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
        npc: 2,  // NPC 타입
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

    return [RegNPC.name, { generalId: newGeneralId, name: this.name }];
  }
}










