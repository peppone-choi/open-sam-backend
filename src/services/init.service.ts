import { Session } from '../models/session.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import * as fs from 'fs';
import * as path from 'path';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { sessionRepository } from '../repositories/session.repository';
import { generalRepository } from '../repositories/general.repository';
import { SessionSync } from '../utils/session-sync';
import { unitStackRepository } from '../repositories/unit-stack.repository';
import { generateInitialGarrisonsForCities } from './helpers/garrison.helper';
import { saveCity, saveNation, saveSession } from '../common/cache/model-cache.helper';

/**
 * 세션 초기화 서비스
 * 
 * config/scenarios/{scenarioId}/data/ 에서 데이터를 로드하여
 * 실제 DB에 초기화
 * 
 * CQRS: DB 저장 후 캐시에도 초기화
 */

export class InitService {
  /**
   * 도시 등급 문자열을 숫자로 변환
   */
  private static parseLevelToNumber(level: string | number): number {
    if (typeof level === 'number') return level;
    
    const levelMap: Record<string, number> = {
      '대': 3,
      '중': 2,
      '소': 1,
      '촌': 0
    };
    
    return levelMap[level] || 2;
  }
  
  /**
   * 시나리오 데이터 로드 (새 형식)
   */
  private static loadScenarioData(scenarioId: string, dataFile: string): any {
    const dataPath = path.join(
      __dirname, 
      '../../config/scenarios', 
      scenarioId, 
      'data', 
      `${dataFile}.json`
    );
    
    if (!fs.existsSync(dataPath)) {
      console.warn(`   ⚠️  시나리오 데이터 파일을 찾을 수 없습니다: ${dataPath}`);
      return null;
    }
    
    const content = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 시나리오 템플릿 로드 (레거시 형식 - scenario_*.json)
   */
  private static loadScenarioTemplate(scenarioNumber: number): any {
    const templatePath = path.join(
      __dirname,
      '../../data/scenario-templates',
      `scenario_${scenarioNumber}.json`
    );

    if (!fs.existsSync(templatePath)) {
      console.warn(`   ⚠️  시나리오 템플릿을 찾을 수 없습니다: ${templatePath}`);
      return null;
    }

    const content = fs.readFileSync(templatePath, 'utf-8');
    return JSON.parse(content);
  }
  
  /**
   * 시나리오 메타데이터 로드 (scenario.json)
   */
  private static loadScenarioMetadata(scenarioId: string): any {
    const metadataPath = path.join(
      __dirname, 
      '../../config/scenarios', 
      scenarioId, 
      'scenario.json'
    );
    
    if (!fs.existsSync(metadataPath)) {
      console.warn(`   ⚠️  시나리오 메타데이터를 찾을 수 없습니다: ${metadataPath}`);
      return null;
    }
    
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 세션 초기화 (시나리오 데이터 기반)
   */
  static async initializeSession(sessionId: string, scenarioNumber?: number) {
    console.log(`🎬 세션 초기화 시작: ${sessionId}`);
    
    // 1. 세션 설정 조회
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) throw new Error('세션을 찾을 수 없습니다');
    
    // session.data 초기화 (SessionSync가 사용함)
    session.data = session.data || {};
    session.data.game_env = session.data.game_env || {};
    
    // 시나리오 번호가 있으면 ScenarioResetService 사용 (권장)
    if (scenarioNumber !== undefined) {
      console.log(`   🔄 ScenarioResetService로 초기화: 시나리오 ${scenarioNumber}`);
      const { ScenarioResetService } = await import('./admin/scenario-reset.service');
      await ScenarioResetService.resetScenario(sessionId, scenarioNumber.toString());
      return { cityCount: 94, nationCount: 2, generalCount: 0 }; // 대략적인 값
    }
    
    // 시나리오 ID 결정 (기본: sangokushi)
    const scenarioId = session.scenario_id || 'sangokushi';
    console.log(`   📦 시나리오: ${scenarioId}`);
    
    // 2. 시나리오 메타데이터 로드 (turnterm 등)
    const scenarioMetadata = this.loadScenarioMetadata(scenarioId);
    
    // 3. 기존 데이터 삭제 (재초기화)
    console.log(`   🗑️  기존 데이터 삭제 시작...`);
    
    // 3-1. 핵심 게임 데이터 삭제
    await Promise.all([
      cityRepository.deleteManyByFilter({ session_id: sessionId }),
      nationRepository.deleteManyByFilter({ session_id: sessionId }),
      generalRepository.deleteManyByFilter({ session_id: sessionId }),
    ]);
    console.log(`   ✓ 도시, 국가, 장수 삭제 완료`);

    const unitStackDeleteResult = await unitStackRepository.deleteBySession(sessionId);
    console.log(`   ✓ 주둔/부대 정보 삭제 완료 (${unitStackDeleteResult.deletedCount} stacks)`);
    
    // 3-2. 관련 데이터 삭제 (에러가 나도 계속 진행)
    try {
      const { generalRecordRepository } = await import('../repositories/general-record.repository');
      const { generalTurnRepository } = await import('../repositories/general-turn.repository');
      const { nationTurnRepository } = await import('../repositories/nation-turn.repository');
      const { worldHistoryRepository } = await import('../repositories/world-history.repository');
      
      await Promise.all([
        generalRecordRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {}),
        generalTurnRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {}),
        nationTurnRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {}),
        worldHistoryRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {}),
      ]);
      console.log(`   ✓ 기록 데이터 삭제 완료`);
    } catch (err) {
      console.log(`   ⚠️  기록 데이터 삭제 스킵:`, err);
    }
    
    // 4. 시나리오 데이터 로드
    const citiesData = this.loadScenarioData(scenarioId, 'cities');
    
    if (!citiesData || !citiesData.cities) {
      console.error(`   ❌ 도시 데이터를 찾을 수 없습니다`);
      throw new Error('도시 데이터를 로드할 수 없습니다');
    }
    
    const cities = citiesData.cities;
    console.log(`   📍 도시 데이터: ${cities.length}개 로드됨`);
    
    const cityCount = cities.length;
    
    // 4. 도시 생성 - DB에 직접 저장
    let createdCount = 0;
    for (const cityTemplate of cities) {
      const initialState = cityTemplate.initialState || {};
      const position = cityTemplate.position || {};
      
      const cityData = {
        session_id: sessionId,
        city: cityTemplate.id,
        name: cityTemplate.name,
        
        // 기본 정보
        nation: 0,  // 처음엔 중립 (재야)
        level: cityTemplate.levelId !== undefined ? cityTemplate.levelId : 2, // levelId가 0일 수 있으므로 || 대신 !== undefined 사용
        state: 0,
        region: cityTemplate.regionId !== undefined ? cityTemplate.regionId : 0,
        
        // 자원
        pop: initialState.population || 100000,
        pop_max: (initialState.population || 100000) * 10,
        agri: initialState.agriculture || 1000,
        agri_max: (initialState.agriculture || 1000) * 10,
        comm: initialState.commerce || 1000,
        comm_max: (initialState.commerce || 1000) * 10,
        secu: initialState.security || 100,
        secu_max: (initialState.security || 100) * 10,
        def: initialState.defense || 100,
        def_max: (initialState.defense || 100) * 10,
        wall: initialState.wall || 1000,
        wall_max: (initialState.wall || 1000) * 10,
        
        // 게임 속성
        trust: 50,
        front: 0,
        supply: 0,
        trade: 0,
        
        // 지리 정보
        x: position.x || 0,
        y: position.y || 0,
        neighbors: cityTemplate.neighbors || [],  // 도시 ID 배열
        terrain: cityTemplate.terrain
      };
      
      // 첫 번째 도시 로그 출력 (디버깅용)
      if (createdCount === 0) {
        console.log(`   🔍 첫 번째 도시 데이터 샘플:`, {
          id: cityData.city,
          name: cityData.name,
          levelId: cityData.level,
          regionId: cityData.region,
          pop: cityData.pop,
          agri: cityData.agri,
          position: { x: cityData.x, y: cityData.y },
          neighbors: cityData.neighbors
        });
      }
      
      // DB에 직접 저장 (Mongoose create는 DB에 저장함)
      const city = new City(cityData);
      await city.save();
      
      // 캐시에도 초기화 (CQRS 일관성)
      const cityObj = city.toObject();
      await saveCity(sessionId, cityObj.city, cityObj);
      
      createdCount++;
    }
    
    console.log(`   ✅ 도시 ${createdCount}개 생성 완료 (총 ${cities.length}개 중)`);
    
    await this.initializeGarrisons(sessionId, scenarioId, cities);
    
    // 5. 초기 국가 생성
    const nationsData = this.loadScenarioData(scenarioId, 'nations');
    let nationCount = 0;
    
    if (nationsData && nationsData.nations && Array.isArray(nationsData.nations)) {
      // nations.json에서 초기 국가 데이터 로드
      console.log(`   📜 초기 국가 데이터: ${nationsData.nations.length}개 발견`);
      
      for (const nationTemplate of nationsData.nations) {
        // capital 필드 처리: 문자열(도시 이름)이면 도시 ID로 변환
        let capitalId = 0;
        const nationId = nationTemplate.id || nationTemplate.nation || 0;
        const nationName = nationTemplate.name || '무명';
        const cityNames = nationTemplate.cities || [];
        
        if (nationTemplate.capital) {
          // 1. capital이 자신의 cities 배열에 포함되어 있는지 검증
          const capitalName = typeof nationTemplate.capital === 'string' 
            ? nationTemplate.capital 
            : null;
          
          if (capitalName && !cityNames.includes(capitalName)) {
            console.error(`     ❌ ${nationName} 수도 '${capitalName}'이(가) 자신의 영토에 없음!`);
            throw new Error(
              `Invalid scenario: Nation '${nationName}' capital '${capitalName}' is not in its cities list`
            );
          }
          
          // 2. 도시 ID로 변환
          if (typeof nationTemplate.capital === 'string') {
            // 도시 이름으로 조회 (자신의 영토인지 확인)
            const capitalCity = await cityRepository.findOneByFilter({
              session_id: sessionId,
              name: nationTemplate.capital,
              nation: nationId
            });
            if (capitalCity) {
              capitalId = capitalCity.city;
              console.log(`     - ${nationName} 수도: ${nationTemplate.capital} (ID: ${capitalId})`);
            } else {
              console.error(`     ❌ ${nationName} 수도 '${nationTemplate.capital}' 찾을 수 없거나 다른 국가 영토임`);
              throw new Error(
                `Invalid scenario: Nation '${nationName}' capital '${capitalName}' not found or belongs to another nation`
              );
            }
          } else if (typeof nationTemplate.capital === 'number') {
            // 숫자로 지정된 경우도 검증
            const capitalCity = await cityRepository.findOneByFilter({
              session_id: sessionId,
              city: nationTemplate.capital,
              nation: nationId
            });
            if (capitalCity) {
              capitalId = nationTemplate.capital;
            } else {
              console.error(`     ❌ ${nationName} 수도 ID ${nationTemplate.capital}이(가) 자신의 영토에 없음`);
              throw new Error(
                `Invalid scenario: Nation '${nationName}' capital ID ${nationTemplate.capital} not found or belongs to another nation`
              );
            }
          }
        }

        const nationData = {
          session_id: sessionId,
          nation: nationTemplate.id || nationTemplate.nation || 0,
          name: nationTemplate.name || '무명',
          color: nationTemplate.color || '#888888',
          capital: capitalId,
          gold: nationTemplate.gold || 0,
          rice: nationTemplate.rice || 0,
          rate: nationTemplate.rate || 0,
          data: {
            level: nationTemplate.level || 0,
            type: nationTemplate.type || 'neutral',
            cities: nationTemplate.cities || [],  // 초기 영토
            tech: nationTemplate.tech || 0,
            prestige: nationTemplate.prestige || 0,
            legitimacy: nationTemplate.legitimacy || 0,
            capital: capitalId,
            capital_name: nationTemplate.capital || ''
          }
        };
        
        const nation = new Nation(nationData);
        await nation.save();
        
        // 캐시에도 초기화 (CQRS 일관성)
        const nationObj = nation.toObject();
        await saveNation(sessionId, nationObj.nation, nationObj);
        
        nationCount++;
        
        // 국가에 속한 도시들의 nation 필드 업데이트
        if (nationData.data.cities && nationData.data.cities.length > 0) {
          await City.updateMany(
            { 
              session_id: sessionId,
              city: { $in: nationData.data.cities }
            },
            { 
              $set: { nation: nationData.nation }
            }
          );
          console.log(`     - ${nationData.name}: ${nationData.data.cities.length}개 도시 할당`);
        }
      }
      
      console.log(`   ✅ 초기 국가 ${nationCount}개 생성 완료`);
    } else {
      // nations.json이 없으면 재야만 생성
      console.log(`   ⚠️  초기 국가 데이터 없음 - 재야만 생성`);
      
      const nationData = {
        session_id: sessionId,
        nation: 0,
        name: '재야',
        color: '#888888',
        capital: 0,
        gold: 0,
        rice: 0,
        rate: 0,
        data: {
          level: 0,
          type: 'neutral',
          cities: [],
          tech: 0,
          prestige: 0,
          legitimacy: 0
        }
      };
      const nation = new Nation(nationData);
      await nation.save();
      
      // 캐시에도 초기화 (CQRS 일관성)
      const nationObj = nation.toObject();
      await saveNation(sessionId, nationObj.nation, nationObj);
      
      nationCount = 1;
      
      console.log(`   ✅ 재야 국가 생성 완료`);
    }
    
    // 5. 세션 데이터 초기화 (턴 시간, 년/월 등)
    // 시나리오에서 turnterm 가져오기 (없으면 세션 기본값, 그것도 없으면 60분)
    const scenarioTurnterm = scenarioMetadata?.gameSettings?.turnterm || scenarioMetadata?.turnterm;
    const turnterm = session.turnterm || scenarioTurnterm || 60; // 분 단위로 저장

    // 시나리오 메타데이터에서 시작 년도 읽기
    const scenarioStartYear = scenarioMetadata?.metadata?.startYear || 
                              scenarioMetadata?.startYear || 
                              184;

    // SessionSync를 사용하여 모든 위치에 동기화
    // 초기화 시에는 기존 값을 무시하고 새로 설정
    SessionSync.syncTurnterm(session, turnterm);
    SessionSync.syncStartyear(session, scenarioStartYear);
    SessionSync.syncYear(session, scenarioStartYear);
    SessionSync.syncMonth(session, 1);
    
    // starttime과 turntime은 현재 시간 기준 (현실 시간)
    // 초기화 시에는 항상 현재 시간으로 리셋
    const now = new Date();
    SessionSync.syncStarttime(session, now);
    SessionSync.syncTurntime(session, now);
    
    // 서버 상태를 폐쇄(준비중)로 설정
    // 시나리오 초기화 후에는 관리자가 수동으로 서버를 오픈해야 함
    session.status = 'preparing';
    SessionSync.syncIsunited(session, 2); // 2 = 폐쇄
    
    // NPC AI 기본값 설정 (full = 모든 NPC에 AI 활성화)
    session.data.game_env.npc_ai_mode = session.data.game_env.npc_ai_mode || 'full';
    console.log(`   ✅ NPC AI 모드: ${session.data.game_env.npc_ai_mode}`);
    
    console.log(`   ✅ 게임 시작 시간 설정: ${now.toISOString()}`);
    console.log(`   ✅ 게임 시작 년도: ${scenarioStartYear}년 1월`);
    console.log(`   ✅ 서버 상태: 폐쇄 (preparing), isunited: 2`);
    
    session.turn = 0; // 초기화 시에는 항상 0

    session.markModified('data');
    session.markModified('data.game_env');
    await sessionRepository.saveDocument(session);
    
    // CQRS: DB 저장 후 캐시에도 초기화
    const sessionObj = session.toObject();
    await saveSession(sessionId, sessionObj);
    
    // 저장 후 실제 DB 값 확인
    const savedSession = await sessionRepository.findBySessionId(sessionId);
    const savedData = savedSession?.data || {};
    const savedGameEnv = savedData.game_env || {};
    
    console.log(`   ✅ 세션 데이터 초기화 완료:`);
    console.log(`      - 턴텀: ${turnterm}분`);
    console.log(`      - 시작 년도: ${scenarioStartYear}년`);
    console.log(`      - 현재 년/월: ${scenarioStartYear}년 1월`);
    console.log(`      - starttime: ${now.toISOString()}`);
    console.log(`      - turntime: ${now.toISOString()}`);
    console.log(`      - isunited: 2 (폐쇄)`);
    console.log(`   📊 DB 저장 확인:`);
    console.log(`      - data.startyear: ${savedData.startyear}`);
    console.log(`      - data.year: ${savedData.year}`);
    console.log(`      - data.month: ${savedData.month}`);
    console.log(`      - data.starttime: ${savedData.starttime}`);
    console.log(`      - data.turntime: ${savedData.turntime}`);
    console.log(`      - data.isunited: ${savedData.isunited}`);
    console.log(`      - game_env.startyear: ${savedGameEnv.startyear}`);
    console.log(`      - game_env.year: ${savedGameEnv.year}`);
    console.log(`      - game_env.month: ${savedGameEnv.month}`);
    console.log(`      - game_env.starttime: ${savedGameEnv.starttime}`);
    console.log(`      - game_env.isunited: ${savedGameEnv.isunited}`);
    console.log(`🎉 세션 초기화 완료!\n`);
    
    return { cityCount };
  }

  private static async initializeGarrisons(sessionId: string, scenarioId: string, cities: any[]): Promise<void> {
    const entries = generateInitialGarrisonsForCities(scenarioId, cities);
    if (!entries.length) {
      console.log('   ⚠️  주둔병 데이터가 비어있어 스킵합니다');
      return;
    }

    let totalStacks = 0;
    for (const entry of entries) {
      await unitStackRepository.bulkCreate(sessionId, 'city', entry.cityId, entry.stacks);
      totalStacks += entry.stacks.length;
    }

    console.log(`   ✅ 초기 주둔병 ${totalStacks}개 스택 배치 (도시 ${entries.length}곳)`);
  }
  
  // initializeFromTemplate는 제거됨
  // ScenarioResetService를 사용하세요
}
