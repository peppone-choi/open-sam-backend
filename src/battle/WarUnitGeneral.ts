/**
 * WarUnitGeneral - 장수 전투 유닛
 * PHP sammo\WarUnitGeneral 직접 변환
 */

import { WarUnit } from './WarUnit';
import { RandUtil } from '../utils/RandUtil';
import { GameUnitConst, GameUnitDetail } from '../const/GameUnitConst';
import { GameConst } from '../constants/GameConst';
import { Util } from '../utils/Util';
import { WarUnitCity } from './WarUnitCity';

export class WarUnitGeneral extends WarUnit {
  protected raw: any;
  protected killedPerson: number = 0;
  protected deadPerson: number = 0;
  
  constructor(
    rng: RandUtil,
    general: any,
    rawNation: any,
    isAttacker: boolean
  ) {
    super(rng, general);
    
    this.raw = general.getRaw?.() || general.data || general;
    this.rawNation = rawNation; // read-only
    this.isAttacker = isAttacker;
    
    this.logger = general.getLogger?.();
    
    // 병종 정보 설정
    const crewTypeId = general.data?.crewtype || general.crewtype || 0;
    this.crewType = GameUnitConst.byID(crewTypeId) || GameUnitConst.byID(0);
    
    const cityLevel = this.getCityVar('level') || 5;
    
    if (isAttacker) {
      // 공격자 보정
      if (cityLevel === 2) {
        this.atmosBonus += 5;
      }
      if (rawNation.capital === this.getCityVar('city')) {
        this.atmosBonus += 5;
      }
    } else {
      // 수비자 보정
      if (cityLevel === 1) {
        this.trainBonus += 5;
      } else if (cityLevel === 3) {
        this.trainBonus += 5;
      }
    }
  }
  
  getName(): string {
    return this.general.getName?.() || this.general.name || this.general.data?.name || '무명';
  }
  
  getCityVar(key: string): any {
    const rawCity = this.general.getRawCity?.() || this.general._cached_city || {};
    return rawCity[key];
  }
  
  setOppose(oppose: WarUnit | null): void {
    super.setOppose(oppose);
    
    const general = this.general;
    
    // 전투 횟수 증가
    if (typeof general.increaseRankVar === 'function') {
      general.increaseRankVar('warnum', 1);
    }
    
    // 최근 전투 시간 기록
    if (this.isAttacker) {
      const semiTurn = general.getTurnTime?.() || '';
      const phase = this.getRealPhase();
      const turnStr = semiTurn.substring(0, semiTurn.length - 2) + String(Util.valueFit(phase, 0, 99)).padStart(2, '0');
      general.setVar?.('recent_war', turnStr);
    } else if (oppose !== null) {
      const opposeTurn = oppose.getGeneral().getTurnTime?.() || '';
      const phase = this.getRealPhase();
      const turnStr = opposeTurn.substring(0, opposeTurn.length - 2) + String(Util.valueFit(phase, 0, 99)).padStart(2, '0');
      general.setVar?.('recent_war', turnStr);
    }
  }
  
  getMaxPhase(): number {
    let phase = this.crewType?.speed || 3;
    
    // onCalcStat 보정
    if (typeof this.general.onCalcStat === 'function') {
      phase = this.general.onCalcStat(this.general, 'initWarPhase', phase, { isAttacker: this.isAttacker });
    }
    
    return phase + this.bonusPhase;
  }
  
  addTrain(train: number): void {
    this.general.increaseVarWithLimit?.('train', train, 0, GameConst.maxTrainByWar || 150);
  }
  
  addAtmos(atmos: number): void {
    this.general.increaseVarWithLimit?.('atmos', atmos, 0, GameConst.maxAtmosByWar || 150);
  }
  
  getDex(crewType: GameUnitDetail): number {
    const armType = crewType.armType;
    let dex = this.general.data?.[`dex${armType}`] || 0;
    
    // onCalcStat 보정
    if (typeof this.general.onCalcStat === 'function') {
      dex = this.general.onCalcStat(this.general, `dex${armType}`, dex, {
        isAttacker: this.isAttacker,
        opposeType: this.oppose?.getCrewType()
      });
    }
    
    // onCalcOpposeStat 보정
    if (this.oppose && typeof this.oppose.getGeneral().onCalcOpposeStat === 'function') {
      dex = this.oppose.getGeneral().onCalcOpposeStat(this.general, `dex${armType}`, dex, {
        isAttacker: this.isAttacker,
        opposeType: this.oppose.getCrewType()
      });
    }
    
    return dex;
  }
  
  getComputedTrain(): number {
    let train = this.general.data?.train || 70;
    
    // onCalcStat 보정
    if (typeof this.general.onCalcStat === 'function') {
      train = this.general.onCalcStat(this.general, 'bonusTrain', train, { isAttacker: this.isAttacker });
    }
    
    // onCalcOpposeStat 보정 (상대가 나의 훈련도를 감소시킬 수 있음)
    if (this.oppose && typeof this.oppose.getGeneral().onCalcOpposeStat === 'function') {
      train = this.oppose.getGeneral().onCalcOpposeStat(this.general, 'bonusTrain', train, { isAttacker: this.isAttacker });
    }
    
    train += this.trainBonus;
    
    return train;
  }
  
  getComputedAtmos(): number {
    let atmos = this.general.data?.atmos || 70;
    
    // onCalcStat 보정
    if (typeof this.general.onCalcStat === 'function') {
      atmos = this.general.onCalcStat(this.general, 'bonusAtmos', atmos, { isAttacker: this.isAttacker });
    }
    
    // onCalcOpposeStat 보정
    if (this.oppose && typeof this.oppose.getGeneral().onCalcOpposeStat === 'function') {
      atmos = this.oppose.getGeneral().onCalcOpposeStat(this.general, 'bonusAtmos', atmos, { isAttacker: this.isAttacker });
    }
    
    atmos += this.atmosBonus;
    
    return atmos;
  }
  
  getComputedCriticalRatio(): number {
    const general = this.general;
    let criticalRatio = this.crewType?.critical || 0.05;
    
    // onCalcStat 보정
    if (typeof general.onCalcStat === 'function') {
      criticalRatio = general.onCalcStat(general, 'warCriticalRatio', criticalRatio, { isAttacker: this.isAttacker });
    }
    
    // onCalcOpposeStat 보정
    if (this.oppose && typeof this.oppose.getGeneral().onCalcOpposeStat === 'function') {
      criticalRatio = this.oppose.getGeneral().onCalcOpposeStat(general, 'warCriticalRatio', criticalRatio, { isAttacker: this.isAttacker });
    }
    
    return criticalRatio;
  }
  
  getComputedAvoidRatio(): number {
    const general = this.general;
    
    let avoidRatio = (this.crewType?.avoid || 5) / 100;
    avoidRatio *= this.getComputedTrain() / 100;
    
    // onCalcStat 보정
    if (typeof general.onCalcStat === 'function') {
      avoidRatio = general.onCalcStat(general, 'warAvoidRatio', avoidRatio, { isAttacker: this.isAttacker });
    }
    
    // onCalcOpposeStat 보정
    if (this.oppose && typeof this.oppose.getGeneral().onCalcOpposeStat === 'function') {
      avoidRatio = this.oppose.getGeneral().onCalcOpposeStat(general, 'warAvoidRatio', avoidRatio, { isAttacker: this.isAttacker });
    }
    
    // 보병 상대로 회피율 감소
    if (this.oppose?.getCrewType()?.armType === 1) { // FOOTMAN
      avoidRatio *= 0.75;
    }
    
    return avoidRatio;
  }
  
  addWin(): void {
    const general = this.general;
    
    // 승리 횟수 증가
    if (typeof general.increaseRankVar === 'function') {
      general.increaseRankVar('killnum', 1);
    }
    
    // 도시 점령 카운트
    const oppose = this.getOppose();
    if (oppose instanceof WarUnitCity) {
      if (typeof general.increaseRankVar === 'function') {
        general.increaseRankVar('occupied', 1);
      }
    }
    
    // 사기 증가
    if (this.isAttacker) {
      general.multiplyVarWithLimit?.('atmos', 1.1, undefined, GameConst.maxAtmosByWar || 150);
    } else {
      general.multiplyVarWithLimit?.('atmos', 1.05, undefined, GameConst.maxAtmosByWar || 150);
    }
    
    this.addStatExp(1);
  }
  
  addStatExp(value: number = 1): void {
    const general = this.general;
    const armType = this.crewType?.armType || 1;
    
    if (armType === 4) { // WIZARD (귀병)
      general.increaseVar?.('intel_exp', value);
    } else if (armType === 5) { // SIEGE (차병)
      general.increaseVar?.('leadership_exp', value);
    } else {
      general.increaseVar?.('strength_exp', value);
    }
  }
  
  addLevelExp(value: number): void {
    const general = this.general;
    if (!this.isAttacker) {
      value *= 0.8;
    }
    general.addExperience?.(value);
  }
  
  addDedication(value: number): void {
    const general = this.general;
    general.addDedication?.(value);
  }
  
  addLose(): void {
    const general = this.general;
    
    // 패배 횟수 증가
    if (typeof general.increaseRankVar === 'function') {
      general.increaseRankVar('deathnum', 1);
    }
    
    this.addStatExp(1);
  }
  
  computeWarPower(): [number, number] {
    let [warPower, opposeWarPowerMultiply] = super.computeWarPower();
    
    const general = this.general;
    const expLevel = general.data?.explevel || 0;
    
    // 레벨 보정
    if (this.getOppose() instanceof WarUnitCity) {
      warPower *= 1 + expLevel / 600;
    } else {
      warPower /= Math.max(0.01, 1 - expLevel / 300);
      opposeWarPowerMultiply *= Math.max(0.01, 1 - expLevel / 300);
    }
    
    // 특수 전력 배율 (스킬 등)
    if (typeof general.getWarPowerMultiplier === 'function') {
      const [specialMyMult, specialOpposeMult] = general.getWarPowerMultiplier(this);
      warPower *= specialMyMult;
      opposeWarPowerMultiply *= specialOpposeMult;
    }
    
    this.warPower = warPower;
    this.oppose?.setWarPowerMultiply(opposeWarPowerMultiply);
    
    return [warPower, opposeWarPowerMultiply];
  }
  
  getHP(): number {
    return this.general.data?.crew || 0;
  }
  
  addDex(crewType: GameUnitDetail, exp: number): void {
    if (typeof this.general.addDex === 'function') {
      this.general.addDex(crewType, exp, false);
    }
  }
  
  decreaseHP(damage: number): number {
    const general = this.general;
    const currentCrew = general.data?.crew || 0;
    damage = Math.min(damage, currentCrew);
    
    this.dead += damage;
    this.deadCurr += damage;
    general.increaseVar?.('crew', -damage);
    
    // 숙련도 증가 (피해를 입으면서 상대 병종에 대한 숙련도 증가)
    let addDex = damage;
    if (!this.isAttacker) {
      addDex *= 0.1;
    }
    if (this.oppose) {
      this.addDex(this.oppose.getCrewType()!, addDex);
    }
    
    // 대인전 사망자 카운트
    if (this.oppose instanceof WarUnitGeneral) {
      this.deadPerson += damage;
    }
    
    return general.data?.crew || 0;
  }
  
  calcRiceConsumption(damage: number): number {
    let rice = damage / 100;
    
    if (!this.isAttacker) {
      rice *= 0.8;
    }
    
    if (this.oppose instanceof WarUnitCity) {
      rice *= 0.8;
    }
    
    rice *= this.crewType?.rice || 1;
    
    // 기술 비용
    const tech = this.getNationVar('tech') || 0;
    const techLevel = Math.floor(tech / 1000);
    const techCost = 1 + techLevel * 0.15;
    rice *= techCost;
    
    // onCalcStat 보정
    if (typeof this.general.onCalcStat === 'function') {
      rice = this.general.onCalcStat(this.general, 'killRice', rice);
    }
    
    return rice;
  }
  
  increaseKilled(damage: number): number {
    const general = this.general;
    
    // 경험치 증가
    this.addLevelExp(damage / 50);
    
    // 군량 소모
    const rice = this.calcRiceConsumption(damage);
    general.increaseVarWithLimit?.('rice', -rice, 0);
    
    // 숙련도 증가 (적을 죽이면서 자신의 병종 숙련도 증가)
    let addDex = damage;
    if (!this.isAttacker) {
      addDex *= 0.8;
    }
    this.addDex(this.getCrewType()!, addDex);
    
    this.killed += damage;
    this.killedCurr += damage;
    
    // 대인전 살상 카운트
    if (this.oppose instanceof WarUnitGeneral) {
      this.killedPerson += damage;
    }
    
    return this.killed;
  }
  
  tryWound(): boolean {
    const general = this.general;
    
    // 부상 무효 스킬
    if (this.hasActivatedSkillOnLog('부상무효')) {
      return false;
    }
    if (this.hasActivatedSkillOnLog('퇴각부상무효')) {
      return false;
    }
    
    // 5% 확률로 부상
    if (!this.rng.nextBool(0.05)) {
      return false;
    }
    
    this.activateSkill('부상');
    
    // 부상도 증가 (10~80)
    const injuryIncrease = this.rng.nextRangeInt(10, 80);
    general.increaseVarWithLimit?.('injury', injuryIncrease, undefined, 80);
    
    this.getLogger()?.pushGeneralActionLog?.("전투중 <R>부상</>당했다!", 1); // ActionLogger::PLAIN = 1
    
    return true;
  }
  
  continueWar(noRice: { value: boolean }): boolean {
    const general = this.general;
    const crew = this.getHP();
    const rice = general.data?.rice || 0;
    
    // 병력이 0이면 전투 불가
    if (crew <= 0) {
      noRice.value = false;
      return false;
    }
    
    // 군량이 부족하면 전투 불가
    if (rice <= crew / 100) {
      noRice.value = true;
      return false;
    }
    
    return true;
  }
  
  checkStatChange(): boolean {
    if (typeof this.general.checkStatChange === 'function') {
      return this.general.checkStatChange();
    }
    return false;
  }
  
  finishBattle(): void {
    if (this.isFinished) {
      return;
    }
    
    this.clearActivatedSkill();
    this.isFinished = true;
    
    const general = this.general;
    
    // 랭킹 변수 업데이트
    if (typeof general.increaseRankVar === 'function') {
      general.increaseRankVar('killcrew', this.killed);
      general.increaseRankVar('deathcrew', this.dead);
      
      if (this.killedPerson) {
        general.increaseRankVar('killcrew_person', this.killedPerson);
      }
      if (this.deadPerson) {
        general.increaseRankVar('deathcrew_person', this.deadPerson);
      }
    }
    
    // 값 반올림
    general.updateVar?.('rice', Util.round(general.data?.rice || 0));
    general.updateVar?.('experience', Util.round(general.data?.experience || 0));
    general.updateVar?.('dedication', Util.round(general.data?.dedication || 0));
    
    this.checkStatChange();
  }
  
  async applyDB(db: any): Promise<boolean> {
    const affected = await this.general.applyDB?.(db);
    await this.getLogger()?.flush?.();
    return affected || false;
  }
}
