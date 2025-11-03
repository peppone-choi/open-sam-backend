import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { Nation } from '../../../models/nation.model';

/**
 * NPC 국가 생성 액션
 * PHP RaiseNPCNation Action과 동일한 구조
 * 복잡한 로직이므로 기본 구조만 구현
 */
export class RaiseNPCNation extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 180;
    const month = env['month'] || 1;

    // 소, 중 성만 선택 (level 5~6)
        const allCities = await (City as any).find({
      session_id: sessionId,
      level: { $gte: 5, $lte: 6 },
      nation: 0 // 빈 도시
    });

    const emptyCities = allCities.filter(city => (city.nation || 0) === 0);
    const occupiedCities = allCities.filter(city => (city.nation || 0) !== 0);

    if (emptyCities.length === 0) {
      return [RaiseNPCNation.name, 0];
    }

    // TODO: 복잡한 NPC 국가 생성 로직 구현
    // - 평균 도시 계산
    // - 평균 장수 수 계산
    // - 평균 기술 계산
    // - 거리 측정
    // - NPC 국가 생성

    const createdCount = 0; // 임시

    // TODO: 로그 처리
    // if (createdCount > 0) {
    //   const logger = new ActionLogger(0, 0, year, month);
    //   logger.pushGlobalHistoryLog(`<L><b>【공지】</b></>공백지에 임의의 국가가 생성되었습니다.`);
    //   logger.flush();
    // }

    return [RaiseNPCNation.name, createdCount];
  }
}

