/**
 * LOGH 시나리오 데이터 로딩 테스트 스크립트
 * 
 * 사용법:
 * npx ts-node src/scripts/test-logh-scenario-loading.ts
 */

import mongoose from 'mongoose';
import { LoadScenarioDataService } from '../services/logh/LoadScenarioData.service';
import { Planet } from '../models/logh/Planet.model';
import { StarSystem } from '../models/logh/StarSystem.model';
import { MapGrid } from '../models/logh/MapGrid.model';
import { LoghCommander } from '../models/logh/Commander.model';
import { Fleet } from '../models/logh/Fleet.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/open-sam-logh-test';
const TEST_SESSION_ID = 'test-session-' + Date.now();

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✓ MongoDB 연결 성공: ${MONGODB_URI}`);
  } catch (error) {
    console.error('✗ MongoDB 연결 실패:', error);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log('✓ MongoDB 연결 종료');
}

async function runTest() {
  console.log('\n=== LOGH 시나리오 데이터 로딩 테스트 ===\n');
  console.log(`테스트 세션 ID: ${TEST_SESSION_ID}\n`);

  await connectDB();

  try {
    const loader = new LoadScenarioDataService();

    // 1. 전체 데이터 로드
    console.log('[1/5] 전체 시나리오 데이터 로드 중...');
    await loader.loadAll(TEST_SESSION_ID);

    // 2. 맵 그리드 확인
    console.log('\n[2/5] 맵 그리드 확인...');
    const mapGrid = await MapGrid.findOne({ session_id: TEST_SESSION_ID });
    if (mapGrid) {
      console.log(`  ✓ 맵 그리드: ${mapGrid.name} (${mapGrid.gridSize.width}x${mapGrid.gridSize.height})`);
      console.log(`  ✓ 항행 가능 셀: ${mapGrid.statistics.navigableCells} / ${mapGrid.statistics.totalCells} (${mapGrid.statistics.navigablePercentage}%)`);
    } else {
      console.log('  ✗ 맵 그리드를 찾을 수 없습니다.');
    }

    // 3. 성계 및 행성 확인
    console.log('\n[3/5] 성계 및 행성 확인...');
    const systemCount = await StarSystem.countDocuments({ session_id: TEST_SESSION_ID });
    const planetCount = await Planet.countDocuments({ session_id: TEST_SESSION_ID });
    console.log(`  ✓ 성계: ${systemCount}개`);
    console.log(`  ✓ 행성: ${planetCount}개`);

    // 주요 행성 샘플 출력
    const samplePlanets = await Planet.find({ session_id: TEST_SESSION_ID }).limit(5);
    console.log('  샘플 행성:');
    for (const planet of samplePlanets) {
      console.log(`    - ${planet.name} (${planet.owner}, 좌표: ${planet.gridCoordinates.x},${planet.gridCoordinates.y})`);
    }

    // 4. 제독(Commander) 확인
    console.log('\n[4/5] 제독(Commander) 확인...');
    const commanderCount = await LoghCommander.countDocuments({ session_id: TEST_SESSION_ID });
    const empireCount = await LoghCommander.countDocuments({ session_id: TEST_SESSION_ID, faction: 'empire' });
    const allianceCount = await LoghCommander.countDocuments({ session_id: TEST_SESSION_ID, faction: 'alliance' });
    console.log(`  ✓ 총 제독: ${commanderCount}명`);
    console.log(`  ✓ 제국: ${empireCount}명`);
    console.log(`  ✓ 동맹: ${allianceCount}명`);

    // 주요 제독 샘플 출력
    const sampleCommanders = await LoghCommander.find({ session_id: TEST_SESSION_ID }).limit(5);
    console.log('  샘플 제독:');
    for (const commander of sampleCommanders) {
      console.log(`    - ${commander.name} (${commander.faction}, 계급: ${commander.rank}, 함대: ${commander.fleetId || '없음'})`);
    }

    // 5. 함대 확인
    console.log('\n[5/5] 함대 확인...');
    const fleetCount = await Fleet.countDocuments({ session_id: TEST_SESSION_ID });
    const empireFleetCount = await Fleet.countDocuments({ session_id: TEST_SESSION_ID, faction: 'empire' });
    const allianceFleetCount = await Fleet.countDocuments({ session_id: TEST_SESSION_ID, faction: 'alliance' });
    console.log(`  ✓ 총 함대: ${fleetCount}개`);
    console.log(`  ✓ 제국: ${empireFleetCount}개`);
    console.log(`  ✓ 동맹: ${allianceFleetCount}개`);

    // 주요 함대 샘플 출력
    const sampleFleets = await Fleet.find({ session_id: TEST_SESSION_ID }).limit(5);
    console.log('  샘플 함대:');
    for (const fleet of sampleFleets) {
      const commander = await LoghCommander.findOne({ session_id: TEST_SESSION_ID, no: fleet.commanderId });
      console.log(`    - ${fleet.name} (지휘관: ${commander?.name || '없음'}, 함선: ${fleet.totalShips}척, 위치: ${fleet.strategicPosition.x},${fleet.strategicPosition.y})`);
    }

    // 6. 데이터 정합성 확인
    console.log('\n[6/6] 데이터 정합성 확인...');
    const commandersWithFleet = await LoghCommander.countDocuments({ 
      session_id: TEST_SESSION_ID, 
      fleetId: { $ne: null } 
    });
    console.log(`  ✓ 함대를 보유한 제독: ${commandersWithFleet}명 / ${commanderCount}명`);

    const fleetsWithCommander = await Fleet.countDocuments({
      session_id: TEST_SESSION_ID,
      commanderId: { $ne: null }
    });
    console.log(`  ✓ 지휘관이 할당된 함대: ${fleetsWithCommander}개 / ${fleetCount}개`);

    console.log('\n=== 테스트 완료 ===\n');

    // 7. 정리 (선택)
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('테스트 데이터를 삭제하시겠습니까? (y/N): ', async (answer: string) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\n테스트 데이터 삭제 중...');
        await loader.clearSession(TEST_SESSION_ID);
        console.log('✓ 테스트 데이터 삭제 완료');
      } else {
        console.log('\n테스트 데이터를 유지합니다.');
        console.log(`세션 ID: ${TEST_SESSION_ID}`);
      }
      
      readline.close();
      await disconnectDB();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n✗ 테스트 실패:', error);
    await disconnectDB();
    process.exit(1);
  }
}

// 스크립트 실행
runTest();
