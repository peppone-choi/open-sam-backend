import { Session } from '../models/session.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import * as fs from 'fs';
import * as path from 'path';

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
   * 시나리오 데이터 로드
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
  static async initializeSession(sessionId: string) {
    console.log(`🎬 세션 초기화 시작: ${sessionId}`);
    
    // 1. 세션 설정 조회
    const session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) throw new Error('세션을 찾을 수 없습니다');
    
    // 시나리오 ID 결정 (기본: sangokushi)
    const scenarioId = session.scenario_id || 'sangokushi';
    console.log(`   📦 시나리오: ${scenarioId}`);
    
    // 2. 시나리오 메타데이터 로드 (turnterm 등)
    const scenarioMetadata = this.loadScenarioMetadata(scenarioId);
    
    // 3. 기존 도시 삭제 (재초기화)
    await (City as any).deleteMany({ session_id: sessionId });
    console.log(`   🗑️  기존 도시 삭제`);
    
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
      
      // DB에 직접 저장 (Mongoose create는 DB에 저장함)
      const city = new (City as any)(cityData);
      await city.save();
    }
    
    console.log(`   ✅ 도시 ${cities.length}개 생성 완료`);
    
    // 4. 초기 국가 생성 (재야)
    await (Nation as any).deleteMany({ session_id: sessionId });
    await (Nation as any).create({
      session_id: sessionId,
      nation: 0,
      name: '재야',
      data: {
        color: '#000000',
        capital: 0,
        gold: 0,
        rice: 0,
        level: 0
      }
    });
    
    console.log(`   ✅ 초기 국가 생성 완료`);
    
    // 5. 세션 데이터 초기화 (턴 시간, 년/월 등)
    if (!session.data) session.data = {};
    
    // 시나리오에서 turnterm 가져오기 (없으면 세션 기본값, 그것도 없으면 60분)
    const scenarioTurnterm = scenarioMetadata?.gameSettings?.turnterm || scenarioMetadata?.turnterm;
    session.data.turnterm = session.data.turnterm || scenarioTurnterm || 60; // 분 단위로 저장
    
    session.data.year = session.data.year || 184;
    session.data.month = session.data.month || 1;
    session.data.startyear = session.data.startyear || 184;
    session.data.turn = session.data.turn || 0;
    session.data.turntime = session.data.turntime || new Date();
    session.data.starttime = session.data.starttime || new Date();
    
    session.markModified('data');
    await session.save();
    console.log(`   ✅ 세션 데이터 초기화 (턴: ${session.data.turnterm}분)`);
    console.log(`🎉 세션 초기화 완료!\n`);
    
    return { cityCount };
  }
}
