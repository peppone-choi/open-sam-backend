import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coreScenariosPath = path.join(__dirname, '../../core/hwe/scenario');
const outputBasePath = path.join(__dirname, '../config/scenarios');

// 검증할 시나리오 목록
const scenariosToVerify = [
  { id: 'sangokushi-alliance', oldFile: 'scenario_1020.json' },
  { id: 'sangokushi-heroes', oldFile: 'scenario_1030.json' },
  { id: 'sangokushi-guandu', oldFile: 'scenario_1050.json' },
  { id: 'sangokushi-yuan-split', oldFile: 'scenario_1060.json' },
  { id: 'sangokushi-chibi', oldFile: 'scenario_1070.json' },
];

console.log('🔍 시나리오 검증 시작...\n');

let totalErrors = 0;

for (const scenario of scenariosToVerify) {
  try {
    const originalPath = path.join(coreScenariosPath, scenario.oldFile);
    const convertedPath = path.join(outputBasePath, scenario.id, 'scenario.json');

    if (!fs.existsSync(originalPath)) {
      console.log(`❌ 원본 파일 없음: ${scenario.oldFile}`);
      continue;
    }

    if (!fs.existsSync(convertedPath)) {
      console.log(`❌ 변환본 파일 없음: ${scenario.id}`);
      continue;
    }

    const original = JSON.parse(fs.readFileSync(originalPath, 'utf-8'));
    const converted = JSON.parse(fs.readFileSync(convertedPath, 'utf-8'));
    const scenarioData = converted.data.scenario;

    console.log(`\n📋 ${scenario.id} (${original.title})`);
    console.log('━'.repeat(60));

    // 1. 기본 정보 비교
    const titleMatch = converted.name === original.title || converted.name === original.title.replace(/【역사모드\d+】\s*/, '').replace(/【역사모드\d+-\d+】\s*/, '').replace(/【IF모드\d+】\s*/, '');
    const yearMatch = converted.metadata.startYear === original.startYear;

    console.log(`제목: ${titleMatch ? '✅' : '❌'} (원본: "${original.title}", 변환: "${converted.name}")`);
    console.log(`시작연도: ${yearMatch ? '✅' : '❌'} (원본: ${original.startYear}, 변환: ${converted.metadata.startYear})`);

    // 2. 국가 수 비교
    const originalNations = original.nation?.length || 0;
    const convertedNations = scenarioData.nations?.length || 0;
    const nationMatch = originalNations === convertedNations;
    console.log(`국가 수: ${nationMatch ? '✅' : '❌'} (원본: ${originalNations}, 변환: ${convertedNations})`);

    if (!nationMatch) {
      console.log(`   ⚠️  국가 수 불일치!`);
      totalErrors++;
    }

    // 3. 외교 수 비교
    const originalDiplomacy = original.diplomacy?.length || 0;
    const convertedDiplomacy = scenarioData.diplomacy?.length || 0;
    const diplomacyMatch = originalDiplomacy === convertedDiplomacy;
    console.log(`외교 수: ${diplomacyMatch ? '✅' : '❌'} (원본: ${originalDiplomacy}, 변환: ${convertedDiplomacy})`);

    if (!diplomacyMatch) {
      console.log(`   ⚠️  외교 수 불일치!`);
      totalErrors++;
      
      // 외교 데이터 샘플 비교
      if (originalDiplomacy > 0 && convertedDiplomacy > 0) {
        console.log(`   원본 샘플 (처음 3개):`);
        original.diplomacy.slice(0, 3).forEach((d, i) => {
          console.log(`     ${i + 1}. [${d.join(', ')}]`);
        });
        console.log(`   변환본 샘플 (처음 3개):`);
        scenarioData.diplomacy.slice(0, 3).forEach((d, i) => {
          console.log(`     ${i + 1}. {from: ${d.from}, to: ${d.to}, type: ${d.type}, term: ${d.term}}`);
        });
      }
    }

    // 4. 장수 수 비교
    const originalGenerals = original.general?.length || 0;
    const convertedGenerals = scenarioData.generals?.length || 0;
    const generalMatch = originalGenerals === convertedGenerals;
    console.log(`장수 수: ${generalMatch ? '✅' : '❌'} (원본: ${originalGenerals}, 변환: ${convertedGenerals})`);

    if (!generalMatch) {
      console.log(`   ⚠️  장수 수 불일치!`);
      totalErrors++;
    }

    // 5. 이벤트 수 비교
    const originalEvents = original.events?.length || 0;
    const convertedEvents = scenarioData.events?.length || 0;
    const eventMatch = originalEvents === convertedEvents;
    console.log(`이벤트 수: ${eventMatch ? '✅' : '❌'} (원본: ${originalEvents}, 변환: ${convertedEvents})`);

    if (!eventMatch) {
      totalErrors++;
    }

    // 6. 국가 데이터 샘플 비교
    if (originalNations > 0 && convertedNations > 0) {
      const origNation = original.nation[0];
      const convNation = scenarioData.nations[0];
      
      console.log(`\n국가 데이터 샘플 비교 (첫 번째 국가):`);
      console.log(`  원본: [${origNation[0]}, ${origNation[1]}, ${origNation[2]}, ${origNation[3]}, "${origNation[4]}", ${origNation[5]}, "${origNation[6]}", ${origNation[7]}, [${origNation[8]?.join(', ') || '[]'}]]`);
      console.log(`  변환: {id: ${convNation.id}, name: "${convNation.name}", color: "${convNation.color}", gold: ${convNation.treasury.gold}, rice: ${convNation.treasury.rice}, tech: ${convNation.tech}, policy: "${convNation.policy}", level: ${convNation.level}, cities: [${convNation.cities.join(', ')}]}`);
      
      // 주요 필드 비교
      const nameMatch = origNation[0] === convNation.name;
      const colorMatch = origNation[1] === convNation.color;
      const goldMatch = origNation[2] === convNation.treasury.gold;
      const riceMatch = origNation[3] === convNation.treasury.rice;
      const techMatch = origNation[5] === convNation.tech;
      const policyMatch = origNation[6] === convNation.policy;
      const levelMatch = origNation[7] === convNation.level;
      
      console.log(`  이름: ${nameMatch ? '✅' : '❌'}, 색상: ${colorMatch ? '✅' : '❌'}, 금: ${goldMatch ? '✅' : '❌'}, 쌀: ${riceMatch ? '✅' : '❌'}, 기술: ${techMatch ? '✅' : '❌'}, 정책: ${policyMatch ? '✅' : '❌'}, 레벨: ${levelMatch ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error(`❌ 에러: ${scenario.id}`, error.message);
    totalErrors++;
  }
}

console.log(`\n${'='.repeat(60)}`);
if (totalErrors === 0) {
  console.log('✅ 모든 검증 통과!');
} else {
  console.log(`❌ 총 ${totalErrors}개의 불일치 발견`);
}

