import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';
import { RandUtil } from '../../utils/RandUtil';

export class MarriageService {
  /**
   * 결혼 시도
   */
  static async proposeMarriage(sessionId: string, proposerId: number, targetId: number) {
    const [proposer, target] = await Promise.all([
      generalRepository.findBySessionAndNo(sessionId, proposerId),
      generalRepository.findBySessionAndNo(sessionId, targetId)
    ]);

    if (!proposer || !target) throw new Error('장수를 찾을 수 없습니다.');

    // 이미 배우자가 있는지 확인
    if (proposer.data.aux?.spouse || target.data.aux?.spouse) {
      throw new Error('이미 배우자가 있습니다.');
    }

    // 결혼 성사 (100% 성공으로 가정 - 실제로는 호감도 등 체크 필요)
    proposer.data.aux = { ...proposer.data.aux, spouse: targetId };
    target.data.aux = { ...target.data.aux, spouse: proposerId };

    await Promise.all([
      generalRepository.updateBySessionAndNo(sessionId, proposerId, { 'data.aux': proposer.data.aux }),
      generalRepository.updateBySessionAndNo(sessionId, targetId, { 'data.aux': target.data.aux })
    ]);

    logger.info(`[Marriage] ${proposer.name} and ${target.name} are now married!`);
    return true;
  }

  /**
   * 자녀 탄생 시도 (턴 진행 시 호출)
   */
  static async tryHaveChild(sessionId: string, generalId: number) {
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
    if (!general || !general.data.aux?.spouse) return;

    const rng = new RandUtil(Date.now());
    // 1% 확률로 탄생
    if (!rng.nextBool(0.01)) return;

    const childId = rng.nextRangeInt(100000, 999999);
    const children = general.data.aux.children || [];
    children.push({
      id: childId,
      name: `${general.name}의 아이`,
      bornYear: 200 // 임시
    });

    await generalRepository.updateBySessionAndNo(sessionId, generalId, {
      'data.aux.children': children
    });

    logger.info(`[Marriage] Child born for ${general.name}`);
  }
}
