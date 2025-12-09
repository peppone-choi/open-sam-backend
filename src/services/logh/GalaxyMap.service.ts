import { GalaxyGrid, IGalaxyGrid, GridType, FactionCode } from '../../models/logh/GalaxyGrid.model';

export class GalaxyMapService {
  
  /**
   * 특정 좌표의 그리드 조회 (없으면 자동 생성 - 지연 생성 방식)
   */
  static async getGrid(sessionId: string, x: number, y: number): Promise<IGalaxyGrid> {
    let grid = await GalaxyGrid.findOne({ sessionId, x, y });
    
    if (!grid) {
      // 기본적으로 빈 공간(SPACE)으로 생성
      // 특정 좌표에 성계나 장애물이 있는지 확인하는 로직 필요 (맵 생성 시드 기반)
      const type = this.determineGridTypeBySeed(x, y);
      
      grid = new GalaxyGrid({
        sessionId,
        x,
        y,
        type,
        unitCounts: { empire: 0, alliance: 0, rebel: 0 },
        factionsPresent: []
      });
      await grid.save();
    }
    
    return grid;
  }

  /**
   * 두 좌표 간 거리 계산 (단위: 그리드 칸 수)
   */
  static calculateDistance(from: { x: number; y: number }, to: { x: number; y: number }): number {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    // 대각선 이동도 1칸으로 칠 것인지, 유클리드 거리로 할 것인지 결정 필요.
    // 메뉴얼상 "100광년 단위의 그리드"이고 워프 항행이므로 유클리드 거리 * 100이 실제 거리.
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 워프 항행 가능 여부 체크
   * 메뉴얼 1512행: 성계 그리드 진입 시 인접 그리드로 1차 워프 필요
   */
  static async checkWarp(
    sessionId: string,
    from: { x: number; y: number }, 
    to: { x: number; y: number },
    faction: FactionCode,
    unitCount: number
  ): Promise<{ allowed: boolean; reason?: string; cost?: number }> {
    
    const targetGrid = await this.getGrid(sessionId, to.x, to.y);
    
    // 1. 그리드 진입 제한 체크 (유닛수, 진영수, 지형 등)
    const enterCheck = targetGrid.canEnter(faction, unitCount);
    if (!enterCheck.allowed) {
      return enterCheck;
    }

    // 2. 성계 진입 2단계 룰 (메뉴얼 1516행: "원거리에서 1번의 워프로 성계 그리드에 들어갈 수는 없다")
    if (targetGrid.type === 'SYSTEM') {
      const distance = this.calculateDistance(from, to);
      // 바로 인접한 칸(거리 1.5 이하)이 아니면 진입 불가
      if (distance > 1.5) {
        return { allowed: false, reason: '성계 진입을 위해서는 인접 구역까지 먼저 이동해야 합니다.' };
      }
    }

    // 3. 워프 비용 및 시간 계산 (메뉴얼 4726행: 이동거리 * 가중치)
    const distance = this.calculateDistance(from, to);
    const cost = Math.ceil(distance * 10); // 임시 공식 (거리 비례 CP 소모)

    return { allowed: true, cost };
  }

  /**
   * 맵 시드 기반 그리드 타입 결정 (임시 로직)
   * 실제로는 DB에 저장된 초기 맵 데이터를 참조해야 함
   */
  private static determineGridTypeBySeed(x: number, y: number): GridType {
    // 예시: 특정 좌표는 성계, 특정 좌표는 장애물
    // 제국 수도: (50, 20), 동맹 수도: (50, 80), 이젤론: (50, 50)
    if ((x === 50 && y === 20) || (x === 50 && y === 80) || (x === 50 && y === 50)) {
      return 'SYSTEM';
    }
    
    // 장애물 예시
    if (x > 40 && x < 60 && y === 40) {
      return 'OBSTACLE';
    }

    return 'SPACE';
  }
}






