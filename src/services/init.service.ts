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
   * 세션 초기화 (도시 94개 생성)
   */
  /**
   * 도시 크기별 최대치 계산
   */
  private static getCityMaxValues(level: string): {
    agri_max: number;
    comm_max: number;
    secu_max: number;
    def_max: number;
    wall_max: number;
    pop_max: number;
  } {
    // 도시 크기별 최대치 (삼국지 표준)
    const maxValuesByLevel: Record<string, any> = {
      '특': { agri: 10000, comm: 10000, secu: 10000, def: 10000, wall: 10000, pop: 500000 },  // 특대 도시
      '대': { agri: 8000, comm: 8000, secu: 8000, def: 8000, wall: 8000, pop: 400000 },       // 대도시
      '중': { agri: 6000, comm: 6000, secu: 6000, def: 6000, wall: 6000, pop: 300000 },       // 중도시
      '소': { agri: 4000, comm: 4000, secu: 4000, def: 4000, wall: 4000, pop: 200000 },       // 소도시
      '이': { agri: 3000, comm: 3000, secu: 3000, def: 3000, wall: 3000, pop: 150000 },       // 이민족
      '관': { agri: 1000, comm: 1000, secu: 1000, def: 10000, wall: 10000, pop: 50000 },      // 관문 (방어 높음)
      '진': { agri: 2000, comm: 2000, secu: 2000, def: 2000, wall: 2000, pop: 100000 },       // 진
      '수': { agri: 2000, comm: 2000, secu: 2000, def: 2000, wall: 2000, pop: 100000 }        // 수상
    };
    
    const defaults = maxValuesByLevel[level] || maxValuesByLevel['중'];
    
    return {
      agri_max: defaults.agri,
      comm_max: defaults.comm,
      secu_max: defaults.secu,
      def_max: defaults.def,
      wall_max: defaults.wall,
      pop_max: defaults.pop
    };
  }
  
  static async initializeSession(sessionId: string) {
    console.log(`🎬 세션 초기화 시작: ${sessionId}`);
    
    // 1. 세션 설정 조회
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      console.error(`❌ 세션을 찾을 수 없습니다: ${sessionId}`);
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }
    
    console.log(`   ✅ 세션 발견: ${session.name}`);
    
    // 2. 기존 도시 삭제 (재초기화)
    const deleteResult = await City.deleteMany({ session_id: sessionId });
    console.log(`   🗑️  기존 도시 삭제: ${deleteResult.deletedCount}개`);
    
    // 3. city_templates에서 도시 생성
    const cityTemplates = (session as any).cities || {};
    const cityCount = Object.keys(cityTemplates).length;
    
    console.log(`   📍 도시 템플릿: ${cityCount}개`);
    
    if (cityCount === 0) {
      console.error(`❌ 도시 템플릿이 없습니다!`);
      console.log(`   세션 데이터:`, JSON.stringify(session, null, 2).substring(0, 500));
      throw new Error('도시 템플릿이 없습니다');
    }
    
    console.log(`   📍 첫 번째 도시:`, Object.keys(cityTemplates)[0]);
    
    let createdCount = 0;
    for (const [cityId, template] of Object.entries(cityTemplates)) {
      const cityData: any = template;
      
      // 도시 크기별 최대치 계산
      const maxValues = this.getCityMaxValues(cityData.level || '중');
      
      try {
        // City 문서 생성
        await City.create({
          session_id: sessionId,
          city: parseInt(cityId),
          name: cityData.name,
          
          // 자주 접근하는 필드들 (최상위 레벨)
          nation: 0,  // 처음엔 중립
          pop: cityData.population || 100000,
          pop_max: maxValues.pop_max,
          agri: cityData.agriculture || 1000,
          agri_max: maxValues.agri_max,
          comm: cityData.commerce || 1000,
          comm_max: maxValues.comm_max,
          secu: cityData.security || 100,
          secu_max: maxValues.secu_max,
          def: cityData.defense || 100,
          def_max: maxValues.def_max,
          wall: cityData.wall || 1000,
          wall_max: maxValues.wall_max,
          trust: 50,
          front: 0,
          supply: 0,
          
          data: {
            // 추가 동적 데이터
            level: cityData.level || '중',
            region: cityData.region || '',
            x: cityData.x || 0,
            y: cityData.y || 0,
            neighbors: cityData.neighbors || []
          }
        });
        createdCount++;
      } catch (error: any) {
        console.error(`   ❌ 도시 ${cityId}(${cityData.name}) 생성 실패:`, error.message);
      }
    }
    
    console.log(`   ✅ 도시 ${createdCount}/${cityCount}개 생성 완료`);
    
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
