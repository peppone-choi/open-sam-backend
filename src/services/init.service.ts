import { Session } from '../models/session.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import * as fs from 'fs';
import * as path from 'path';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { sessionRepository } from '../repositories/session.repository';
import { generalRepository } from '../repositories/general.repository';

/**
 * 세션 초기화 서비스
 * 
 * config/scenarios/{scenarioId}/data/ 에서 데이터를 로드하여
 * 실제 DB에 초기화
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
      createdCount++;
    }
    
    console.log(`   ✅ 도시 ${createdCount}개 생성 완료 (총 ${cities.length}개 중)`);
    
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
      nationCount = 1;
      
      console.log(`   ✅ 재야 국가 생성 완료`);
    }
    
    // 5. 세션 데이터 초기화 (턴 시간, 년/월 등)
    // 시나리오에서 turnterm 가져오기 (없으면 세션 기본값, 그것도 없으면 60분)
    const scenarioTurnterm = scenarioMetadata?.gameSettings?.turnterm || scenarioMetadata?.turnterm;
    session.turnterm = session.turnterm || scenarioTurnterm || 60; // 분 단위로 저장

    // 시나리오 메타데이터에서 시작 년도 읽기
    const scenarioStartYear = scenarioMetadata?.metadata?.startYear || 
                              scenarioMetadata?.startYear || 
                              184;

    session.year = session.year || scenarioStartYear;
    session.month = session.month || 1;
    session.startyear = session.startyear || scenarioStartYear;
    session.turn = session.turn || 0;
    session.turntime = session.turntime || new Date();
    session.starttime = session.starttime || new Date();

    await session.save();
    console.log(`   ✅ 세션 데이터 초기화 (턴: ${session.turnterm}분)`);
    console.log(`🎉 세션 초기화 완료!\n`);
    
    return { cityCount };
  }
  
  // initializeFromTemplate는 제거됨
  // ScenarioResetService를 사용하세요
}
