/**
 * 삼국지14 장수 소재지 데이터를 시나리오에 적용하는 스크립트
 * 
 * 사용법: npx ts-node scripts/apply-rtk14-cities.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// 삼국지14 도시명 → 우리 게임 도시명 매핑
const CITY_NAME_MAP: Record<string, string> = {
  // 그대로 사용
  '강릉': '강릉',
  '강주': '강주',
  '강하': '강하',
  '건녕': '건녕',
  '건업': '건업',
  '계': '계',
  '계양': '계양',
  '광릉': '광릉',
  '교지': '교지',
  '낙양': '낙양',
  '남피': '남피',
  '무릉': '무릉',
  '복양': '복양',
  '북평': '북평',
  '북해': '북해',
  '상용': '상용',
  '성도': '성도',
  '수춘': '수춘',
  '시상': '시상',
  '신야': '신야',
  '안정': '안정',
  '양양': '양양',
  '양평': '양평',
  '업': '업',
  '여강': '여강',
  '여남': '여남',
  '영릉': '영릉',
  '영안': '영안',
  '오': '오',
  '완': '완',
  '운남': '운남',
  '자동': '자동',
  '장사': '장사',
  '장안': '장안',
  '진류': '진류',
  '진양': '진양',
  '천수': '천수',
  '평원': '평원',
  '하비': '하비',
  '한중': '한중',
  '허창': '허창',
  '회계': '회계',
  
  // 변환 필요
  '면죽관': '면죽',
  '소패': '패',
  '호뢰관': '호로',
  
  // 대체 (우리 게임에 없는 도시)
  '무관': '장안',      // 무관 → 장안 (인접)
  '무위': '서량',      // 무위 → 서량 (서량 지역)
  '건안': '건업',      // 건안 → 건업 (인접)
  '양평관': '양평',    // 양평관 → 양평
};

interface RTK14General {
  id: number;
  name: string;
  gender: string;
  birthYear: number;
  appearYear: number;
  deathYear: number;
  city: string;
}

interface ScenarioGeneral {
  name: string;
  city: string | null;
}

// CSV 파싱
function parseRTK14CSV(csvPath: string): RTK14General[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const generals: RTK14General[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    generals.push({
      id: parseInt(cols[0]),
      name: cols[1],
      gender: cols[2],
      birthYear: parseInt(cols[3]),
      appearYear: parseInt(cols[4]),
      deathYear: parseInt(cols[5]),
      city: cols[6],
    });
  }
  
  return generals;
}

// 장수명으로 삼국지14 데이터 찾기
function findRTK14General(rtk14Generals: RTK14General[], name: string, birthYear?: number): RTK14General | undefined {
  // 정확히 일치
  let found = rtk14Generals.find(g => g.name === name);
  if (found) return found;
  
  // 숫자 제거 후 일치 (예: 노숙1 → 노숙)
  const nameWithoutNum = name.replace(/\d+$/, '');
  if (nameWithoutNum !== name) {
    // 같은 이름이 여러 명이면 생년으로 구분
    const candidates = rtk14Generals.filter(g => g.name === nameWithoutNum);
    if (candidates.length === 1) {
      return candidates[0];
    } else if (candidates.length > 1 && birthYear) {
      // 생년이 가장 가까운 사람 선택
      return candidates.reduce((best, curr) => {
        const bestDiff = Math.abs(best.birthYear - birthYear);
        const currDiff = Math.abs(curr.birthYear - birthYear);
        return currDiff < bestDiff ? curr : best;
      });
    }
    return candidates[0]; // fallback: 첫 번째 후보
  }
  
  return undefined;
}

// 시나리오 파일에 generalCities 추가
function applyToScenario(scenarioPath: string, rtk14Generals: RTK14General[]): void {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
  const generals = scenario.general || [];
  
  const generalCities: Record<string, string> = {};
  let matched = 0;
  let notFound = 0;
  
  for (const gen of generals) {
    if (!Array.isArray(gen)) continue;
    
    const name = gen[1];
    const nationNo = gen[3];
    const birthYear = gen.length > 14 ? gen[11] : gen[9]; // 신버전/구버전 구분
    
    // 재야(0) 또는 특수(999)는 스킵
    if (nationNo === 0 || nationNo === 999) continue;
    
    const rtk14Gen = findRTK14General(rtk14Generals, name, birthYear);
    if (rtk14Gen) {
      const mappedCity = CITY_NAME_MAP[rtk14Gen.city];
      if (mappedCity) {
        generalCities[name] = mappedCity;
        matched++;
      } else {
        console.log(`  [WARN] Unknown city: ${rtk14Gen.city} for ${name}`);
      }
    } else {
      notFound++;
    }
  }
  
  console.log(`  Matched: ${matched}, Not found: ${notFound}`);
  
  // generalCities 추가
  scenario.generalCities = generalCities;
  
  // 저장
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 4), 'utf-8');
}

// 메인
async function main() {
  const rtk14Path = path.join(__dirname, 'rtk14-general-cities.csv');
  const scenariosDir = path.join(__dirname, '..', 'config', 'scenarios', 'sangokushi');
  
  console.log('Loading RTK14 data...');
  const rtk14Generals = parseRTK14CSV(rtk14Path);
  console.log(`Loaded ${rtk14Generals.length} generals from RTK14`);
  
  // 시나리오 파일 목록
  const scenarioFiles = fs.readdirSync(scenariosDir)
    .filter(f => f.startsWith('scenario_') && f.endsWith('.json'))
    .filter(f => f !== 'scenario_0.json'); // 공백지 제외
  
  for (const file of scenarioFiles) {
    const scenarioPath = path.join(scenariosDir, file);
    console.log(`\nProcessing ${file}...`);
    applyToScenario(scenarioPath, rtk14Generals);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
