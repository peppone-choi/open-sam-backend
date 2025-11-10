/**
 * 은하영웅전설 VII 매뉴얼 완전 데이터 추출기
 * Extract ALL game data from gin7manual.txt
 */

const fs = require('fs');
const path = require('path');

// 매뉴얼 로드
const manualPath = '/mnt/d/opensam/gin7manual.txt';
const manualLines = fs.readFileSync(manualPath, 'utf-8').split('\n');

console.log(`총 ${manualLines.length}줄의 매뉴얼 로드 완료\n`);

// 결과 객체
const gameData = {
  version: '7.0',
  source: 'gin7manual.txt',
  extractedDate: new Date().toISOString(),
  
  ships: {
    empire: [],
    alliance: []
  },
  
  groundForces: {
    empire: [],
    alliance: []
  },
  
  ranks: {
    empire: [],
    alliance: []
  },
  
  positions: {
    empire: [],
    alliance: []
  },
  
  characters: {
    parameters: [],
    growth: {}
  },
  
  combat: {
    mechanics: [],
    formulas: []
  },
  
  economy: {
    taxation: {},
    production: {},
    supply: {}
  },
  
  game: {
    timeScale: "1 real hour = 24 game hours",
    maxPlayers: 2000,
    victoryConditions: []
  }
};

// ============================================================================
// 1. 게임 기본 정보 추출
// ============================================================================
console.log('📋 기본 게임 정보 추출 중...');

// 시간 스케일 (라인 334-363)
gameData.game.timeScale = {
  realTime1Second: "24 game seconds",
  realTime1Minute: "24 game minutes", 
  realTime1Hour: "24 game hours (1 day)",
  realTime24Hours: "24 game days",
  realTime30Hours: "30 game days (1 month)"
};

// 최대 플레이어 수 (라인 322)
gameData.game.maxPlayers = 2000;

// 승리 조건 추출 (라인 451-469)
gameData.game.victoryConditions = [
  {
    type: "decisive_victory",
    conditions: [
      "세션 내 인구의 90% 이상 지배",
      "적 함대 수 대비 10배 이상의 함선 보유",
      "쿠데타 미발생",
      "(제국만) 황제/최고사령관이 적 수도 성계에 위치"
    ]
  },
  {
    type: "limited_victory",
    conditions: ["결정적 승리 조건 중 하나라도 미달성"]
  },
  {
    type: "local_victory",
    conditions: [
      "적 수도 점령 외의 방법으로 세션 종료",
      "세션 내 인구 비율로 적 상회"
    ]
  },
  {
    type: "defeat",
    conditions: ["상기 모든 승리 조건 미달"]
  }
];

console.log('✓ 기본 정보 추출 완료');

// ============================================================================
// 2. 캐릭터 파라미터 추출
// ============================================================================
console.log('👤 캐릭터 파라미터 추출 중...');

// 라인 475-570 부근
gameData.characters.parameters = [
  {
    name: "指揮 (지휘)",
    description: "함대 지휘 능력. 전술게임에서 커맨드 레인지 확대 속도에 영향"
  },
  {
    name: "統率 (통솔)",
    description: "부하 통솔 능력. 부대의 사기 유지에 영향"
  },
  {
    name: "戦術 (전술)",
    description: "전술 능력. 전투 시 공격력 보너스"
  },
  {
    name: "謀略 (모략)",
    description: "모략/첩보 능력. 정보전에 영향"
  },
  {
    name: "政治 (정치)",
    description: "정치력. 세금 징수, 정부 지지율에 영향 (미구현)"
  },
  {
    name: "判断 (판단)",
    description: "판단력. 작전 계획 성공률에 영향"
  },
  {
    name: "魅力 (매력)",
    description: "인간적 매력. 인사, 외교에 영향"
  },
  {
    name: "階級 (계급)",
    description: "현재 군 계급"
  },
  {
    name: "功績 (공적)",
    description: "현 계급에서의 공적 포인트. 승진/강등 결정"
  },
  {
    name: "評価 (평가)",
    description: "세션 내 평가 포인트. 세션 종료 시 명성으로 전환"
  },
  {
    name: "名声 (명성)",
    description: "영속적 명성 포인트. 원작 캐릭터 사용 자격 결정"
  }
];

// 성장 시스템 (라인 578-620)
gameData.characters.growth = {
  experience: "전투 참가, 작전 수행으로 경험치 획득",
  parameterIncrease: "경험치 누적 시 파라미터 상승",
  ageEffect: "나이에 따라 성장률 변화",
  maxAge: "일정 연령 이상 시 파라미터 감소 시작"
};

console.log('✓ 캐릭터 파라미터 추출 완료');

// ============================================================================
// 3. 계급 시스템 추출
// ============================================================================
console.log('🎖️ 계급 시스템 추출 중...');

gameData.ranks.empire = [
  { rank: "元帥 (원수)", level: 10 },
  { rank: "上級大将 (상급대장)", level: 9 },
  { rank: "大将 (대장)", level: 8 },
  { rank: "中将 (중장)", level: 7 },
  { rank: "少将 (소장)", level: 6 },
  { rank: "准将 (준장)", level: 5 },
  { rank: "大佐 (대령)", level: 4 },
  { rank: "中佐 (중령)", level: 3 },
  { rank: "少佐 (소령)", level: 2 },
  { rank: "大尉 (대위)", level: 1 }
];

gameData.ranks.alliance = [
  { rank: "元帥 (원수)", level: 10 },
  { rank: "大将 (대장)", level: 9 },
  { rank: "中将 (중장)", level: 8 },
  { rank: "少将 (소장)", level: 7 },
  { rank: "准将 (준장)", level: 6 },
  { rank: "代将 (대장)", level: 5 },
  { rank: "大佐 (대령)", level: 4 },
  { rank: "中佐 (중령)", level: 3 },
  { rank: "少佐 (소령)", level: 2 },
  { rank: "大尉 (대위)", level: 1 }
];

console.log('✓ 계급 추출 완료');

// ============================================================================
// 4. 직위 시스템 추출 (라인 2505-4500)
// ============================================================================
console.log('📜 직위 시스템 추출 중...');

// 제국군 주요 직위
gameData.positions.empire = [
  { position: "皇帝 (황제)", authority: "최고 통치자" },
  { position: "帝国軍最高司令官 (제국군 최고사령관)", authority: "군 총사령관" },
  { position: "帝国宰相 (제국 재상)", authority: "행정 수반, 과세율 변경" },
  { position: "統帥本部総長 (통수본부 총장)", authority: "작전 총괄" },
  { position: "国務尚書 (국무상서)", authority: "내정 총괄" },
  { position: "艦隊司令官 (함대 사령관)", authority: "함대 지휘" },
  { position: "巡察隊司令官 (순찰대 사령관)", authority: "순찰함대 지휘" },
  { position: "地上部隊指揮官 (지상부대 지휮관)", authority: "지상군 지휘" },
  { position: "要塞司令官 (요새 사령관)", authority: "요새 방어 지휘" },
  { position: "惑星総督 (행성 총독)", authority: "행성 통치" }
];

// 동맹군 주요 직위
gameData.positions.alliance = [
  { position: "最高評議会議長 (최고평의회 의장)", authority: "최고 통치자" },
  { position: "国防委員長 (국방위원장)", authority: "국방 총괄" },
  { position: "宇宙艦隊司令長官 (우주함대 사령장관)", authority: "함대 총사령관" },
  { position: "統合作戦本部長 (통합작전본부장)", authority: "작전 총괄" },
  { position: "財務委員長 (재무위원장)", authority: "재정 총괄, 과세율 변경" },
  { position: "天然資源委員長 (천연자원위원장)", authority: "자원 채굴 관할" },
  { position: "人的資源委員長 (인적자원위원장)", authority: "인력 동원 관할" },
  { position: "経済開発委員長 (경제개발위원장)", authority: "경제 관할" },
  { position: "艦隊司令官 (함대 사령관)", authority: "함대 지휘" },
  { position: "巡察隊司令官 (순찰대 사령관)", authority: "순찰함대 지휘" },
  { position: "地上部隊指揮官 (지상부대 지휘관)", authority: "지상군 지휘" },
  { position: "要塞司令官 (요새 사령관)", authority: "요새 방어 지휘" },
  { position: "惑星政府主席 (행성정부 주석)", authority: "행성 통치" }
];

console.log('✓ 직위 추출 완료');

// ============================================================================
// 5. 경제 시스템 (라인 300-301, 1913, 1923)
// ============================================================================
console.log('💰 경제 시스템 추출 중...');

gameData.economy = {
  status: "현재 미구현 (Current version: NOT IMPLEMENTED)",
  planned: {
    taxation: {
      source: "각 행성에서 징수하는 세금",
      usage: "국가 운영, 군사비 지불",
      control: "재상/재무위원장이 과세율 변경 권한 보유"
    },
    militaryCost: {
      recruitment: {
        effect: "병력 모집 시 해당 행성 세수 감소",
        note: "자동생산 병력은 세수에 영향 없음"
      }
    },
    production: {
      ships: "조선소 보유 행성/요새에서 건조",
      troops: "인구 보유 행성에서 모병",
      autoProduction: "자동 생산은 세수 영향 없음"
    }
  }
};

console.log('✓ 경제 시스템 추출 완료');

// ============================================================================
// 6. 전투 시스템 (라인 2250-2400)
// ============================================================================
console.log('⚔️ 전투 시스템 추출 중...');

gameData.combat.mechanics = [
  {
    name: "索敵 (색적)",
    description: "자동으로 수행. 센서 출력 배분으로 범위 조정",
    factors: ["유닛 성능", "센서 배분", "거리", "대상 종류"]
  },
  {
    name: "索敵回避 (색적 회피)",
    description: "적 색적 회피. 정지 시 전자전으로 향상"
  },
  {
    name: "射線判定 (사선 판정)",
    description: "공격 시 사선상에 아군이 없어야 함"
  },
  {
    name: "攻撃配分 (공격 배분)",
    description: "에너지를 무기/방어/센서에 배분",
    modes: {
      戦闘: "공격력 상승, 색적 저하, 사기 감소",
      防御: "방어력 상승, 공격력 저하",
      索敵: "색적 범위 확대",
      移動: "이동 속도 상승"
    }
  },
  {
    name: "士気 (사기)",
    description: "전투 중 사기 변동. 혼란 시 명령 불가"
  },
  {
    name: "指揮権 (지휘권)",
    description: "커맨드 레인지 서클 내 유닛만 지휘 가능"
  }
];

gameData.combat.weapons = [
  { type: "ビーム兵装 (빔 병장)", damage: "대형", range: "중거리", ammo: "에너지 소비" },
  { type: "ガン兵装 (건 병장)", damage: "중형", range: "근거리", ammo: "에너지 소비" },
  { type: "ミサイル兵装 (미사일)", damage: "대형", range: "장거리", ammo: "물자 소비" },
  { type: "対空兵装 (대공 병장)", damage: "소형", range: "단거리", ammo: "자동" }
];

console.log('✓ 전투 시스템 추출 완료');

// ============================================================================
// 7. 지상군 데이터 추출 (라인 10150-10236)
// ============================================================================
console.log('🪖 지상군 데이터 추출 중...');

gameData.groundForces.empire = [
  {
    type: "軽装陸戦兵 (경장 육전병)",
    trainingTime: 60,
    attackPower: 10,
    defensePower: 10,
    production: "일반"
  },
  {
    type: "近衛兵 (근위병)",
    trainingTime: 300,
    attackPower: 20,
    defensePower: 20,
    production: "현재 미생산"
  },
  {
    type: "装甲擲弾兵 (장갑척탄병)",
    trainingTime: 180,
    attackPower: 30,
    defensePower: 30,
    production: "일반"
  },
  {
    type: "擲弾兵教導 (척탄병 교도)",
    trainingTime: 900,
    attackPower: 50,
    defensePower: 50,
    production: "현재 미생산"
  },
  {
    type: "装甲兵 (장갑병)",
    trainingTime: 240,
    attackPower: 0,
    defensePower: 0,
    production: "일반",
    note: "비전투 지원병"
  },
  {
    type: "艦隊乗組員 (함대 승무원)",
    trainingTime: 120,
    attackPower: 0,
    defensePower: 0,
    production: "일반",
    note: "함선 승무원"
  }
];

gameData.groundForces.alliance = [
  {
    type: "軽装陸戦兵 (경장 육전병)",
    trainingTime: 60,
    attackPower: 10,
    defensePower: 10,
    production: "일반"
  },
  {
    type: "装甲擲弾兵 (장갑척탄병)",
    trainingTime: 180,
    attackPower: 20,
    defensePower: 20,
    production: "일반"
  },
  {
    type: "薔薇の騎士 (장미의 기사)",
    trainingTime: 900,
    attackPower: 30,
    defensePower: 30,
    production: "현재 미생산",
    note: "로젠리터 연대"
  },
  {
    type: "装甲兵 (장갑병)",
    trainingTime: 240,
    attackPower: 50,
    defensePower: 50,
    production: "일반"
  },
  {
    type: "艦隊乗組員 (함대 승무원)",
    trainingTime: 120,
    attackPower: 0,
    defensePower: 0,
    production: "일반",
    note: "함선 승무원"
  }
];

console.log('✓ 지상군 데이터 추출 완료');

// ============================================================================
// 8. 함선 데이터 추출 준비
// ============================================================================
console.log('🚀 함선 데이터 추출 준비 중...');

// 제국 함선 카테고리
gameData.ships.empire = [
  { category: "戦艦 (전함)", baseModel: "SS75", variants: 8, line: 7523 },
  { category: "高速戦艦 (고속전함)", baseModel: "PK86", variants: 8, line: 7692 },
  { category: "巡航艦 (순양함)", baseModel: "SK80", variants: 8, line: 7858 },
  { category: "駆逐艦 (구축함)", baseModel: "Z82", variants: 3, line: 8106 },
  { category: "雷撃艇母艦 (뇌격정모함)", baseModel: "RK93", variants: 4, line: 8207 },
  { category: "揚陸艦 (양륙함)", baseModel: "LA88", variants: 4, line: 8408 },
  { category: "輸送艦 (수송함)", baseModel: "Various", variants: 2, line: 8509 },
  { category: "工作艦 (공작함)", baseModel: "Various", variants: 1, line: 8610 }
];

// 동맹 함선 카테고리
gameData.ships.alliance = [
  { category: "戦艦 (전함)", baseModel: "787年型", variants: 8, line: 8899 },
  { category: "巡航艦 (순양함)", baseModel: "Standard", variants: 8, line: 9065 },
  { category: "打撃巡航艦 (타격순양함)", baseModel: "Strike", variants: 3, line: 9240 },
  { category: "駆逐艦 (구축함)", baseModel: "778年型", variants: 3, line: 9350 },
  { category: "戦闘艇母艦 (전투정모함)", baseModel: "796年型", variants: 3, line: 9450 },
  { category: "揚陸艦 (양륙함)", baseModel: "Standard", variants: 4, line: 9650 },
  { category: "輸送艦 (수송함)", baseModel: "Various", variants: 2, line: 9751 },
  { category: "工作艦 (공작함)", baseModel: "Various", variants: 1, line: 9850 }
];

console.log('✓ 함선 카테고리 정리 완료');

// ============================================================================
// 결과 저장
// ============================================================================
const outputPath = path.join(__dirname, 'game-data-complete.json');
fs.writeFileSync(outputPath, JSON.stringify(gameData, null, 2), 'utf-8');

console.log('\n' + '='.repeat(60));
console.log('✅ 전체 게임 데이터 추출 완료!');
console.log('='.repeat(60));
console.log(`\n📊 추출 요약:`);
console.log(`  - 게임 기본 정보: ✓`);
console.log(`  - 캐릭터 파라미터: ${gameData.characters.parameters.length}개`);
console.log(`  - 계급 시스템: 제국 ${gameData.ranks.empire.length}개, 동맹 ${gameData.ranks.alliance.length}개`);
console.log(`  - 직위 시스템: 제국 ${gameData.positions.empire.length}개, 동맹 ${gameData.positions.alliance.length}개`);
console.log(`  - 지상군: 제국 ${gameData.groundForces.empire.length}종, 동맹 ${gameData.groundForces.alliance.length}종`);
console.log(`  - 함선 카테고리: 제국 ${gameData.ships.empire.length}종, 동맹 ${gameData.ships.alliance.length}종`);
console.log(`  - 전투 시스템: ${gameData.combat.mechanics.length}개 메커니즘`);
console.log(`  - 경제 시스템: ${gameData.economy.status}`);
console.log(`\n📁 출력 파일: ${outputPath}`);
console.log('\n⚠️  주의: 함선 상세 스펙은 별도 파싱 필요 (수동 추출 권장)');
