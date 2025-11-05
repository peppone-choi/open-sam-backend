import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 변환할 시나리오 목록 (역사모드 전체 + 주요 가상모드)
const scenariosToConvert = [
  // 역사모드 전체 (15개)
  { id: 'sangokushi-huangjin', oldFile: 'scenario_1010.json', name: '황건적의 난', startYear: 181 },
  { id: 'sangokushi-alliance', oldFile: 'scenario_1020.json', name: '반동탁연합 결성', startYear: 190 },
  { id: 'sangokushi-alliance-zheng', oldFile: 'scenario_1021.json', name: '반동탁연합 결성(정사)', startYear: 190 },
  { id: 'sangokushi-heroes', oldFile: 'scenario_1030.json', name: '군웅할거', startYear: 191 },
  { id: 'sangokushi-heroes-zheng', oldFile: 'scenario_1031.json', name: '군웅축록', startYear: 191 },
  { id: 'sangokushi-emperor', oldFile: 'scenario_1040.json', name: '황제는 허도로', startYear: 193 },
  { id: 'sangokushi-emperor-yuanshu', oldFile: 'scenario_1041.json', name: '황제 원술', startYear: 193 },
  { id: 'sangokushi-guandu', oldFile: 'scenario_1050.json', name: '관도대전', startYear: 197 },
  { id: 'sangokushi-yuan-split', oldFile: 'scenario_1060.json', name: '원가의 분열', startYear: 199 },
  { id: 'sangokushi-chibi', oldFile: 'scenario_1070.json', name: '적벽대전', startYear: 204 },
  { id: 'sangokushi-yizhou', oldFile: 'scenario_1080.json', name: '익주 공방전', startYear: 210 },
  { id: 'sangokushi-threekingdoms', oldFile: 'scenario_1090.json', name: '삼국정립', startYear: 220 },
  { id: 'sangokushi-nanman', oldFile: 'scenario_1100.json', name: '칠종칠금', startYear: 222 },
  { id: 'sangokushi-chulsabpyo', oldFile: 'scenario_1110.json', name: '출사표', startYear: 225 },
  { id: 'sangokushi-baekma', oldFile: 'scenario_1120.json', name: '백마장군의 위세', startYear: 188 },
  // 가상모드
  { id: 'sangokushi-heroes-all', oldFile: 'scenario_2010.json', name: '영웅 난무 (가상)', startYear: 184, fiction: true },
];

const coreScenariosPath = path.join(__dirname, '../../core/hwe/scenario');
const outputBasePath = path.join(__dirname, '../config/scenarios');

/**
 * 레거시 시나리오 형식을 새 형식으로 변환
 */
function convertScenario(oldData) {
  const {
    title,
    startYear = 180,
    life,
    fiction = 0,
    const: gameConst = {},
    nation = [],
    diplomacy = [],
    general = [],
    events = [],
    map = {},
    history = []
  } = oldData;

  // 국가 데이터 변환
  const nations = nation.map((n, idx) => {
    const [name, color, gold, rice, desc, tech, policy, level, cities] = n;
    
    // 도시 목록 정리
    let cityList = [];
    if (cities && Array.isArray(cities)) {
      cityList = cities
        .filter(c => c && c.trim() !== '') // 빈 문자열 제거
        .flatMap(c => {
          // "하비.광릉" 같은 형식을 "하비", "광릉"으로 분리
          if (c.includes('.')) {
            return c.split('.').map(part => part.trim()).filter(part => part !== '');
          }
          return c.trim();
        })
        .filter(c => c !== ''); // 빈 문자열 최종 제거
    }
    
    return {
      id: idx + 1,
      name,
      color,
      description: desc || name,
      treasury: { gold, rice },
      tech: tech || 1000,
      policy: policy || '유가',
      level: level || 1,
      cities: cityList,
      capital: cityList[0] || null
    };
  });

  // 장수 데이터 변환
  const generals = general.map((g, idx) => {
    // [nationIdx, name, no, cityIdx, portrait, leadership, strength, intel, charm, age, deathYear, personality, special, quote]
    const [nationIdx, name, no, cityIdx, portrait, leadership, strength, intel, charm, age, deathYear, personality, special, quote] = g;
    
    return {
      id: no || idx + 1000,
      no: no || idx + 1000,
      name,
      nation: nationIdx || 0,
      city: cityIdx || 0,
      portrait,
      stats: {
        leadership: leadership || 50,
        strength: strength || 50,
        intel: intel || 50,
        charm: charm || 50
      },
      age: age || 25,
      deathYear: deathYear || 300,
      personality: personality || '유지',
      special: special || null,
      quote: quote || null
    };
  });

  // 외교 관계 변환
  const relations = diplomacy.map((d, idx) => {
    const [from, to, type, term] = d;
    return {
      id: idx + 1,
      from: from || 0,
      to: to || 0,
      type: type || 1, // 1=불가침, 7=동맹 등
      term: term || 0
    };
  });

  // 이벤트 변환
  const convertedEvents = events.map((e, idx) => {
    const [target, priority, condition, ...actions] = e;
    return {
      id: idx + 1,
      target,
      priority: priority || 1000,
      condition,
      actions
    };
  });

  // 기존 sangokushi와 동일한 구조로 변환
  return {
    id: oldData.id || 'unknown',
    name: title || 'Unknown Scenario',
    description: `${title} - 삼국지 역사 시나리오`,
    version: '1.0.0',
    roles: {
      SETTLEMENT: {
        collection: "cities",
        label: { ko: "도시", en: "City" }
      },
      COMMANDER: {
        collection: "generals",
        label: { ko: "장수", en: "General" }
      },
      FACTION: {
        collection: "nations",
        label: { ko: "국가", en: "Nation" }
      }
    },
    relations: {
      ASSIGNED_SETTLEMENT: {
        from: "COMMANDER",
        to: "SETTLEMENT",
        viaField: "city"
      },
      MEMBER_OF: {
        from: "COMMANDER",
        to: "FACTION",
        viaField: "nation"
      },
      OWNS: {
        from: "FACTION",
        to: "SETTLEMENT",
        viaField: "nation"
      }
    },
    data: {
      collections: {
        cities: {
          file: "../sangokushi/data/cities.json",
          root: "cities",
          idField: "id"
        },
        generals: {
          file: "../sangokushi/data/generals.json",
          root: "generals",
          idField: "id"
        },
        nations: {
          file: "../sangokushi/data/nations.json",
          root: "nations",
          idField: "id"
        }
      },
      assets: {
        constants: {
          file: "../sangokushi/data/constants.json"
        },
        units: {
          file: "../sangokushi/data/units.json",
          root: "units"
        },
        map: {
          file: "../sangokushi/data/map.json"
        }
      },
      scenario: {
        nations: nations,
        generals: generals,
        diplomacy: relations,
        events: convertedEvents,
        history: history || []
      }
    },
    config: {
      systems: {
        economy: { id: "economy", label: "경제 시스템", enabled: true },
        diplomacy: { id: "diplomacy", label: "외교 시스템", enabled: true },
        warfare: { id: "warfare", label: "전쟁 시스템", enabled: true }
      },
      resources: ["gold", "rice"],
      gameSettings: {
        defaultMaxGeneral: gameConst.defaultMaxGeneral || 600,
        joinRuinedNPCProp: gameConst.joinRuinedNPCProp || 0,
        npcBanMessageProb: gameConst.npcBanMessageProb || 1,
        ...gameConst
      }
    },
    metadata: {
      baseYear: startYear || 180,
      startYear: startYear || 180,
      life: life || 1,
      fiction: fiction || 0,
      mapName: map?.mapName || 'che',
      unitSet: 'che',
      totalCities: 94,
      totalRegions: 8,
      gameMode: 'turn',
      turnConfig: {
        defaultHour: 21,
        defaultMinute: 0,
        allowCustom: true,
        maxTurnsPerCycle: 30
      }
    }
  };
}

/**
 * 시나리오 변환 실행
 */
async function convertAllScenarios() {
  console.log('🚀 삼국지 시나리오 변환 시작...\n');

  for (const scenario of scenariosToConvert) {
    try {
      const oldFilePath = path.join(coreScenariosPath, scenario.oldFile);
      
      if (!fs.existsSync(oldFilePath)) {
        console.log(`⚠️  파일 없음: ${scenario.oldFile}`);
        continue;
      }

      console.log(`📖 읽는 중: ${scenario.oldFile}...`);
      const oldData = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'));
      
      // 새 형식으로 변환
      const newData = convertScenario({
        ...oldData,
        id: scenario.id,
        title: scenario.name || oldData.title
      });

      // 출력 디렉토리 생성
      const outputDir = path.join(outputBasePath, scenario.id);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // scenario.json 저장
      const scenarioJsonPath = path.join(outputDir, 'scenario.json');
      fs.writeFileSync(
        scenarioJsonPath,
        JSON.stringify(newData, null, 2),
        'utf-8'
      );

      console.log(`✅ 생성 완료: ${scenario.id}`);
      const scenarioData = newData.data.scenario || {};
      const diplomacyCount = scenarioData.diplomacy?.length || 0;
      console.log(`   - 국가: ${scenarioData.nations?.length || 0}개`);
      console.log(`   - 장수: ${scenarioData.generals?.length || 0}개`);
      console.log(`   - 외교: ${diplomacyCount}개${diplomacyCount > 0 ? ' ✅' : ''}`);
      console.log(`   - 이벤트: ${scenarioData.events?.length || 0}개\n`);

    } catch (error) {
      console.error(`❌ 에러: ${scenario.id}`, error.message);
    }
  }

  console.log('✨ 변환 완료!');
}

convertAllScenarios().catch(console.error);

