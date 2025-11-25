/**
 * 전체 장수 근거지 검증 및 수정 스크립트
 * 1. 각 시나리오별로 장수 소속 국가와 근거지 도시 일치 확인
 * 2. 불일치 시 소속 국가의 도시로 자동 재배정
 * 3. RTK14 데이터 + 자동 배정으로 전체 장수 근거지 완성
 */

import fs from 'fs';
import path from 'path';

interface ScenarioData {
  title: string;
  nation: any[][];
  general: any[][];
  generalCities?: { [key: string]: string };
}

// 도시 매핑 테이블
const cityMapping: { [key: string]: string } = {
  '낙양': '낙양', '장안': '장안', '허창': '허창', '완': '완',
  '업': '업', '진류': '진류', '북평': '북평', '계': '계',
  '양양': '양양', '강릉': '강릉', '강하': '강하', '장사': '장사',
  '건업': '건업', '오': '오', '회계': '회계', '시상': '시상',
  '성도': '성도', '한중': '한중', '영안': '영안', '건녕': '건녕',
  '평원': '평원', '북해': '북해', '서주': '서주', '하비': '하비',
  '소패': '패', '패': '패', '수춘': '수춘', '여강': '여강',
  '남피': '남피', '복양': '복양', '진양': '진양', '상당': '상당',
  '안정': '안정', '천수': '천수', '무위': '무위', '서량': '서량',
  '남만': '남만', '운남': '운남', '교지': '교지', '합비': '합비',
  '장판': '장판', '신야': '신야', '관도': '관도', '정도': '정도',
  '호관': '호관', '무릉': '무릉', '강동': '건업',
  '기산': '기산', '역경': '역경', '계교': '계교',
  '여남': '여남', '홍농': '홍농', '함곡': '함곡', '면죽': '면죽',
  '자동': '자동', '강주': '강주', '영창': '영창', '마속': '마속'
};

// RTK14 소재지 데이터 로드
function loadRTK14Cities(): Map<string, string> {
  const csvPath = path.join(__dirname, 'rtk14-general-cities.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1); // 헤더 제외
  
  const cities = new Map<string, string>();
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const [name, city] = line.split(',').map(s => s.trim());
    if (name && city) {
      const mappedCity = cityMapping[city] || city;
      cities.set(name, mappedCity);
    }
  }
  
  return cities;
}

// 시나리오 파일 로드
function loadScenario(filename: string): ScenarioData {
  const filepath = path.join(__dirname, '../config/scenarios/sangokushi', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

// 시나리오 파일 저장
function saveScenario(filename: string, data: ScenarioData): void {
  const filepath = path.join(__dirname, '../config/scenarios/sangokushi', filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 4), 'utf-8');
}

// 장수명 추출 (배열 인덱스 1)
function getGeneralName(general: any[]): string {
  return general[1];
}

// 장수 소속 ID (배열 인덱스 3) - scenario-reset.service.ts 주석 참조
function getGeneralNationId(general: any[]): number {
  return general[3];
}

// 장수 소속 도시 (배열 인덱스 4)
function getGeneralCity(general: any[]): string | null {
  return general[4];
}

// 검증 및 수정
function validateAndFixScenario(filename: string, rtk14Cities: Map<string, string>): void {
  console.log(`\n=== ${filename} 처리 중 ===`);
  
  const scenario = loadScenario(filename);
  
  if (!scenario.general || scenario.general.length === 0) {
    console.log('  ⚠️  장수 데이터 없음');
    return;
  }
  
  // generalCities 완전 초기화 - 각 시나리오마다 독립적으로 배정
  scenario.generalCities = {};
  
  // 국가별 정보 파싱 (scenario-reset.service.ts와 동일한 로직)
  const nationById = new Map<number, { name: string; cities: string[] }>();
  
  for (let i = 0; i < scenario.nation.length; i++) {
    const nationData = scenario.nation[i];
    const nationId = i + 1; // 국가 ID는 1부터 시작 (scenario-reset.service.ts의 nationIdCounter)
    const nationName = nationData[0];
    const cities = nationData[8] || []; // 9번째 요소가 도시 배열
    
    nationById.set(nationId, { name: nationName, cities });
  }
  
  let totalGenerals = scenario.general.length;
  let assignedCount = 0;
  let rtk14Matches = 0;
  let generalFieldMatches = 0;
  let capitalFallbacks = 0;
  let noNationCount = 0;
  
  // 각 장수 처리
  for (const general of scenario.general) {
    const name = getGeneralName(general);
    const nationId = getGeneralNationId(general);
    const nation = nationById.get(nationId);
    
    // 소속 국가 없음 (재야 등)
    if (!nation || nation.cities.length === 0) {
      noNationCount++;
      continue;
    }
    
    let assignedCity: string | undefined;
    
    // 1. RTK14 데이터 확인 - 해당 국가 영토 내에 있을 경우만
    const rtk14City = rtk14Cities.get(name);
    if (rtk14City && nation.cities.includes(rtk14City)) {
      assignedCity = rtk14City;
      rtk14Matches++;
    }
    
    // 2. 장수 배열의 city 필드 확인 - 해당 국가 영토 내에 있을 경우만
    if (!assignedCity) {
      const generalCity = getGeneralCity(general);
      if (generalCity && nation.cities.includes(generalCity)) {
        assignedCity = generalCity;
        generalFieldMatches++;
      }
    }
    
    // 3. 국가 수도 (첫 번째 도시) - fallback
    if (!assignedCity && nation.cities.length > 0) {
      assignedCity = nation.cities[0];
      capitalFallbacks++;
    }
    
    // 배정
    if (assignedCity) {
      scenario.generalCities[name] = assignedCity;
      assignedCount++;
    }
  }
  
  // 저장
  saveScenario(filename, scenario);
  
  const belongingGenerals = totalGenerals - noNationCount;
  
  console.log(`  ✅ 전체 장수: ${totalGenerals}명`);
  console.log(`  📌 소속 장수: ${belongingGenerals}명 (재야 제외: ${noNationCount}명)`);
  console.log(`  ✅ 배정 완료: ${assignedCount}명 (${((assignedCount/belongingGenerals)*100).toFixed(1)}%)`);
  console.log(`     📍 RTK14 매칭: ${rtk14Matches}명`);
  console.log(`     📍 장수필드 매칭: ${generalFieldMatches}명`);
  console.log(`     📍 수도 배정: ${capitalFallbacks}명`);
}

// 모든 시나리오 처리
function processAllScenarios(): void {
  const rtk14Cities = loadRTK14Cities();
  console.log(`\n📊 RTK14 데이터 로드: ${rtk14Cities.size}명`);
  
  const scenarios = [
    'scenario_1010.json',
    'scenario_1020.json',
    'scenario_1021.json',
    'scenario_1030.json',
    'scenario_1031.json',
    'scenario_1040.json',
    'scenario_1041.json',
    'scenario_1050.json',
    'scenario_1060.json',
    'scenario_1070.json',
    'scenario_1080.json',
    'scenario_1090.json',
    'scenario_1100.json',
    'scenario_1110.json',
    'scenario_1120.json',
    'scenario_2010.json',
    'scenario_2011.json',
    'scenario_2020.json'
  ];
  
  let totalScenarios = 0;
  let totalGeneralsProcessed = 0;
  let totalAssigned = 0;
  
  for (const scenario of scenarios) {
    try {
      validateAndFixScenario(scenario, rtk14Cities);
      totalScenarios++;
    } catch (error) {
      console.error(`❌ ${scenario} 처리 실패:`, error);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ 전체 시나리오 처리 완료: ${totalScenarios}개`);
  console.log('='.repeat(60));
}

// 실행
processAllScenarios();
