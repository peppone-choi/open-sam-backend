import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { GameConst } from '../../constants/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { Util } from '../../utils/Util';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class BattleStanceCommand extends GeneralCommand {
    static actionName = '전투태세';

    protected argTest(): boolean {
        this.arg = null;
        return true;
    }

    protected init(): void {
        const general = this.generalObj;

        this.setCity();
        this.setNation();

        const [reqGold, reqRice] = this.getCost();

        this.fullConditionConstraints = [
            ConstraintHelper.NotBeNeutral(),
            ConstraintHelper.NotWanderingNation(),
            ConstraintHelper.OccupiedCity(),
            ConstraintHelper.ReqGeneralCrew(),
            ConstraintHelper.ReqGeneralGold(reqGold),
            ConstraintHelper.ReqGeneralRice(reqRice),
            ConstraintHelper.ReqGeneralTrainMargin(GameConst.maxTrainByCommand - 10),
            ConstraintHelper.ReqGeneralAtmosMargin(GameConst.maxAtmosByCommand - 10),
        ];
    }

    public getCost(): [number, number] {
        const crew = this.generalObj.getVar('crew');
        const tech = this.nation?.tech || 0;
        const techCost = 1 + tech * 0.1; 
        
        return [Util.round(crew / 100 * 3 * techCost), 0];
    }

    public getPreReqTurn(): number {
        return 3;
    }

    public getPostReqTurn(): number {
        return 0;
    }

    public async run(): Promise<boolean> {
        if (!this.hasFullConditionMet()) {
            throw new Error('불가능한 커맨드를 강제로 실행 시도');
        }

        const db = this.getDB();
        const general = this.generalObj;
        const date = general.getTurnTime(GeneralCommand.TURNTIME_HM);

        const lastTurn = general.getLastTurn();
        const turnResult = new LastTurn(BattleStanceCommand.actionName, this.arg);

        const reqTurn = this.getPreReqTurn();

        if (lastTurn.getCommand() != BattleStanceCommand.actionName) {
            turnResult.setTerm(1);
        } else if (lastTurn.getTerm() == reqTurn) {
            turnResult.setTerm(1);
        } else if (lastTurn.getTerm() < reqTurn) {
            turnResult.setTerm(lastTurn.getTerm() + 1);
        } else {
            throw new Error('전투 태세에 올바른 턴이 아님');
        }

        const term = turnResult.getTerm();
        const logger = general.getLogger();

        if (term < 3) {
            logger.pushGeneralActionLog(`병사들을 열심히 훈련중... (${term}/3) <1>${date}</>`);
            this.setResultTurn(turnResult);
            await general.applyDB(db);
            return true;
        }

        logger.pushGeneralActionLog(`전투태세 완료! (${term}/3) <1>${date}</>`);

        general.increaseVarWithLimit('train', 0, GameConst.maxTrainByCommand - 5);
        general.increaseVarWithLimit('atmos', 0, GameConst.maxAtmosByCommand - 5);

        const exp = 100 * 3;
        const ded = 70 * 3;

        general.addExperience(exp);
        general.addDedication(ded);

        const crew = general.getVar('crew');
        const crewType = general.getCrewTypeObj(); 
        if(crewType){
             general.addDex(crewType, crew / 100 * 3, false);
        }

        general.increaseVar('leadership_exp', 3);
        
        this.setResultTurn(turnResult);
        await general.checkStatChange();
        
        // Event handling
        await StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, BattleStanceCommand.name, this.env, this.arg ?? []);
        
        // Lottery
        await tryUniqueItemLottery(genGenericUniqueRNGFromGeneral(general, BattleStanceCommand.actionName), general);

        await general.applyDB(db);

        return true;
    }
}