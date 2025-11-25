/**
 * 모든 시나리오의 장수 근거지를 역사적으로 정확하게 수정
 */

import * as fs from 'fs';
import * as path from 'path';

const SCENARIOS_DIR = path.join(__dirname, '..', 'config', 'scenarios', 'sangokushi');

interface ScenarioFix {
  file: string;
  year: number;
  description: string;
  updates: Record<string, string>;
}

// 시나리오별 수정사항
const FIXES: ScenarioFix[] = [
  {
    file: 'scenario_1070.json',
    year: 208,
    description: '적벽대전 - 유비는 강하, 조조는 허창, 손권은 시상',
    updates: {
      // 유비 세력 - 강하
      '유비': '강하',
      '관우': '강하',
      '장비': '강하',
      '조운': '강하',
      '제갈량': '강하',
      '관평': '강하',
      '마량': '강하',
      '마속': '강하',
      '미축': '강하',
      '간옹': '강하',
      
      // 황충, 위연은 장사 (아직 유비에게 귀순 전)
      '황충': '장사',
      '위연': '장사',
    }
  },
  {
    file: 'scenario_1050.json',
    year: 200,
    description: '관도대전 - 원소 vs 조조',
    updates: {
      // 유비는 서주에서 패하고 원소에게 의탁
      '유비': '남피',
      '관우': '하비',  // 조조에게 항복
      '장비': '남피',
    }
  },
  {
    file: 'scenario_1090.json',
    year: 220,
    description: '삼국정립 - 위촉오 성립',
    updates: {
      // 촉한 - 성도
      '유비': '성도',
      '제갈량': '성도',
      '관우': '강릉',  // 219년 사망했지만 220년 시나리오에는 없을 수도
      '장비': '성도',
      '조운': '성도',
      '마초': '성도',
      '황충': '성도',
      '법정': '성도',
      '황권': '성도',
      
      // 오 - 건업
      '손권': '건업',
      '주유': '시상',  // 210년 사망
      
      // 위 - 허창/낙양
      '조조': '낙양',
      '조비': '허창',
    }
  },
  {
    file: 'scenario_1110.json',
    year: 228,
    description: '출사표(북벌) - 제갈량 북벌',
    updates: {
      // 촉한 - 한중에서 북벌 준비
      '제갈량': '한중',
      '마속': '한중',
      '왕평': '한중',
      '위연': '한중',
      '강유': '천수',  // 아직 촉에 귀순 전
      '조운': '한중',
      '장억': '한중',
      
      // 유선은 성도
      '유선': '성도',
      '비의': '성도',
      '동윤': '성도',
    }
  },
  {
    file: 'scenario_1030.json',
    year: 194,
    description: '군웅할거 - 여포, 원소, 조조 등',
    updates: {
      // 유비는 서주에서 도겸에게 의탁
      '유비': '서주',
      '관우': '서주',
      '장비': '서주',
      
      // 여포는 연주에서 조조와 대립
      '여포': '복양',
      '진궁': '복양',
      '고순': '복양',
      '장료': '복양',
      
      // 조조는 연주
      '조조': '복양',
      
      // 원소는 기주
      '원소': '업',
    }
  },
];

function applyFix(fix: ScenarioFix): void {
  const scenarioPath = path.join(SCENARIOS_DIR, fix.file);
  
  if (!fs.existsSync(scenarioPath)) {
    console.log(`⚠️  Skipping ${fix.file} - file not found`);
    return;
  }
  
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
  
  if (!scenario.generalCities) {
    scenario.generalCities = {};
  }
  
  let updated = 0;
  let notFound = 0;
  
  for (const [name, city] of Object.entries(fix.updates)) {
    // 장수가 시나리오에 존재하는지 확인
    const generalExists = scenario.general?.some((g: any) => 
      Array.isArray(g) && g[1] === name
    );
    
    if (generalExists) {
      scenario.generalCities[name] = city;
      updated++;
    } else {
      notFound++;
      console.log(`  ⚠️  ${name} not found in ${fix.file}`);
    }
  }
  
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 4), 'utf-8');
  
  console.log(`✅ ${fix.file} (${fix.year}년 ${fix.description})`);
  console.log(`   Updated: ${updated}, Not found: ${notFound}`);
}

async function main() {
  console.log('🔧 시나리오별 장수 근거지 역사적 수정 시작...\n');
  
  for (const fix of FIXES) {
    applyFix(fix);
  }
  
  console.log('\n✅ 모든 시나리오 수정 완료!');
}

main().catch(console.error);
