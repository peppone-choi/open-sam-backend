/**
 * 특정 시나리오의 장수 근거지를 대량 수정하는 스크립트
 * 
 * 사용법: 
 * 1. 이 파일의 SCENARIO_ID와 CITY_UPDATES를 수정
 * 2. npx ts-node scripts/update-scenario-cities.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 설정: 여기를 수정하세요
// ============================================

// 수정할 시나리오 ID
const SCENARIO_ID = 'scenario_1070';

// 장수 근거지 수정 내역
// - 키: 장수명
// - 값: 도시명 또는 도시ID
const CITY_UPDATES: Record<string, string | number> = {
  // 예시 1: 도시명으로 지정
  // '유비': '신야',
  // '관우': '신야',
  // '장비': '신야',
  
  // 예시 2: 도시ID로 지정
  // '조조': 2,  // 허창
  
  // 예시 3: 특정 장수 제거 (null 사용)
  // '장각': null,
};

// 일괄 변경: 특정 조건의 모든 장수
interface BulkUpdate {
  // 조건
  filter?: {
    nation?: number | number[];      // 특정 국가 소속
    currentCity?: string | string[];  // 현재 도시가 특정 값
  };
  // 변경할 도시
  newCity: string | number | null;
}

const BULK_UPDATES: BulkUpdate[] = [
  // 예시 1: 조나라 장수들을 모두 허창으로
  // {
  //   filter: { nation: 1 },
  //   newCity: '허창'
  // },
  
  // 예시 2: 영안에 있는 장수들을 모두 신야로
  // {
  //   filter: { currentCity: '영안' },
  //   newCity: '신야'
  // },
  
  // 예시 3: 오나라(3)와 촉나라(4) 장수들을 건업으로
  // {
  //   filter: { nation: [3, 4] },
  //   newCity: '건업'
  // },
];

// ============================================
// 실행 코드 (수정하지 마세요)
// ============================================

interface Scenario {
  title: string;
  general: any[];
  generalCities: Record<string, string | number>;
}

function loadScenario(scenarioId: string): Scenario {
  const scenarioPath = path.join(
    __dirname,
    '..',
    'config',
    'scenarios',
    'sangokushi',
    `${scenarioId}.json`
  );
  
  const content = fs.readFileSync(scenarioPath, 'utf-8');
  return JSON.parse(content);
}

function saveScenario(scenarioId: string, scenario: Scenario): void {
  const scenarioPath = path.join(
    __dirname,
    '..',
    'config',
    'scenarios',
    'sangokushi',
    `${scenarioId}.json`
  );
  
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 4), 'utf-8');
}

function applyUpdates(scenario: Scenario): { updated: number; removed: number } {
  let updated = 0;
  let removed = 0;
  
  // generalCities가 없으면 생성
  if (!scenario.generalCities) {
    scenario.generalCities = {};
  }
  
  // 개별 업데이트 적용
  for (const [name, city] of Object.entries(CITY_UPDATES)) {
    if (city === null) {
      if (scenario.generalCities[name]) {
        delete scenario.generalCities[name];
        removed++;
        console.log(`  Removed: ${name}`);
      }
    } else {
      scenario.generalCities[name] = city;
      updated++;
      console.log(`  Updated: ${name} -> ${city}`);
    }
  }
  
  // 일괄 업데이트 적용
  for (const bulkUpdate of BULK_UPDATES) {
    if (!bulkUpdate.filter) continue;
    
    for (const gen of scenario.general) {
      if (!Array.isArray(gen)) continue;
      
      const name = gen[1];
      const nationNo = gen[3];
      
      // 재야는 스킵
      if (nationNo === 0 || nationNo === 999) continue;
      
      // 필터 확인
      let matches = true;
      
      if (bulkUpdate.filter.nation !== undefined) {
        const targetNations = Array.isArray(bulkUpdate.filter.nation)
          ? bulkUpdate.filter.nation
          : [bulkUpdate.filter.nation];
        
        if (!targetNations.includes(nationNo)) {
          matches = false;
        }
      }
      
      if (matches && bulkUpdate.filter.currentCity !== undefined) {
        const currentCity = scenario.generalCities[name];
        const targetCities = Array.isArray(bulkUpdate.filter.currentCity)
          ? bulkUpdate.filter.currentCity
          : [bulkUpdate.filter.currentCity];
        
        if (!currentCity || !targetCities.includes(currentCity as string)) {
          matches = false;
        }
      }
      
      // 매칭되면 업데이트
      if (matches) {
        if (bulkUpdate.newCity === null) {
          if (scenario.generalCities[name]) {
            delete scenario.generalCities[name];
            removed++;
            console.log(`  Bulk removed: ${name}`);
          }
        } else {
          scenario.generalCities[name] = bulkUpdate.newCity;
          updated++;
          console.log(`  Bulk updated: ${name} -> ${bulkUpdate.newCity}`);
        }
      }
    }
  }
  
  return { updated, removed };
}

async function main() {
  console.log(`Loading scenario: ${SCENARIO_ID}`);
  const scenario = loadScenario(SCENARIO_ID);
  console.log(`Title: ${scenario.title}`);
  console.log(`Total generals: ${scenario.general.length}`);
  console.log(`Current generalCities: ${Object.keys(scenario.generalCities || {}).length}`);
  
  console.log('\nApplying updates...');
  const { updated, removed } = applyUpdates(scenario);
  
  console.log(`\nSaving scenario...`);
  saveScenario(SCENARIO_ID, scenario);
  
  console.log(`\n✅ Done!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Removed: ${removed}`);
  console.log(`  Total generalCities: ${Object.keys(scenario.generalCities).length}`);
}

main().catch(console.error);
