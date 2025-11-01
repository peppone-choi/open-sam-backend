const fs = require('fs');
const path = require('path');

// PHP 클래스 파일에서 효과 정보 추출
function extractEffectsFromPHP(phpContent) {
    const effects = {};
    
    // name 추출
    const nameMatch = phpContent.match(/protected \$name = '([^']+)'/);
    if (nameMatch) effects.name = nameMatch[1];
    
    // info (설명) 추출
    const infoMatch = phpContent.match(/protected \$info = '([^']+)'/);
    if (infoMatch) effects.description = infoMatch[1];
    
    // pros/cons 추출 (국가 타입)
    const prosMatch = phpContent.match(/static \$pros = '([^']+)'/);
    const consMatch = phpContent.match(/static \$cons = '([^']+)'/);
    if (prosMatch) effects.pros = prosMatch[1];
    if (consMatch) effects.cons = consMatch[1];
    
    // 효과 코드 분석
    effects.mechanics = [];
    
    // onCalcDomestic - 곱셈 효과
    const domesticMultRegex = /if\s*\(\s*\$turnType\s*==\s*'([^']+)'[^}]*?if\s*\(\s*\$varType\s*==\s*'([^']+)'\s*\)\s*return\s+\$value\s*\*\s*([0-9.]+)/gs;
    let match;
    while ((match = domesticMultRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'domestic',
            target: match[1],
            varType: match[2],
            operation: 'multiply',
            value: parseFloat(match[3])
        });
    }
    
    // onCalcNationalIncome - 국고/군량 수입
    const incomeRegex = /if\s*\(\s*\$type\s*==\s*'([^']+)'\s*\)[^}]*?return\s+\$amount\s*\*\s*([0-9.]+)/gs;
    while ((match = incomeRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'national_income',
            target: match[1],
            operation: 'multiply',
            value: parseFloat(match[2])
        });
    }
    
    // onCalcStat - 능력치 효과 (곱셈)
    const statMultRegex = /if\s*\(\s*\$statName\s*===?\s*'([^']+)'\s*\)[^}]*?return\s+\$value\s*\*\s*([0-9.]+)/gs;
    while ((match = statMultRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'stat',
            target: match[1],
            operation: 'multiply',
            value: parseFloat(match[2])
        });
    }
    
    // onCalcStat - 덧셈/뺄셈 (간단한 패턴)
    const statAddRegex = /if\s*\(\s*\$statName\s*===?\s*'([^']+)'\s*\)[^}]*?return\s+\$value\s*([\+\-])\s*([0-9.]+)/gs;
    while ((match = statAddRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'stat_bonus',
            target: match[1],
            operation: match[2] === '+' ? 'add' : 'subtract',
            value: parseFloat(match[3])
        });
    }
    
    // onCalcStat - 여러 능력치 동시 적용 (in_array)
    const multiStatRegex = /if\s*\(\s*in_array\s*\(\s*\$statName,\s*\[([^\]]+)\]\s*\)\s*\)[^}]*?return\s+\$value\s*([\+\-])\s*(\d+)/gs;
    while ((match = multiStatRegex.exec(phpContent)) !== null) {
        const stats = match[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
        const value = parseInt(match[3]);
        const operation = match[2] === '+' ? 'add' : 'subtract';
        
        stats.forEach(stat => {
            effects.mechanics.push({
                type: 'stat_bonus',
                target: stat,
                operation: operation,
                value: value
            });
        });
    }
    
    // onCalcStat - 복잡한 계산식 (통솔 보정 등)
    const statComplexRegex = /if\s*\(\s*\$statName\s*===?\s*'([^']+)'\s*\)[^}]*?return\s+\$value\s*\+\s*\$general->getVar\('([^']+)'\)\s*\*\s*([0-9.]+)/gs;
    while ((match = statComplexRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'stat_complex',
            target: match[1],
            source: match[2],
            operation: 'add_percent_of',
            value: parseFloat(match[3])
        });
    }
    
    // varType 덧셈/뺄셈 보정값
    const varBonusRegex = /if\s*\(\s*\$varType\s*==\s*'([^']+)'\s*\)[^}]*?return\s+\$value\s*([\+\-])\s*([0-9.]+)/gs;
    while ((match = varBonusRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'var_bonus',
            target: match[1],
            operation: match[2] === '+' ? 'add' : 'subtract',
            value: parseFloat(match[3])
        });
    }
    
    // 고정값 return (징병/모병 훈사 등)
    const fixedValueRegex = /if\s*\(\s*\$varType\s*==\s*'([^']+)'\s*\)[^}]*?return\s+(\d+);/gs;
    while ((match = fixedValueRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'fixed_value',
            target: match[1],
            operation: 'set',
            value: parseInt(match[2])
        });
    }
    
    // onCalcStrategic - 전략 효과
    const strategicRegex = /if\s*\(\s*\$varType\s*==\s*'([^']+)'\s*\)[^}]*?return[^;]*?(\d+)\s*\/\s*(\d+)/gs;
    while ((match = strategicRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'strategic',
            target: match[1],
            operation: 'multiply',
            value: parseFloat(match[2]) / parseFloat(match[3])
        });
    }
    
    // getWarPowerMultiplier - 전투력 배수 (전투 특기)
    // 조건부 처리
    const warPowerIfRegex = /if\s*\(\s*\$unit->isAttacker\(\)\s*\)\s*\{[^}]*?return\s+\[([0-9.]+),\s*([0-9.]+)\]/gs;
    while ((match = warPowerIfRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'war_power_attacker',
            attack_multiplier: parseFloat(match[1]),
            defense_multiplier: parseFloat(match[2])
        });
    }
    
    // 기본 return 패턴
    const warPowerSimpleRegex = /getWarPowerMultiplier[^{]*?\{[^}]*?return\s+\[([0-9.+\-*\s]+),\s*([0-9.]+)\]/gs;
    const simpleMatches = [...phpContent.matchAll(warPowerSimpleRegex)];
    if (simpleMatches.length > 0 && !effects.mechanics.find(m => m.type === 'war_power_attacker')) {
        const lastMatch = simpleMatches[simpleMatches.length - 1];
        effects.mechanics.push({
            type: 'war_power',
            attack_multiplier: lastMatch[1].trim(),
            defense_multiplier: parseFloat(lastMatch[2])
        });
    }
    
    // 아이템 전투력 효과 - initWarPhase
    const warPhaseRegex = /if\s*\(\s*\$statName\s*===?\s*'initWarPhase'\s*\)[^}]*?return\s+\$value\s*([\+\-])\s*(\d+)/gs;
    while ((match = warPhaseRegex.exec(phpContent)) !== null) {
        effects.mechanics.push({
            type: 'war_phase',
            operation: match[1] === '+' ? 'add' : 'subtract',
            value: parseInt(match[2])
        });
    }
    
    // info에서도 description 추출 시도
    if (!effects.description && phpContent.includes('$this->info')) {
        const infoMatch2 = phpContent.match(/\$this->info\s*\.?=\s*"([^"]+)"/);
        if (infoMatch2) effects.description = infoMatch2[1];
    }
    
    // description에서 효과 파싱 (복잡한 특기용)
    if (effects.description && (!effects.mechanics || effects.mechanics.length === 0)) {
        const parsedMechanics = parseDescriptionForMechanics(effects.description);
        if (parsedMechanics.length > 0) {
            effects.mechanics = parsedMechanics;
        }
    }
    
    // 소모성 아이템 정보
    const consumableMatch = phpContent.match(/protected \$consumable = (true|false)/);
    if (consumableMatch) effects.consumable = consumableMatch[1] === 'true';
    
    // cost 추출
    const costMatch = phpContent.match(/protected \$cost = (\d+)/);
    if (costMatch) effects.cost = parseInt(costMatch[1]);
    
    // buyable 추출
    const buyableMatch = phpContent.match(/protected \$buyable = (true|false)/);
    if (buyableMatch) effects.buyable = buyableMatch[1] === 'true';
    
    return effects;
}

// Description에서 mechanics 자동 파싱
function parseDescriptionForMechanics(description) {
    const mechanics = [];
    
    // 성공률 +X%p
    let match = description.match(/성공률\s*\+(\d+)%p/);
    if (match) {
        mechanics.push({
            type: 'success_rate',
            operation: 'add',
            value: parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // 회피 확률 +X%p
    match = description.match(/회피[^+]*\+(\d+)%p/);
    if (match) {
        mechanics.push({
            type: 'stat_bonus',
            target: 'warAvoidRatio',
            operation: 'add',
            value: parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // 대미지 +X%
    match = description.match(/대미지\s*\+(\d+)%/);
    if (match) {
        mechanics.push({
            type: 'war_power',
            attack_multiplier: 1 + parseInt(match[1]) / 100,
            defense_multiplier: 1,
            parsed_from: 'description'
        });
    }
    
    // 피해 -X%
    match = description.match(/피해\s*-(\d+)%/);
    if (match) {
        mechanics.push({
            type: 'war_defense',
            defense_multiplier: 1 - parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // 필살 확률 +X%p
    match = description.match(/필살[^+]*\+(\d+)%p/);
    if (match) {
        mechanics.push({
            type: 'stat_bonus',
            target: 'warCriticalRatio',
            operation: 'add',
            value: parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // 페이즈 +X or -X
    match = description.match(/페이즈\s*([\+\-])\s*(\d+)/);
    if (match) {
        mechanics.push({
            type: 'war_phase',
            operation: match[1] === '+' ? 'add' : 'subtract',
            value: parseInt(match[2]),
            parsed_from: 'description'
        });
    }
    
    // 저격 발동 (확률) - 사기 보너스 포함
    match = description.match(/(\d+)%\s*확률로\s*저격.*사기\s*\+(\d+)/);
    if (match) {
        mechanics.push({
            type: 'war_trigger',
            skill: 'snipe',
            probability: parseInt(match[1]) / 100,
            morale_bonus: parseInt(match[2]),
            parsed_from: 'description'
        });
    }
    // 저격 발동 (확률만)
    else {
        match = description.match(/(\d+)%\s*확률로\s*저격/);
        if (match) {
            mechanics.push({
                type: 'war_trigger',
                skill: 'snipe',
                probability: parseInt(match[1]) / 100,
                parsed_from: 'description'
            });
        }
    }
    
    // 부상 회복 - 턴 실행 전
    if (description.includes('턴 실행 전 부상 회복')) {
        mechanics.push({
            type: 'pre_turn_heal',
            target: 'injury',
            amount: 'full',
            timing: 'pre_turn',
            consumable: description.includes('회용'),
            parsed_from: 'description'
        });
    }
    // 부상 회복 - 매 턴 (의술 특기)
    else if (description.includes('매 턴') && description.includes('부상 회복')) {
        const selfHeal = description.match(/자신\((\d+)%\)/);
        const cityHeal = description.match(/소속 도시.*\(적 포함\s*(\d+)%\)/);
        const phaseHeal = description.match(/페이즈마다\s*(\d+)%\s*확률로\s*치료.*아군 피해\s*(\d+)%\s*감소/);
        
        mechanics.push({
            type: 'turn_heal',
            target: 'injury',
            timing: 'every_turn',
            self_heal_rate: selfHeal ? parseInt(selfHeal[1]) / 100 : 1,
            city_heal_rate: cityHeal ? parseInt(cityHeal[1]) / 100 : 0.5,
            parsed_from: 'description'
        });
        
        if (phaseHeal) {
            mechanics.push({
                type: 'war_trigger',
                skill: 'heal',
                probability: parseInt(phaseHeal[1]) / 100,
                damage_reduction: parseInt(phaseHeal[2]) / 100,
                parsed_from: 'description'
            });
        }
    }
    // 일반 치료
    else if (description.includes('부상 회복') || description.includes('치료')) {
        mechanics.push({
            type: 'heal',
            target: 'injury',
            parsed_from: 'description'
        });
    }
    
    // 사기 +X
    match = description.match(/사기\s*\+(\d+)/);
    if (match) {
        mechanics.push({
            type: 'stat_bonus',
            target: 'atmos',
            operation: 'add',
            value: parseInt(match[1]),
            parsed_from: 'description'
        });
    }
    
    // 훈련 +X
    match = description.match(/훈련\s*\+(\d+)/);
    if (match) {
        mechanics.push({
            type: 'stat_bonus',
            target: 'train',
            operation: 'add',
            value: parseInt(match[1]),
            parsed_from: 'description'
        });
    }
    
    // 계략 성공 확률 -X%p
    match = description.match(/계략\s*성공\s*확률\s*-(\d+)%p/);
    if (match) {
        mechanics.push({
            type: 'counter_strategy',
            operation: 'reduce',
            value: parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // X% 확률로 계략 되돌림 - 반목 효과 포함
    match = description.match(/(\d+)%\s*확률로\s*되돌림.*반목\s*성공시\s*대미지\s*추가.*\+(\d+)%.*\+(\d+)%/);
    if (match) {
        mechanics.push({
            type: 'reflect_strategy',
            probability: parseInt(match[1]) / 100,
            on_success_damage: {
                min: parseInt(match[2]) / 100,
                max: parseInt(match[3]) / 100
            },
            parsed_from: 'description'
        });
    }
    // X% 확률로 되돌림 (일반)
    else {
        match = description.match(/(\d+)%\s*확률로\s*되돌림/);
        if (match) {
            mechanics.push({
                type: 'reflect_strategy',
                probability: parseInt(match[1]) / 100,
                parsed_from: 'description'
            });
        }
    }
    
    // 격노마다 대미지 X% 추가 중첩 - 상세 정보
    match = description.match(/격노마다\s*대미지\s*(\d+)%\s*추가\s*중첩/);
    if (match) {
        const hasCounterCritical = description.includes('상대방 필살 시 격노');
        const hasAvoidRage = description.match(/회피 시도시\s*(\d+)%\s*확률로\s*격노/);
        
        mechanics.push({
            type: 'stacking_damage',
            skill: 'rage',
            per_stack: parseInt(match[1]) / 100,
            triggers: {
                counter_critical: hasCounterCritical,
                on_avoid_attempt: hasAvoidRage ? parseInt(hasAvoidRage[1]) / 100 : null,
                on_attack: description.includes('공격 시 일정 확률')
            },
            parsed_from: 'description'
        });
    }
    
    // 첫 페이즈 위압 발동 - 사기 감소 포함
    if (description.includes('첫 페이즈 위압')) {
        const moraleMatch = description.match(/사기\s*(\d+)\s*감소/);
        mechanics.push({
            type: 'war_trigger',
            skill: 'intimidate',
            timing: 'first_phase',
            effects: {
                disable_attack: true,
                disable_avoid: true,
                reduce_morale: moraleMatch ? parseInt(moraleMatch[1]) : 5
            },
            parsed_from: 'description'
        });
    }
    
    // 사기 감소
    match = description.match(/사기\s*(\d+)\s*감소/);
    if (match) {
        mechanics.push({
            type: 'stat_bonus',
            target: 'atmos',
            operation: 'subtract',
            value: parseInt(match[1]),
            parsed_from: 'description'
        });
    }
    
    // 판매 시 금/쌀 추가
    match = description.match(/판매\s*시.*총\s*\+([0-9,]+)/);
    if (match) {
        const value = parseInt(match[1].replace(/,/g, ''));
        mechanics.push({
            type: 'sell_bonus',
            operation: 'add_on_sell',
            value: value,
            parsed_from: 'description'
        });
    }
    
    // 저격 불가, 부상 없음
    if (description.includes('저격 불가') && description.includes('부상 없음')) {
        mechanics.push({
            type: 'immunity',
            immune_to: ['snipe', 'injury'],
            parsed_from: 'description'
        });
    }
    
    // 남은 병력이 적을수록 공격력 증가
    match = description.match(/남은 병력이 적을수록 공격력 증가.*최대\s*\+(\d+)%/);
    if (match) {
        mechanics.push({
            type: 'conditional_power',
            condition: 'low_troops',
            max_bonus: parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // X% 확률로 금/쌀 Y% 약탈
    match = description.match(/(\d+)%\s*확률로.*금.*쌀\s*(\d+)%\s*약탈/);
    if (match) {
        mechanics.push({
            type: 'war_trigger',
            skill: 'plunder',
            probability: parseInt(match[1]) / 100,
            plunder_rate: parseInt(match[2]) / 100,
            targets: ['gold', 'rice'],
            parsed_from: 'description'
        });
    }
    
    // 전투 개시 시 저격 - 1회용
    if (description.includes('전투 개시 시 저격')) {
        mechanics.push({
            type: 'war_trigger',
            skill: 'snipe',
            timing: 'battle_start',
            probability: 1.0,
            consumable: true,
            uses: 1,
            morale_bonus: 20,
            parsed_from: 'description'
        });
    }
    
    // 수비 시 저지 - 확률 포함
    match = description.match(/수비 시.*첫 페이즈 저지,\s*(\d+)%\s*확률로\s*(\d+)\s*페이즈\s*저지/);
    if (match) {
        mechanics.push({
            type: 'war_trigger',
            skill: 'block',
            timing: 'defense',
            first_phase: true,
            second_phase_probability: parseInt(match[1]) / 100,
            max_phases: parseInt(match[2]),
            parsed_from: 'description'
        });
    }
    // 수비 시 저지 (일반)
    else {
        match = description.match(/수비 시.*(\d+)\s*페이즈\s*저지/);
        if (match) {
            mechanics.push({
                type: 'war_trigger',
                skill: 'block',
                timing: 'defense',
                phases: parseInt(match[1]),
                parsed_from: 'description'
            });
        }
    }
    
    // 전략 재사용 대기 기간 -X%
    match = description.match(/재사용\s*대기\s*기간\s*-(\d+)%/);
    if (match) {
        mechanics.push({
            type: 'strategic_cooldown',
            operation: 'multiply',
            value: 1 - parseInt(match[1]) / 100,
            parsed_from: 'description'
        });
    }
    
    // 계략 되돌림, X 불가
    if (description.includes('계략 되돌림') && description.includes('격노 불가')) {
        mechanics.push({
            type: 'immunity',
            immune_to: ['rage'],
            reflect: ['strategy'],
            parsed_from: 'description'
        });
    }
    
    return mechanics;
}

// BaseStatItem 자동 효과 생성
function generateBaseStatItemEffects(id) {
    // 파일명 패턴: che_명마_01_노기, che_무기_07_동추, che_서적_15_손자병법
    const tokens = id.split('_');
    if (tokens.length < 4) return null;
    
    const itemTypeMap = {
        '명마': { stat: 'leadership', name: '통솔' },
        '무기': { stat: 'strength', name: '무력' },
        '서적': { stat: 'intel', name: '지력' }
    };
    
    const itemType = tokens[1];
    const level = parseInt(tokens[2]);
    
    if (!itemTypeMap[itemType] || isNaN(level)) return null;
    
    const statInfo = itemTypeMap[itemType];
    
    return {
        mechanics: [{
            type: 'stat_bonus',
            target: statInfo.stat,
            operation: 'add',
            value: level,
            auto_generated: true,
            description: `${statInfo.name} +${level}`
        }]
    };
}

// 디렉토리 내 모든 PHP 파일 처리
function extractFromDirectory(dirPath, category) {
    const result = {};
    
    if (!fs.existsSync(dirPath)) {
        console.log(`디렉토리 없음: ${dirPath}`);
        return result;
    }
    
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
        if (!file.endsWith('.php')) continue;
        
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const id = file.replace('.php', '');
        
        const effects = extractEffectsFromPHP(content);
        
        // BaseStatItem 자동 생성 (mechanics가 비어있고 아이템인 경우)
        if (category === 'item' && (!effects.mechanics || effects.mechanics.length === 0)) {
            const autoEffects = generateBaseStatItemEffects(id);
            if (autoEffects) {
                Object.assign(effects, autoEffects);
            }
        }
        
        result[id] = {
            id: id,
            original_id: id,
            category: category,
            ...effects
        };
        
        // mechanics가 없으면 빈 배열로 초기화 (명시적 표시)
        if (!result[id].mechanics) {
            result[id].mechanics = [];
        }
    }
    
    return result;
}

// 메인 실행
function extractAllEffects() {
    const sammoPath = path.join(__dirname, '../sam/hwe/sammo');
    
    console.log('효과 정보 추출 시작...\n');
    
    // 국가 타입
    const nationTypesPath = path.join(sammoPath, 'ActionNationType');
    const nationTypes = extractFromDirectory(nationTypesPath, 'nation_type');
    console.log(`국가 타입: ${Object.keys(nationTypes).length}개 추출`);
    
    // 성향
    const personalitiesPath = path.join(sammoPath, 'ActionPersonality');
    const personalities = extractFromDirectory(personalitiesPath, 'personality');
    console.log(`성향: ${Object.keys(personalities).length}개 추출`);
    
    // 내정 특기
    const specialDomesticPath = path.join(sammoPath, 'ActionSpecialDomestic');
    const specialDomestic = extractFromDirectory(specialDomesticPath, 'special_domestic');
    console.log(`내정 특기: ${Object.keys(specialDomestic).length}개 추출`);
    
    // 전투 특기
    const specialWarPath = path.join(sammoPath, 'ActionSpecialWar');
    const specialWar = extractFromDirectory(specialWarPath, 'special_war');
    console.log(`전투 특기: ${Object.keys(specialWar).length}개 추출`);
    
    // 아이템
    const itemsPath = path.join(sammoPath, 'ActionItem');
    const items = extractFromDirectory(itemsPath, 'item');
    console.log(`아이템: ${Object.keys(items).length}개 추출`);
    
    // 명령어 - 일반
    const commandGeneralPath = path.join(sammoPath, 'Command/General');
    const commandsGeneral = extractFromDirectory(commandGeneralPath, 'command_general');
    console.log(`일반 명령어: ${Object.keys(commandsGeneral).length}개 추출`);
    
    // 명령어 - 국가
    const commandNationPath = path.join(sammoPath, 'Command/Nation');
    const commandsNation = extractFromDirectory(commandNationPath, 'command_nation');
    console.log(`국가 명령어: ${Object.keys(commandsNation).length}개 추출`);
    
    const result = {
        extracted_at: new Date().toISOString(),
        source: 'sam/hwe/sammo PHP classes',
        
        nation_types: nationTypes,
        personalities: personalities,
        special_domestic: specialDomestic,
        special_war: specialWar,
        items: items,
        commands_general: commandsGeneral,
        commands_nation: commandsNation
    };
    
    return result;
}

// 실행 및 저장
const effects = extractAllEffects();
const outputPath = path.join(__dirname, '../config/sam-effects.json');
fs.writeFileSync(outputPath, JSON.stringify(effects, null, 2), 'utf8');

console.log(`\n저장 완료: ${outputPath}`);

// 샘플 출력
console.log('\n=== 샘플 데이터 ===');
if (effects.nation_types['che_종횡가']) {
    console.log('\n[종횡가 국가 타입]');
    console.log(JSON.stringify(effects.nation_types['che_종횡가'], null, 2));
}
if (effects.personalities['che_대의']) {
    console.log('\n[대의 성향]');
    console.log(JSON.stringify(effects.personalities['che_대의'], null, 2));
}
