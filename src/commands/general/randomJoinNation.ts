import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';

/**
 * 랜덤 임관 커맨드
 * 
 * 재야 장수가 무작위 국가로 임관합니다.
 * 국력이 약한 국가에 우선적으로 배정됩니다.
 */
export class RandomJoinNationCommand extends GeneralCommand {
  protected static actionName = '무작위 국가로 임관';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.AllowJoinAction(),
    ];
  }

  public getCommandDetailTitle(): string {
    return '무작위 국가로 임관';
  }

  public getBrief(): string {
    return '무작위 국가로 임관';
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;
    const sessionId = env.session_id || 'sangokushi_default';

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalName = general.getName();

    const relYear = env.year - env.startyear;

    let destNation: any = null;

    const initialNationGenLimit = 6; // GameConst::$initialNationGenLimit
    const defaultMaxGeneral = 50; // GameConst::$defaultMaxGeneral

    // Repository를 사용한 간단한 국가 선택
    const genLimit = relYear < 3 ? initialNationGenLimit : defaultMaxGeneral;
    
    // 정식 국가 중 인원이 제한보다 적은 국가 조회
    const nationDocs = await nationRepository.findByFilter({
      session_id: sessionId,
      'data.level': { $gt: 0 },
      'data.scout': 0,
      'data.gennum': { $lt: genLimit }
    });

    if (nationDocs.length > 0) {
      // NPC이고 역사 시나리오인 경우 - 친화도 기반 선택
      if (general.getNPCType() >= 2 && !env.fiction && env.scenario >= 1000 && env.scenario < 2000) {
        let maxScore = 1 << 30;
        const generalAffinity = general.getVar('affinity');

        for (const nationDoc of nationDocs) {
          const nation = nationDoc.data;
          
          // 해당 국가의 군주 찾기
          const lordDoc = await generalRepository.findOneByFilter({
            session_id: sessionId,
            'data.nation': nation.nation,
            'data.officer_level': 12
          });

          if (!lordDoc) continue;

          const lordAffinity = lordDoc.data?.affinity || 75;
          let affinityDiff = Math.abs(generalAffinity - lordAffinity);
          affinityDiff = Math.min(affinityDiff, Math.abs(affinityDiff - 150));

          let score = Math.log2(affinityDiff + 1);
          score += rng.nextFloat1();

          const allGen = nationDocs.reduce((sum, n) => sum + (n.data?.gennum || 0), 0);
          score += Math.sqrt((nation.gennum || 0) / Math.max(allGen, 1));

          if (score < maxScore) {
            maxScore = score;
            destNation = nation;
          }
        }
      } else {
        // 일반 장수 - 단순 랜덤 선택 (복잡한 국력 계산 제거)
        const validNations = nationDocs.map(doc => doc.data);
        
        // 균등 확률로 랜덤 선택
        const weights = validNations.map(() => 1);
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        
        let random = rng.nextFloat1() * totalWeight;
        for (let i = 0; i < validNations.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            destNation = validNations[i];
            break;
          }
        }
        
        if (!destNation && validNations.length > 0) {
          destNation = validNations[0];
        }
      }
    }

    const logger = general.getLogger();

    if (!destNation) {
      logger.pushGeneralActionLog(`임관 가능한 국가가 없습니다. <1>${date}</>`);
      
      try {
        const { SearchTalentCommand } = await import('./searchTalent');
        this.alternative = new SearchTalentCommand(general, env, null);
      } catch (error) {
        console.error('대안 커맨드 설정 실패:', error);
      }
      
      return false;
    }

    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const talkList = [
      '어쩌다 보니',
      '인연이 닿아',
      '발길이 닿는 대로',
      '소문을 듣고',
      '점괘에 따라',
      '천거를 받아',
      '유명한',
      '뜻을 펼칠 곳을 찾아',
      '고향에 가까운',
      '천하의 균형을 맞추기 위해',
      '오랜 은거를 마치고',
    ];
    const randomTalk = rng.choice(talkList);

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 랜덤 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 랜덤 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 ${randomTalk} <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp: number;
    if (gennum < initialNationGenLimit) {
      exp = 700;
    } else {
      exp = 100;
    }

    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      const lordGeneral = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': destNationID,
        'data.officer_level': 12
      });
      const targetCityID = lordGeneral?.data?.city || 1;
      general.setVar('city', targetCityID);
    }

    const currentNation = await nationRepository.findByNationNum(sessionId, destNationID);
    await nationRepository.updateByNationNum(sessionId, destNationID, {
      gennum: (currentNation?.gennum || 0) + 1
    });

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(RandomJoinNationCommand.getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(
        general.genGenericUniqueRNG(RandomJoinNationCommand.actionName),
        general,
        sessionId,
        '랜덤임관'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
