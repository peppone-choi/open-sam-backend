const fs = require('fs');
const path = require('path');

// 모든 설정 파일 병합
function mergeAllConfigs() {
    const configDir = path.join(__dirname, '../config');
    
    // 기존 config 파일들 읽기
    const actions = JSON.parse(fs.readFileSync(path.join(configDir, 'actions-final.json'), 'utf8'));
    const cities = JSON.parse(fs.readFileSync(path.join(configDir, 'cities-fixed.json'), 'utf8'));
    const commands = JSON.parse(fs.readFileSync(path.join(configDir, 'commands-generated.json'), 'utf8'));
    const constants = JSON.parse(fs.readFileSync(path.join(configDir, 'constants.json'), 'utf8'));
    const units = JSON.parse(fs.readFileSync(path.join(configDir, 'units.json'), 'utf8'));
    
    // SAM에서 추출한 효과 정보
    const samEffects = JSON.parse(fs.readFileSync(path.join(configDir, 'sam-effects.json'), 'utf8'));
    
    // 효과 정보를 기존 데이터에 병합
    function mergeEffects(baseData, effectsData) {
        const merged = { ...baseData };
        
        for (const [id, item] of Object.entries(merged)) {
            const effectKey = item.original_id || id;
            if (effectsData[effectKey]) {
                merged[id] = {
                    ...item,
                    name: effectsData[effectKey].name || item.name || id.replace('che_', ''),
                    description: effectsData[effectKey].description,
                    pros: effectsData[effectKey].pros,
                    cons: effectsData[effectKey].cons,
                    mechanics: effectsData[effectKey].mechanics
                };
            }
        }
        
        return merged;
    }
    
    // 명령어 병합 (중첩 구조)
    function mergeCommandEffects(baseCommands, generalEffects, nationEffects) {
        const merged = { ...baseCommands };
        
        // general 명령어
        if (merged.general && generalEffects) {
            for (const [id, cmd] of Object.entries(merged.general)) {
                const effectKey = cmd.original_id || id;
                if (generalEffects[effectKey]) {
                    merged.general[id] = {
                        ...cmd,
                        name: generalEffects[effectKey].name || cmd.name || id.replace('che_', ''),
                        description: generalEffects[effectKey].description,
                        mechanics: generalEffects[effectKey].mechanics
                    };
                }
            }
        }
        
        // nation 명령어
        if (merged.nation && nationEffects) {
            for (const [id, cmd] of Object.entries(merged.nation)) {
                const effectKey = cmd.original_id || id;
                if (nationEffects[effectKey]) {
                    merged.nation[id] = {
                        ...cmd,
                        name: nationEffects[effectKey].name || cmd.name || id.replace('che_', ''),
                        description: nationEffects[effectKey].description,
                        mechanics: nationEffects[effectKey].mechanics
                    };
                }
            }
        }
        
        return merged;
    }
    
    // 국가 타입 병합
    const nationTypes = mergeEffects(actions.nation_types, samEffects.nation_types);
    
    // 성향 병합
    const personalities = mergeEffects(actions.personalities, samEffects.personalities);
    
    // 내정 특기 병합
    const specialDomestic = mergeEffects(actions.special_domestic, samEffects.special_domestic);
    
    // 전투 특기 병합
    const specialWar = mergeEffects(actions.special_war, samEffects.special_war);
    
    // 아이템 병합
    const items = mergeEffects(actions.items, samEffects.items);
    
    // 최종 통합 설정
    const finalConfig = {
        session_id: 'sangokushi_complete',
        name: '삼국지 HiDChe - 완전판',
        version: '1.0.0',
        generated_at: new Date().toISOString(),
        note: '명령어는 코드로 구현되어 있으며, 세계관별로 변형 가능합니다.',
        sources: [
            'config/actions-final.json',
            'config/cities-fixed.json',
            'config/constants.json',
            'config/units.json',
            'config/sam-effects.json (PHP source)'
        ],
        
        game_mode: 'turn',
        turn_config: {
            default_hour: 21,
            default_minute: 0,
            allow_custom: true,
            max_turns_per_cycle: 30
        },
        
        field_mappings: {
            general: {
                primary_resource: 'gold',
                secondary_resource: 'rice',
                troops_count: 'crew',
                troops_type: 'crewtype',
                location: 'city',
                faction: 'nation',
                rank: 'officer_level'
            },
            city: {
                population: 'pop',
                agriculture: 'agri',
                commerce: 'comm',
                security: 'secu',
                defense: 'def',
                wall: 'wall',
                trust: 'trust',
                owner: 'nation'
            },
            nation: {
                capital: 'capital',
                treasury: 'gold',
                food_storage: 'rice',
                technology: 'tech'
            }
        },
        
        game_constants: constants.game_constants,
        cities: cities.cities,
        unit_types: units.unit_types,
        items: items,
        nation_types: nationTypes,
        personalities: personalities,
        special_domestic: specialDomestic,
        special_war: specialWar
    };
    
    return finalConfig;
}

// 실행
console.log('전체 설정 병합 시작...\n');

const finalConfig = mergeAllConfigs();

// 저장
const outputPath = path.join(__dirname, '../config/game-config-complete.json');
fs.writeFileSync(outputPath, JSON.stringify(finalConfig, null, 2), 'utf8');

console.log(`병합 완료: ${outputPath}\n`);

console.log('=== 통계 ===');
console.log(`도시: ${Object.keys(finalConfig.cities).length}개`);
console.log(`유닛 타입: ${Object.keys(finalConfig.unit_types).length}개`);
console.log(`아이템: ${Object.keys(finalConfig.items).length}개`);
console.log(`국가 타입: ${Object.keys(finalConfig.nation_types).length}개`);
console.log(`성향: ${Object.keys(finalConfig.personalities).length}개`);
console.log(`내정 특기: ${Object.keys(finalConfig.special_domestic).length}개`);
console.log(`전투 특기: ${Object.keys(finalConfig.special_war).length}개`);
console.log('\n※ 명령어는 코드로 구현되어 있습니다.');

// 샘플 출력
console.log('\n=== 샘플: 종횡가 (효과 포함) ===');
console.log(JSON.stringify(finalConfig.nation_types['종횡가'], null, 2));
