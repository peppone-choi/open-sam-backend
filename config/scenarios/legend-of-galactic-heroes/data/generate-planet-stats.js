/**
 * 행성 통계 생성 알고리즘
 * Legend of Galactic Heroes - Planet Stats Generator
 * 
 * 기반 데이터: gin7manual.txt의 자동생산 테이블 + planets-and-systems.json
 * 
 * 핵심 원리:
 * 1. 인구 (Population): 0~10,000 백만 명 (10억 = 1,000 백만)
 *    - 함대 1개 = 약 12,000척 = 약 600만 명 승무원 필요 (척당 500명 기준)
 *    - 함대 1개 유지 = 인구 200~300 백만 (20~30억) 필요 (모병률 2~3%)
 *    - 제국 12개 함대 = 총 3,000~4,000 백만 인구 필요
 *    - 동맹 12개 함대 = 총 3,000~4,000 백만 인구 필요
 * 
 * 2. Industry (공업력): 0~100
 *    - 조선소(hasShipyard) 보유 시 기본 60
 *    - 자동생산 함선 종류에 따라 가산점
 * 
 * 3. Technology (기술력): 0~100
 *    - 생산 가능한 최고 등급 함선에 따라 결정
 * 
 * 4. Defense (방어력): 0~100
 *    - 요새 = 90~100
 *    - 수도 = 80~90
 *    - 일반 행성 = 20~50
 * 
 * 5. Resources (자원): 0~100
 *    - 전략적 가치에 따라 결정
 * 
 * 6. Strategic Value: capital/critical/high/normal/low
 * 
 * 7. Loyalty (충성도): -100~+100
 *    - 초기값: 제국/동맹 본토 = 80~100, 분쟁지역 = -20~20
 */

const fs = require('fs');
const path = require('path');

// 데이터 로드
const planetsData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'planets-and-systems.json'),
    'utf-8'
  )
);

// 함선 등급별 기술력 매핑
const SHIP_TECH_LEVELS = {
  '戦艦Ⅰ': 50, '戦艦Ⅱ': 55, '戦艦Ⅲ': 60, '戦艦Ⅳ': 65, '戦艦Ⅴ': 70,
  '戦艦Ⅵ': 75, '戦艦Ⅶ': 80, '戦艦Ⅷ': 85,
  '高速戦艦Ⅰ': 55, '高速戦艦Ⅱ': 60, '高速戦艦Ⅲ': 65, '高速戦艦Ⅳ': 70, '高速戦艦Ⅴ': 75,
  '巡航艦Ⅰ': 45, '巡航艦Ⅱ': 50, '巡航艦Ⅲ': 55, '巡航艦Ⅳ': 60, '巡航艦Ⅴ': 65,
  '巡航艦Ⅵ': 70, '巡航艦Ⅶ': 75, '巡航艦Ⅷ': 80,
  '打撃巡航艦Ⅰ': 55, '打撃巡航艦Ⅱ': 60, '打撃巡航艦Ⅲ': 65,
  '駆逐艦Ⅰ': 40, '駆逐艦Ⅱ': 45, '駆逐艦Ⅲ': 50,
  '雷撃艇母艦Ⅰ': 50, '雷撃艇母艦Ⅱ': 55, '雷撃艇母艦Ⅲ': 60, '雷撃艇母艦Ⅳ': 65,
  '戦闘艇母艦Ⅰ': 50, '戦闘艇母艦Ⅱ': 55, '戦闘艇母艦Ⅲ': 60,
  '揚陸艦Ⅰ': 45, '揚陸艦Ⅱ': 50, '揚陸艦Ⅲ': 55, '揚陸艦Ⅳ': 60,
  '揚陸艇Ⅰ': 40, '揚陸艇Ⅱ': 45, '揚陸艇Ⅲ': 50, '揚陸艇Ⅳ': 55,
};

// gin7manual.txt의 자동생산 데이터 (수동 추출 - 6012~7000라인)
// 제국군 자동생산 행성 매핑
const EMPIRE_PRODUCTION_PLANETS = {
  'gaiesburg_fortress': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '雷撃艇母艦Ⅰ', '巡航艦Ⅵ'], // 가이에스부르크 요새
  'iserlohn_fortress': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '高速戦艦Ⅴ', '雷撃艇母艦Ⅳ'], // 이제를론 요새
  'rentenberg_fortress': ['戦艦Ⅰ', '駆逐艦Ⅱ'], // 렌텐베르크 요새
  'odin': ['戦艦Ⅰ', '高速戦艦Ⅰ', '高速戦艦Ⅱ', '巡航艦Ⅰ', '駆逐艦Ⅰ', '駆逐艦Ⅱ'], // 오딘 (수도)
  'hafen': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ'], // 하펜
  'nachrodt': ['巡航艦Ⅷ'], // 나흐로트
  'neuenrade': ['戦艦Ⅰ', '高速戦艦Ⅰ', '巡航艦Ⅰ', '駆逐艦Ⅰ'], // 노이엔라데
  'teutoburg': ['雷撃艇母艦Ⅱ', '雷撃艇母艦Ⅲ', '巡航艦Ⅶ'], // 토이토부르크
  'frey': ['戦艦Ⅰ', '駆逐艦Ⅱ'], // 프레이
};

// 동맹군 자동생산 행성 매핑
const ALLIANCE_PRODUCTION_PLANETS = {
  'heinessen': ['戦艦Ⅰ', '巡航艦Ⅰ', '巡航艦Ⅱ', '巡航艦Ⅲ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ', '戦闘艇母艦Ⅱ', '戦闘艇母艦Ⅲ'], // 하이네센 (수도)
  'santa_ana': ['戦艦Ⅰ', '巡航艦Ⅰ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'], // 산타 아나 (엘 파실)
  'salvador': ['揚陸艇Ⅳ'], // 살바도르
  'kampala': ['戦艦Ⅰ', '巡航艦Ⅰ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'], // 캄팔라 (엘곤)
  'bafra': ['戦艦Ⅵ'], // 바프라 (케림)
  'osiris': ['戦艦Ⅰ', '巡航艦Ⅰ', '巡航艦Ⅷ', '打撃巡航艦Ⅰ', '駆逐艦Ⅰ', '戦闘艇母艦Ⅰ'], // 오시리스 (시론)
};

/**
 * 행성의 생산 능력 기반 기술력 계산
 */
function calculateTechnologyLevel(planetId, faction, productionShips = []) {
  let tech = 30; // 기본값
  
  // 생산 함선이 있는 경우
  if (productionShips.length > 0) {
    const maxTech = Math.max(...productionShips.map(ship => SHIP_TECH_LEVELS[ship] || 40));
    tech = maxTech + 10; // 생산 가능 = 기술력 약간 상회
  }
  
  return Math.min(100, Math.max(20, tech));
}

/**
 * 행성의 공업력 계산
 */
function calculateIndustryLevel(planet, productionShips = []) {
  let industry = 20; // 기본값
  
  // 조선소 보유
  if (planet.hasShipyard) {
    industry = 60;
    
    // 생산 함선 종류에 따라 가산
    if (productionShips.length >= 8) industry += 30; // 대형 조선소
    else if (productionShips.length >= 5) industry += 20;
    else if (productionShips.length >= 3) industry += 10;
    else if (productionShips.length >= 1) industry += 5;
  }
  
  // 수도 보너스
  if (planet.isCapital) industry += 20;
  
  // 요새 보너스
  if (planet.type === 'fortress') industry += 15;
  
  return Math.min(100, Math.max(10, industry));
}

/**
 * 행성의 방어력 계산
 */
function calculateDefenseLevel(planet, systemData) {
  let defense = 30; // 기본값
  
  // 요새
  if (planet.type === 'fortress') {
    defense = 95;
    if (planet.planetId === 'iserlohn_fortress') defense = 100; // 이제를론 요새
    if (planet.planetId === 'gaiesburg_fortress') defense = 98; // 가이에스부르크 요새
  }
  // 수도
  else if (planet.isCapital) {
    defense = 85;
  }
  // 전략적 가치
  else {
    const value = planet.strategicValue || systemData.strategicValue;
    if (value === 'critical') defense = 70;
    else if (value === 'high') defense = 55;
    else if (value === 'normal') defense = 35;
    else if (value === 'low') defense = 25;
  }
  
  return Math.min(100, Math.max(10, defense));
}

/**
 * 행성의 자원 레벨 계산
 */
function calculateResourceLevel(planet, systemData) {
  let resources = 40; // 기본값
  
  // 전략적 가치 기반
  const value = planet.strategicValue || systemData.strategicValue;
  if (value === 'capital') resources = 90;
  else if (value === 'critical') resources = 80;
  else if (value === 'high') resources = 65;
  else if (value === 'normal') resources = 45;
  else if (value === 'low') resources = 30;
  
  // 역사적 중요성 보너스
  if (systemData.historicalSignificance) resources += 10;
  
  // 시설 보너스
  if (planet.facilities && planet.facilities.length > 0) {
    resources += planet.facilities.length * 3;
  }
  
  return Math.min(100, Math.max(20, resources));
}

/**
 * 행성의 인구 계산
 * 
 * 기준:
 * - 제국 총 인구: 약 25,000 백만 (250억) - 39개 성계 평균
 * - 동맹 총 인구: 약 13,000 백만 (130억) - 40개 성계 평균
 * - 수도: 20,000~30,000 백만
 * - 주요 행성: 3,000~8,000 백만
 * - 일반 행성: 300~1,500 백만
 * - 변경/분쟁 행성: 50~300 백만
 * 
 * 제국 평균: 640 백만/행성 (250억 ÷ 39성계)
 * 동맹 평균: 325 백만/행성 (130억 ÷ 40성계)
 */
function calculatePopulation(planet, systemData, faction) {
  let population = 300; // 기본 300 백만 (3억)
  
  // 수도
  if (planet.isCapital) {
    if (faction === 'empire') population = 50000; // 오딘: 500억
    else if (faction === 'alliance') population = 30000; // 하이네센: 300억
    else population = 8000; // 페잔: 80억
  }
  // 요새 (인구 적음)
  else if (planet.type === 'fortress') {
    population = 50; // 5천만 (군인 및 지원 인력만)
  }
  // 주요 생산 행성
  else if (planet.hasShipyard) {
    const value = planet.strategicValue || systemData.strategicValue;
    if (value === 'critical') population = 8000; // 80억
    else if (value === 'high') population = 5000; // 50억
    else population = 3000; // 30억
  }
  // 전략적 가치에 따라
  else {
    const value = planet.strategicValue || systemData.strategicValue;
    if (value === 'critical') population = 4000; // 40억
    else if (value === 'high') population = 2000; // 20억
    else if (value === 'normal') population = 1000; // 10억
    else population = 400; // 4억
  }
  
  // 분쟁 지역 감소
  if (systemData.territoryType === 'disputed') {
    population *= 0.5;
  }
  
  // 역사적 전투 발생지 감소 (전쟁 피해)
  if (systemData.historicalSignificance) {
    population *= 0.8;
  }
  
  // 팩션별 조정 (제국이 더 인구 많음)
  if (faction === 'empire' && !planet.isCapital) {
    population *= 3.0; // 제국 행성 +200%
  } else if (faction === 'alliance' && !planet.isCapital) {
    population *= 1.4; // 동맹 행성 +40%
  }
  
  // 랜덤 변동 ±30%
  const variance = 0.7 + Math.random() * 0.6;
  population = Math.floor(population * variance);
  
  return Math.max(10, Math.min(50000, population));
}

/**
 * 초기 충성도 계산
 */
function calculateLoyalty(planet, systemData, faction) {
  let loyalty = 70; // 기본값
  
  // 수도
  if (planet.isCapital) loyalty = 95;
  
  // 분쟁 지역
  else if (systemData.territoryType === 'disputed') {
    loyalty = 20 + Math.floor(Math.random() * 40); // 20~60
  }
  
  // 본토
  else {
    loyalty = 75 + Math.floor(Math.random() * 20); // 75~95
  }
  
  return Math.max(-100, Math.min(100, loyalty));
}

/**
 * 행성 ID에서 생산 함선 목록 가져오기
 */
function getProductionShips(planetId, faction) {
  if (faction === 'empire') {
    return EMPIRE_PRODUCTION_PLANETS[planetId] || [];
  } else if (faction === 'alliance') {
    return ALLIANCE_PRODUCTION_PLANETS[planetId] || [];
  }
  return [];
}

/**
 * 모든 행성에 통계 생성
 */
function generatePlanetStats() {
  const enhancedData = { ...planetsData };
  
  let totalEmpirePopulation = 0;
  let totalAlliancePopulation = 0;
  let totalPhezzanPopulation = 0;
  
  enhancedData.starSystems.forEach(system => {
    if (!system.planets) return;
    
    system.planets.forEach(planet => {
      const faction = planet.faction || system.faction;
      const productionShips = getProductionShips(planet.planetId, faction);
      
      // 통계 생성
      planet.stats = {
        population: calculatePopulation(planet, system, faction),
        industry: calculateIndustryLevel(planet, productionShips),
        technology: calculateTechnologyLevel(planet.planetId, faction, productionShips),
        defense: calculateDefenseLevel(planet, system),
        resources: calculateResourceLevel(planet, system),
        loyalty: calculateLoyalty(planet, system, faction)
      };
      
      // 생산 함선 정보 추가
      if (productionShips.length > 0) {
        planet.production = productionShips;
      }
      
      // 인구 집계
      if (faction === 'empire') totalEmpirePopulation += planet.stats.population;
      else if (faction === 'alliance') totalAlliancePopulation += planet.stats.population;
      else if (faction === 'phezzan') totalPhezzanPopulation += planet.stats.population;
    });
  });
  
  // 통계 요약
  enhancedData.statistics = {
    totalEmpirePopulation: totalEmpirePopulation,
    totalAlliancePopulation: totalAlliancePopulation,
    totalPhezzanPopulation: totalPhezzanPopulation,
    empirePopulationBillion: (totalEmpirePopulation / 1000).toFixed(1),
    alliancePopulationBillion: (totalAlliancePopulation / 1000).toFixed(1),
    phezzanPopulationBillion: (totalPhezzanPopulation / 1000).toFixed(1),
    note: '1 billion = 1,000 million. Fleet maintenance: ~250 million population per fleet (2.5% conscription rate)'
  };
  
  return enhancedData;
}

// 실행
console.log('행성 통계 생성 시작...\n');

const enhancedData = generatePlanetStats();

// 결과 저장
const outputPath = path.join(__dirname, 'planets-and-systems-with-stats.json');
fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2), 'utf-8');

console.log('✓ 행성 통계 생성 완료!');
console.log(`\n인구 통계:`);
console.log(`  제국 총 인구: ${enhancedData.statistics.empirePopulationBillion}억 명`);
console.log(`  동맹 총 인구: ${enhancedData.statistics.alliancePopulationBillion}억 명`);
console.log(`  페잔 총 인구: ${enhancedData.statistics.phezzanPopulationBillion}억 명`);
console.log(`\n함대 유지 기준:`);
console.log(`  함대 1개당 필요 인구: 약 2.5억 명 (모병률 2.5% 기준)`);
console.log(`  제국 12개 함대: ${(12 * 2.5).toFixed(1)}억 명 필요 → 현재 ${enhancedData.statistics.empirePopulationBillion}억 명 보유`);
console.log(`  동맹 12개 함대: ${(12 * 2.5).toFixed(1)}억 명 필요 → 현재 ${enhancedData.statistics.alliancePopulationBillion}억 명 보유`);
console.log(`\n결과 파일: ${outputPath}`);
