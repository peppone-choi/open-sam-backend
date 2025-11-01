import { Session } from '../models/session.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';

/**
 * 세션 초기화 서비스
 * 
 * session-sangokushi-complete.json의 데이터를
 * 실제 DB에 풀어서 초기화
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
   * 세션 초기화 (도시 94개 생성)
   */
  static async initializeSession(sessionId: string) {
    console.log(`🎬 세션 초기화 시작: ${sessionId}`);
    
    // 1. 세션 설정 조회
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) throw new Error('세션을 찾을 수 없습니다');
    
    // 2. 기존 도시 삭제 (재초기화)
    await City.deleteMany({ session_id: sessionId });
    console.log(`   🗑️  기존 도시 삭제`);
    
    // 3. city_templates에서 도시 생성
    const cityTemplates = (session as any).cities || {};
    const cityCount = Object.keys(cityTemplates).length;
    
    console.log(`   📍 도시 템플릿: ${cityCount}개`);
    console.log(`   📍 첫 번째 키:`, Object.keys(cityTemplates)[0]);
    
    for (const [cityId, template] of Object.entries(cityTemplates)) {
      const cityData: any = template;
      
      // City 문서 생성 - 모든 데이터를 스키마 레벨로
      await City.create({
        session_id: sessionId,
        city: parseInt(cityId),
        name: cityData.name,
        
        // 기본 정보
        nation: 0,  // 처음엔 중립 (재야)
        level: this.parseLevelToNumber(cityData.level || '중'),
        state: 0,
        region: cityData.region || 0,  // 문자열("하북") 또는 숫자(0) 모두 허용
        
        // 자원
        pop: cityData.population || 100000,
        pop_max: (cityData.population || 100000) * 10,
        agri: cityData.agriculture || 1000,
        agri_max: (cityData.agriculture || 1000) * 10,
        comm: cityData.commerce || 1000,
        comm_max: (cityData.commerce || 1000) * 10,
        secu: cityData.security || 100,
        secu_max: (cityData.security || 100) * 10,
        def: cityData.defense || 100,
        def_max: (cityData.defense || 100) * 10,
        wall: cityData.wall || 1000,
        wall_max: (cityData.wall || 1000) * 10,
        
        // 게임 속성
        trust: 50,
        front: 0,
        supply: 0,
        trade: 0,
        
        // 지리 정보
        x: cityData.x || 0,
        y: cityData.y || 0,
        neighbors: cityData.neighbors || [],  // 도시 이름 배열 또는 ID 배열
        terrain: cityData.terrain
      });
    }
    
    console.log(`   ✅ 도시 ${cityCount}개 생성 완료`);
    
    // 4. 초기 국가 생성 (재야)
    await Nation.deleteMany({ session_id: sessionId });
    await Nation.create({
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
    session.data.turnterm = session.data.turnterm || 10; // 기본 10분턴
    session.data.year = session.data.year || 184;
    session.data.month = session.data.month || 1;
    session.data.startyear = session.data.startyear || 184;
    session.data.turn = session.data.turn || 0;
    session.data.turntime = session.data.turntime || new Date();
    session.data.starttime = session.data.starttime || new Date();
    
    await session.save();
    console.log(`   ✅ 세션 데이터 초기화 (턴: ${session.data.turnterm}분)`);
    console.log(`🎉 세션 초기화 완료!\n`);
    
    return { cityCount };
  }
}
