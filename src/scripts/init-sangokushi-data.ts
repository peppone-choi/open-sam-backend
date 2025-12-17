/**
 * Initialize Sangokushi Game Data
 * 삼국지 초기 데이터 로딩
 *
 * Based on SangokushiData.ts - 코에이 삼국지11 실제 데이터
 */

import { mongoConnection } from '../db/connection';
import { General } from '../models/general.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { Session } from '../models/session.model';
import { FAMOUS_COMMANDERS } from '../engine/sangokushi/SangokushiData';
import { logger } from '../common/logger';

async function initSangokushiData(sessionId: string) {
  try {
    await mongoConnection.connect();

    logger.info(`[Sangokushi] Initializing data for session ${sessionId}`);

    // Check if session exists
    let session = await (Session as any).findOne({ session_id: sessionId });

    if (!session) {
      // Create new session
      session = await (Session as any).create({
        session_id: sessionId,
        name: '삼국지 OpenSAM',
        startdate: new Date(),
        data: {
          year: 190, // 초평 원년
          month: 1,
          season: 0,
          startyear: 190,
          turnterm: 60, // 60초 턴
          isunited: 0,
        },
      });
      logger.info(`[Sangokushi] Created new session: ${sessionId}`);
    }

    // Delete existing generals and nations for this session
    await (General as any).deleteMany({ session_id: sessionId });
    await (Nation as any).deleteMany({ session_id: sessionId });

    // Create nations (세력)
    const nations = [
      { nation: 1, name: '조조군', color: '#0066CC', capital: 1 },
      { nation: 2, name: '유비군', color: '#CC0000', capital: 2 },
      { nation: 3, name: '손권군', color: '#00CC66', capital: 3 },
    ];

    for (const nationData of nations) {
      await (Nation as any).create({
        session_id: sessionId,
        nation: nationData.nation,
        name: nationData.name,
        color: nationData.color,
        capital: nationData.capital,
        type: 0, // 일반 세력
        gold: 100000,
        rice: 200000,
        level: 1,
        // NOTE: data.war는 "선전포고 차단(전쟁 금지)" 플래그로 사용됨.
        // 0 = 전쟁 허용, 1 = 전쟁 금지
        war: 0,
        gennum: 0,
      });
      logger.info(`[Sangokushi] Created nation: ${nationData.name}`);
    }

    // Create cities (도시)
    const cities = [
      { city: 1, name: '허창', nation: 1, x: 5, y: 5, agri: 5000, comm: 5000, secu: 5000, def: 5000, wall: 5000 },
      { city: 2, name: '성도', nation: 2, x: 2, y: 8, agri: 4500, comm: 4500, secu: 4500, def: 4500, wall: 4500 },
      { city: 3, name: '건업', nation: 3, x: 9, y: 8, agri: 4800, comm: 4800, secu: 4800, def: 4800, wall: 4800 },
      { city: 4, name: '낙양', nation: 0, x: 6, y: 4, agri: 6000, comm: 6000, secu: 3000, def: 3000, wall: 3000 },
      { city: 5, name: '장안', nation: 0, x: 3, y: 3, agri: 5500, comm: 5500, secu: 3000, def: 3000, wall: 3000 },
    ];

    for (const cityData of cities) {
      await (City as any).create({
        session_id: sessionId,
        ...cityData,
        pop: 10000,
        pop_max: 50000,
        agri_max: 10000,
        comm_max: 10000,
        secu_max: 10000,
        def_max: 10000,
        wall_max: 10000,
        trade: 100,
        supply: 1, // 보급 정상
      });
      logger.info(`[Sangokushi] Created city: ${cityData.name} (${cityData.nation === 0 ? '중립' : `nation ${cityData.nation}`})`);
    }

    // Create famous generals (명장)
    const generalData = [
      { key: 'caocao', nation: 1, city: 1, npc: 0 }, // 조조 - 플레이어
      { key: 'liubei', nation: 2, city: 2, npc: 0 }, // 유비 - 플레이어
      { key: 'guanyu', nation: 2, city: 2, npc: 2 }, // 관우 - NPC
      { key: 'zhangfei', nation: 2, city: 2, npc: 2 }, // 장비 - NPC
      { key: 'zhugeliang', nation: 2, city: 2, npc: 2 }, // 제갈량 - NPC
      { key: 'lvbu', nation: 0, city: 4, npc: 2 }, // 여포 - 재야 NPC
      { key: 'simayi', nation: 1, city: 1, npc: 2 }, // 사마의 - NPC
      { key: 'zhaoyun', nation: 2, city: 2, npc: 2 }, // 조운 - NPC
    ];

    let generalNo = 1;

    for (const genData of generalData) {
      const commander = FAMOUS_COMMANDERS[genData.key];
      if (!commander) continue;

      await (General as any).create({
        session_id: sessionId,
        no: generalNo,
        name: commander.name,
        nation: genData.nation,
        city: genData.city,
        data: {
          npc: genData.npc,
          officer_level: genData.nation > 0 && generalNo <= 3 ? 12 : 5, // 군주 또는 일반

          // 능력치
          leadership: commander.leadership,
          strength: commander.strength,
          intel: commander.intelligence,
          politics: commander.politics,

          // 병과 적성
          leadership_exp: 0,
          strength_exp: 0,
          intel_exp: 0,

          // 자원
          gold: 10000,
          rice: 20000,
          crew: 5000,
          crew_max: 50000,

          // 훈련/사기
          train: 50,
          atmos: 50,

          // 경험치
          experience: 0,
          dedication: 0,

          // 병종
          crewtype: 0, // 창병

          // 특기
          special: commander.specialAbility,

          // 상태
          injury: 0,
          turntime: 0,
          belong: 0,
          con: 100,
          dedicationFrozen: 0,
        },
      });

      if (genData.nation > 0) {
        const nation = await (Nation as any).findOne({ session_id: sessionId, nation: genData.nation });
        if (nation) {
          nation.gennum = (nation.gennum || 0) + 1;
          await nation.save();
        }
      }

      logger.info(`[Sangokushi] Created general: ${commander.name} (${genData.nation === 0 ? '재야' : `nation ${genData.nation}`})`);
      generalNo++;
    }

    logger.info(`[Sangokushi] Data initialization completed for session ${sessionId}`);
    logger.info(`[Sangokushi] Created ${nations.length} nations, ${cities.length} cities, ${generalNo - 1} generals`);

    process.exit(0);
  } catch (error: any) {
    logger.error('[Sangokushi] Data initialization failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run with default session or provided argument
const sessionId = process.argv[2] || 'session_sangokushi_default';
initSangokushiData(sessionId);
