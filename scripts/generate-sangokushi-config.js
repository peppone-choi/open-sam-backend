const fs = require('fs');
const path = require('path');

// 경로 설정
const GENERAL_CMD_DIR = '/mnt/d/open-sam-backend/sam/hwe/sammo/Command/General';
const NATION_CMD_DIR = '/mnt/d/open-sam-backend/sam/hwe/sammo/Command/Nation';
const OUTPUT_PATH = '/mnt/d/open-sam-backend/config/session-sangokushi-full.json';

// PHP 파일에서 커맨드 정보 추출
function parseCommandFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath, '.php');
        
        // actionName 추출
        const actionNameMatch = content.match(/static\s+protected\s+\$actionName\s*=\s*['"]([^'"]+)['"]/);
        const actionName = actionNameMatch ? actionNameMatch[1] : fileName;
        
        // getCost 추출 - return [금, 쌀]
        let goldCost = 0, riceCost = 0;
        const getCostMatch = content.match(/function\s+getCost\s*\(\)[^{]*\{[^}]*return\s*\[([^\]]+)\]/s);
        if (getCostMatch) {
            const costs = getCostMatch[1].split(',').map(s => s.trim().replace(/[^\d-]/g, ''));
            goldCost = parseInt(costs[0]) || 0;
            riceCost = parseInt(costs[1]) || 0;
        }
        
        // getPreReqTurn 추출
        let preReqTurn = 0;
        const preReqMatch = content.match(/function\s+getPreReqTurn\s*\(\)[^{]*\{[^}]*return\s+(\d+)/s);
        if (preReqMatch) {
            preReqTurn = parseInt(preReqMatch[1]) || 0;
        }
        
        // getPostReqTurn 추출
        let postReqTurn = 0;
        const postReqMatch = content.match(/function\s+getPostReqTurn\s*\(\)[^{]*\{[^}]*return\s+(\d+)/s);
        if (postReqMatch) {
            postReqTurn = parseInt(postReqMatch[1]) || 0;
        }
        
        const duration = preReqTurn + postReqTurn;
        
        // run 메서드에서 effects 추출 (간단한 패턴 매칭)
        const effects = {
            general: {},
            city: {},
            nation: {}
        };
        
        // $general->field += value 패턴
        const generalMatches = content.matchAll(/\$general->(\w+)\s*([+\-*\/])=\s*([^;]+)/g);
        for (const match of generalMatches) {
            const field = match[1];
            const op = match[2];
            let value = match[3].trim();
            
            // 간단한 계산만 처리
            if (value.match(/^\d+$/)) {
                const numValue = parseInt(value);
                if (op === '-') {
                    effects.general[field] = -numValue;
                } else if (op === '+') {
                    effects.general[field] = numValue;
                }
            }
        }
        
        // $city->field += value 패턴
        const cityMatches = content.matchAll(/\$city->(\w+)\s*([+\-*\/])=\s*([^;]+)/g);
        for (const match of cityMatches) {
            const field = match[1];
            const op = match[2];
            let value = match[3].trim();
            
            if (value.match(/^\d+$/)) {
                const numValue = parseInt(value);
                if (op === '-') {
                    effects.city[field] = -numValue;
                } else if (op === '+') {
                    effects.city[field] = numValue;
                }
            }
        }
        
        // $nation->field += value 패턴
        const nationMatches = content.matchAll(/\$nation->(\w+)\s*([+\-*\/])=\s*([^;]+)/g);
        for (const match of nationMatches) {
            const field = match[1];
            const op = match[2];
            let value = match[3].trim();
            
            if (value.match(/^\d+$/)) {
                const numValue = parseInt(value);
                if (op === '-') {
                    effects.nation[field] = -numValue;
                } else if (op === '+') {
                    effects.nation[field] = numValue;
                }
            }
        }
        
        // 빈 객체 제거
        if (Object.keys(effects.general).length === 0) delete effects.general;
        if (Object.keys(effects.city).length === 0) delete effects.city;
        if (Object.keys(effects.nation).length === 0) delete effects.nation;
        
        return {
            id: fileName,
            name: actionName,
            enabled: true,
            duration: duration,
            cost: {
                gold: goldCost,
                rice: riceCost
            },
            effects: Object.keys(effects).length > 0 ? effects : {}
        };
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error.message);
        return null;
    }
}

// 디렉토리의 모든 PHP 파일 읽기
function readCommandDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    const commands = {};
    
    for (const file of files) {
        if (file.endsWith('.php') && file !== 'BaseCommand.php') {
            const filePath = path.join(dirPath, file);
            const cmdData = parseCommandFile(filePath);
            if (cmdData) {
                commands[cmdData.id] = cmdData;
            }
        }
    }
    
    return commands;
}

// 메인 함수
function generateConfig() {
    console.log('삼국지 세션 설정 생성 시작...\n');
    
    // General 커맨드 읽기
    console.log(`General 커맨드 디렉토리 읽는 중: ${GENERAL_CMD_DIR}`);
    const generalCommands = readCommandDirectory(GENERAL_CMD_DIR);
    console.log(`General 커맨드 ${Object.keys(generalCommands).length}개 발견\n`);
    
    // Nation 커맨드 읽기
    console.log(`Nation 커맨드 디렉토리 읽는 중: ${NATION_CMD_DIR}`);
    const nationCommands = readCommandDirectory(NATION_CMD_DIR);
    console.log(`Nation 커맨드 ${Object.keys(nationCommands).length}개 발견\n`);
    
    // 모든 커맨드 병합
    const allCommands = { ...generalCommands, ...nationCommands };
    console.log(`총 커맨드 ${Object.keys(allCommands).length}개\n`);
    
    // JSON 구조 생성
    const config = {
        session_id: "sangokushi_default",
        name: "삼국지 HiDChe",
        game_mode: "turn",
        description: "삼국지 모의전투 PHP HiDChe 기반 세션",
        
        turn_config: {
            max_turns_per_cycle: 30,
            turn_duration_seconds: null,
            simultaneous_execution: true
        },
        
        resources: {
            gold: {
                name: "금",
                description: "장수 개인 자금",
                default_value: 1000,
                min_value: 0,
                max_value: 999999
            },
            rice: {
                name: "쌀",
                description: "군량",
                default_value: 1000,
                min_value: 0,
                max_value: 999999
            },
            crew: {
                name: "병사",
                description: "보유 병력",
                default_value: 0,
                min_value: 0,
                max_value: 999999
            }
        },
        
        attributes: {
            leadership: {
                name: "통솔",
                description: "통솔력 능력치",
                min: 1,
                max: 130,
                default_value: 50
            },
            strength: {
                name: "무력",
                description: "무력 능력치",
                min: 1,
                max: 130,
                default_value: 50
            },
            intel: {
                name: "지력",
                description: "지력 능력치",
                min: 1,
                max: 130,
                default_value: 50
            },
            experience: {
                name: "경험",
                description: "경험치",
                min: 0,
                max: 999999,
                default_value: 0
            },
            dedication: {
                name: "공헌",
                description: "공헌도",
                min: 0,
                max: 999999,
                default_value: 0
            },
            injury: {
                name: "부상",
                description: "부상 정도",
                min: 0,
                max: 99,
                default_value: 0
            },
            train: {
                name: "훈련",
                description: "병사 훈련도",
                min: 0,
                max: 150,
                default_value: 0
            },
            atmos: {
                name: "사기",
                description: "병사 사기",
                min: 0,
                max: 150,
                default_value: 0
            }
        },
        
        city_attributes: {
            pop: {
                name: "인구",
                description: "도시 인구",
                default_value: 100000
            },
            agri: {
                name: "농업",
                description: "농업 개발도",
                default_value: 1000
            },
            comm: {
                name: "상업",
                description: "상업 개발도",
                default_value: 1000
            },
            secu: {
                name: "치안",
                description: "치안 수치",
                default_value: 1000
            },
            def: {
                name: "수비",
                description: "방어 시설",
                default_value: 1000
            },
            wall: {
                name: "성벽",
                description: "성벽 내구도",
                default_value: 1000
            },
            trust: {
                name: "민심",
                description: "민심도",
                default_value: 50.0
            }
        },
        
        nation_attributes: {
            gold: {
                name: "국고",
                description: "국가 금",
                default_value: 0
            },
            rice: {
                name: "병량",
                description: "국가 쌀",
                default_value: 2000
            },
            tech: {
                name: "기술",
                description: "기술 수준",
                default_value: 0
            },
            power: {
                name: "국력",
                description: "국가 세력",
                default_value: 0
            }
        },
        
        commands: allCommands
    };
    
    // JSON 파일로 저장
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`✅ 설정 파일 생성 완료: ${OUTPUT_PATH}\n`);
    
    // 샘플 커맨드 5개 출력
    console.log('📋 샘플 커맨드 5개:\n');
    const sampleKeys = Object.keys(allCommands).slice(0, 5);
    sampleKeys.forEach(key => {
        const cmd = allCommands[key];
        console.log(`- ${cmd.name} (${cmd.id})`);
        console.log(`  비용: 금 ${cmd.cost.gold}, 쌀 ${cmd.cost.rice}`);
        console.log(`  소요턴: ${cmd.duration}`);
        if (Object.keys(cmd.effects).length > 0) {
            console.log(`  효과:`, JSON.stringify(cmd.effects, null, 4));
        }
        console.log('');
    });
    
    console.log('✨ 완료!');
}

// 실행
generateConfig();
