import dotenv from 'dotenv';
dotenv.config();

import { mongoConnection } from '../src/db/connection';
import { General } from '../src/models/general.model';

/**
 * 잘못된 NPC 값을 수정하는 스크립트
 * 
 * 시나리오 JSON의 npc 값을 제대로 파싱하지 못해 잘못 저장된 장수들을 수정합니다.
 */

async function fixNPCValues() {
  try {
    console.log('MongoDB 연결 중...');
    await mongoConnection.connect(process.env.MONGODB_URI!);
    console.log('✅ MongoDB 연결 성공');

    const sessionId = process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    console.log(`세션: ${sessionId}`);

    // 시나리오 JSON 로드
    const scenarioPath = '/mnt/d/opensam/open-sam-backend/config/scenarios/sangokushi/scenario_1010.json';
    const fs = require('fs');
    const scenarioData = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
    
    console.log(`시나리오에 ${scenarioData.general.length}명의 장수 정보 발견`);

    // JSON 데이터를 Map으로 변환 (ID 기준)
    const npcMap = new Map<number, number>();
    for (const genTemplate of scenarioData.general) {
      const id = genTemplate[2];     // ID
      const npc = genTemplate[3];    // NPC 타입
      if (id && npc !== null && npc !== undefined) {
        npcMap.set(id, npc);
      }
    }

    console.log(`${npcMap.size}명의 장수 NPC 매핑 생성`);

    // DB에서 장수 조회
    const generals = await General.find({ session_id: sessionId });
    console.log(`DB에 ${generals.length}명의 장수 존재`);

    let updated = 0;
    let skipped = 0;

    for (const general of generals) {
      const generalNo = general.no || general.data?.no;
      const currentNpc = general.npc || general.data?.npc;
      const correctNpc = npcMap.get(generalNo);

      if (correctNpc !== undefined && currentNpc !== correctNpc) {
        console.log(`장수 ${generalNo} (${general.name || general.data?.name}): npc ${currentNpc} → ${correctNpc}`);
        
        // npc 필드 업데이트
        general.npc = correctNpc;
        if (general.data) {
          general.data.npc = correctNpc;
        }
        general.markModified('npc');
        general.markModified('data');
        
        await general.save();
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✅ 완료: ${updated}명 수정, ${skipped}명 스킵`);
    
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  } finally {
    await mongoConnection.disconnect();
    process.exit(0);
  }
}

fixNPCValues();
