const fs = require('fs');
const path = require('path');

// PHP 소스에서 설정 추출
function extractSamConfig() {
    const gameConstPath = path.join(__dirname, '../sam/hwe/sammo/GameConstBase.php');
    const cityConstPath = path.join(__dirname, '../sam/hwe/sammo/CityConstBase.php');
    const gameUnitConstPath = path.join(__dirname, '../sam/hwe/sammo/GameUnitConstBase.php');
    
    const gameConst = fs.readFileSync(gameConstPath, 'utf8');
    const cityConst = fs.readFileSync(cityConstPath, 'utf8');
    const gameUnitConst = fs.readFileSync(gameUnitConstPath, 'utf8');
    
    // 도시 데이터 추출 (전체)
    const cities = extractCities(cityConst);
    
    // 유닛 데이터 추출
    const units = extractUnits(gameUnitConst);
    
    // 게임 상수 추출
    const gameConstants = extractGameConstants(gameConst);
    
    // 아이템 데이터 추출
    const items = extractItems(gameConst);
    
    // 명령어 데이터 추출
    const commands = extractCommands(gameConst);
    
    // 특기 추출
    const specials = extractSpecials(gameConst);
    
    // 성향 추출
    const personalities = extractPersonalities(gameConst);
    
    // 국가 타입 추출
    const nationTypes = extractNationTypes(gameConst);
    
    return {
        session_id: 'sangokushi_sam',
        name: '삼국지 HiDChe (SAM)',
        version: '1.0.0',
        extracted_from: 'sam/hwe/sammo PHP source',
        game_mode: 'turn',
        
        game_constants: gameConstants,
        cities: cities,
        unit_types: units,
        items: items,
        commands: commands,
        special_domestic: specials.domestic,
        special_war: specials.war,
        nation_types: nationTypes,
        personalities: personalities
    };
}

// 도시 추출
function extractCities(content) {
    const cityRegex = /\[\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),\s*'([^']+)',\s*(\d+),\s*(\d+),\s*\[([^\]]+)\]\]/g;
    const cities = {};
    let match;
    
    while ((match = cityRegex.exec(content)) !== null) {
        const neighbors = match[13].split(',').map(n => n.trim().replace(/^'|'$/g, ''));
        cities[match[1]] = {
            id: parseInt(match[1]),
            name: match[2],
            level: match[3],
            population: parseInt(match[4]),
            agriculture: parseInt(match[5]),
            commerce: parseInt(match[6]),
            security: parseInt(match[7]),
            defense: parseInt(match[8]),
            wall: parseInt(match[9]),
            region: match[10],
            x: parseInt(match[11]),
            y: parseInt(match[12]),
            neighbors: neighbors
        };
    }
    
    return cities;
}

// 유닛 추출 (완성 필요)
function extractUnits(content) {
    // GameUnitConstBase.php 구조에 맞게 추출
    const units = {};
    
    // 기본 유닛 타입 (PHP 소스 참고)
    const basicUnits = {
        "1000": { id: 1000, name: "성벽", type: "castle" },
        "1100": { id: 1100, name: "보병", type: "footman" },
        "1200": { id: 1200, name: "궁병", type: "footman" },
        "1300": { id: 1300, name: "기병", type: "footman" }
    };
    
    return basicUnits;
}

// 게임 상수 추출
function extractGameConstants(content) {
    const extractConst = (name, defaultValue = null) => {
        const regex = new RegExp(`public static \\$${name}\\s*=\\s*([^;]+);`, 's');
        const m = content.match(regex);
        if (!m) return defaultValue;
        
        let value = m[1].trim();
        
        // 숫자
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
        }
        
        // 문자열
        if (value.startsWith("'") || value.startsWith('"')) {
            return value.slice(1, -1);
        }
        
        // null
        if (value === 'null') {
            return null;
        }
        
        return value;
    };
    
    return {
        title: extractConst('title'),
        mapName: extractConst('mapName'),
        unitSet: extractConst('unitSet'),
        develrate: extractConst('develrate'),
        upgradeLimit: extractConst('upgradeLimit'),
        dexLimit: extractConst('dexLimit'),
        defaultAtmosLow: extractConst('defaultAtmosLow'),
        defaultTrainLow: extractConst('defaultTrainLow'),
        defaultAtmosHigh: extractConst('defaultAtmosHigh'),
        defaultTrainHigh: extractConst('defaultTrainHigh'),
        maxAtmosByCommand: extractConst('maxAtmosByCommand'),
        maxTrainByCommand: extractConst('maxTrainByCommand'),
        maxAtmosByWar: extractConst('maxAtmosByWar'),
        maxTrainByWar: extractConst('maxTrainByWar'),
        trainDelta: extractConst('trainDelta'),
        atmosDelta: extractConst('atmosDelta'),
        atmosSideEffectByTraining: extractConst('atmosSideEffectByTraining'),
        trainSideEffectByAtmosTurn: extractConst('trainSideEffectByAtmosTurn'),
        sabotageDefaultProb: extractConst('sabotageDefaultProb'),
        sabotageProbCoefByStat: extractConst('sabotageProbCoefByStat'),
        sabotageDefenceCoefByGeneralCnt: extractConst('sabotageDefenceCoefByGeneralCnt'),
        sabotageDamageMin: extractConst('sabotageDamageMin'),
        sabotageDamageMax: extractConst('sabotageDamageMax'),
        basecolor: extractConst('basecolor'),
        basecolor2: extractConst('basecolor2'),
        basecolor3: extractConst('basecolor3'),
        basecolor4: extractConst('basecolor4'),
        armperphase: extractConst('armperphase'),
        basegold: extractConst('basegold'),
        baserice: extractConst('baserice'),
        minNationalGold: extractConst('minNationalGold'),
        minNationalRice: extractConst('minNationalRice'),
        exchangeFee: extractConst('exchangeFee'),
        adultAge: extractConst('adultAge'),
        minPushHallAge: extractConst('minPushHallAge'),
        maxDedLevel: extractConst('maxDedLevel'),
        maxTechLevel: extractConst('maxTechLevel'),
        maxBetrayCnt: extractConst('maxBetrayCnt'),
        incDefSettingChange: extractConst('incDefSettingChange'),
        maxDefSettingChange: extractConst('maxDefSettingChange'),
        refreshLimitCoef: extractConst('refreshLimitCoef'),
        maxLevel: extractConst('maxLevel'),
        techLevelIncYear: extractConst('techLevelIncYear'),
        initialAllowedTechLevel: extractConst('initialAllowedTechLevel'),
        basePopIncreaseAmount: extractConst('basePopIncreaseAmount'),
        expandCityPopIncreaseAmount: extractConst('expandCityPopIncreaseAmount'),
        expandCityDevelIncreaseAmount: extractConst('expandCityDevelIncreaseAmount'),
        expandCityWallIncreaseAmount: extractConst('expandCityWallIncreaseAmount'),
        expandCityDefaultCost: extractConst('expandCityDefaultCost'),
        expandCityCostCoef: extractConst('expandCityCostCoef'),
        minAvailableRecruitPop: extractConst('minAvailableRecruitPop'),
        defaultCityWall: extractConst('defaultCityWall'),
        initialNationGenLimit: extractConst('initialNationGenLimit'),
        defaultMaxGeneral: extractConst('defaultMaxGeneral'),
        defaultMaxNation: extractConst('defaultMaxNation'),
        defaultMaxGenius: extractConst('defaultMaxGenius'),
        defaultStartYear: extractConst('defaultStartYear'),
        joinRuinedNPCProp: extractConst('joinRuinedNPCProp'),
        defaultGold: extractConst('defaultGold'),
        defaultRice: extractConst('defaultRice'),
        coefAidAmount: extractConst('coefAidAmount'),
        maxResourceActionAmount: extractConst('maxResourceActionAmount'),
        generalMinimumGold: extractConst('generalMinimumGold'),
        generalMinimumRice: extractConst('generalMinimumRice'),
        maxTurn: extractConst('maxTurn'),
        maxChiefTurn: extractConst('maxChiefTurn'),
        statGradeLevel: extractConst('statGradeLevel'),
        openingPartYear: extractConst('openingPartYear'),
        joinActionLimit: extractConst('joinActionLimit'),
        bornMinStatBonus: extractConst('bornMinStatBonus'),
        bornMaxStatBonus: extractConst('bornMaxStatBonus'),
        neutralNationType: extractConst('neutralNationType'),
        defaultSpecialDomestic: extractConst('defaultSpecialDomestic'),
        defaultSpecialWar: extractConst('defaultSpecialWar'),
        neutralPersonality: extractConst('neutralPersonality'),
        retirementYear: extractConst('retirementYear'),
        targetGeneralPool: extractConst('targetGeneralPool'),
    };
}

// 아이템 추출
function extractItems(content) {
    const itemsRegex = /public static \$allItems = \[(.*?)\];/s;
    const match = content.match(itemsRegex);
    
    if (!match) return {};
    
    const items = {};
    // PHP 배열에서 아이템 추출 (간단한 예시)
    const itemPattern = /'(che_[^']+)'\s*=>\s*(\d+)/g;
    let itemMatch;
    
    while ((itemMatch = itemPattern.exec(match[1])) !== null) {
        const id = itemMatch[1];
        const category = itemMatch[2];
        items[id] = {
            id: id,
            category: category === '0' ? 'common' : category === '1' ? 'rare' : 'unique'
        };
    }
    
    return items;
}

// 명령어 추출
function extractCommands(content) {
    const commandsRegex = /public static \$availableGeneralCommand = \[(.*?)\];/s;
    const match = content.match(commandsRegex);
    
    if (!match) return {};
    
    const commands = {};
    const commandPattern = /'(che_[^']+|[가-힣]+)'/g;
    let cmdMatch;
    
    while ((cmdMatch = commandPattern.exec(match[1])) !== null) {
        const id = cmdMatch[1];
        commands[id] = {
            id: id,
            name: id.replace('che_', ''),
            category: 'general'
        };
    }
    
    return commands;
}

// 특기 추출
function extractSpecials(content) {
    const domesticRegex = /public static \$availableSpecialDomestic = \[(.*?)\];/s;
    const warRegex = /public static \$availableSpecialWar = \[(.*?)\];/s;
    
    const domesticMatch = content.match(domesticRegex);
    const warMatch = content.match(warRegex);
    
    const domestic = {};
    const war = {};
    
    if (domesticMatch) {
        const pattern = /'(che_[^']+)'/g;
        let match;
        while ((match = pattern.exec(domesticMatch[1])) !== null) {
            const id = match[1];
            domestic[id] = {
                id: id,
                name: id.replace('che_', ''),
                category: 'special_domestic'
            };
        }
    }
    
    if (warMatch) {
        const pattern = /'(che_[^']+)'/g;
        let match;
        while ((match = pattern.exec(warMatch[1])) !== null) {
            const id = match[1];
            war[id] = {
                id: id,
                name: id.replace('che_', ''),
                category: 'special_war'
            };
        }
    }
    
    return { domestic, war };
}

// 성향 추출
function extractPersonalities(content) {
    const regex = /public static \$availablePersonality = \[(.*?)\];/s;
    const match = content.match(regex);
    
    if (!match) return {};
    
    const personalities = {};
    const pattern = /'(che_[^']+)'/g;
    let pMatch;
    
    while ((pMatch = pattern.exec(match[1])) !== null) {
        const id = pMatch[1];
        personalities[id] = {
            id: id,
            name: id.replace('che_', ''),
            category: 'personality'
        };
    }
    
    return personalities;
}

// 국가 타입 추출
function extractNationTypes(content) {
    const regex = /public static \$availableNationType = \[(.*?)\];/s;
    const match = content.match(regex);
    
    if (!match) return {};
    
    const nationTypes = {};
    const pattern = /'(che_[^']+)'/g;
    let nMatch;
    
    while ((nMatch = pattern.exec(match[1])) !== null) {
        const id = nMatch[1];
        nationTypes[id] = {
            id: id,
            name: id.replace('che_', ''),
            category: 'nation_type'
        };
    }
    
    return nationTypes;
}

// 실행
const config = extractSamConfig();
const outputPath = path.join(__dirname, '../config/sam-config-extracted.json');
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');

console.log(`설정 파일 추출 완료: ${outputPath}`);
console.log(`- 도시: ${Object.keys(config.cities).length}개`);
console.log(`- 유닛 타입: ${Object.keys(config.unit_types).length}개`);
console.log(`- 아이템: ${Object.keys(config.items).length}개`);
console.log(`- 명령어: ${Object.keys(config.commands).length}개`);
console.log(`- 내정 특기: ${Object.keys(config.special_domestic).length}개`);
console.log(`- 전투 특기: ${Object.keys(config.special_war).length}개`);
