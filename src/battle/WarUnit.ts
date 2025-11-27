/**
 * WarUnit - 전투 유닛 추상 클래스
 * PHP sammo\WarUnit 직접 변환
 */

import { RandUtil } from '../utils/RandUtil';
import { GameUnitConst, GameUnitDetail } from '../const/GameUnitConst';
import { GameConst } from '../constants/GameConst';
import { Util } from '../utils/Util';
import { getDexBonus } from '../utils/dex-calculator';

export abstract class WarUnit {
  protected general: any;
  protected rawNation: any;
  
  protected logger: any;
  protected crewType: GameUnitDetail | null = null;
  
  protected killedCurr: number = 0;
  protected killed: number = 0;
  protected deadCurr: number = 0;
  protected dead: number = 0;
  
  protected isAttacker: boolean = false;
  
  protected currPhase: number = 0;
  protected prePhase: number = 0;
  protected bonusPhase: number = 0;
  
  protected atmosBonus: number = 0;
  protected trainBonus: number = 0;
  
  protected oppose: WarUnit | null = null;
  protected warPower: number = 0;
  protected warPowerMultiply: number = 1.0;
  
  protected activatedSkill: Record<string, boolean> = {};
  protected logActivatedSkill: Record<string, number> = {};
  protected isFinished: boolean = false;
  
  constructor(public readonly rng: RandUtil, general: any) {
    this.general = general;
  }
  
  // Dirty wrapper methods
  getRaw(): any {
    return this.general.getRaw?.() || this.general.data || this.general;
  }
  
  getVar(key: string): any {
    return this.general.getVar?.(key) ?? this.general.data?.[key] ?? this.general[key];
  }
  
  touchVar(key: string): boolean {
    return this.general.touchVar?.(key) ?? false;
  }
  
  setVar(key: string, value: any): void {
    if (typeof this.general.setVar === 'function') {
      this.general.setVar(key, value);
    } else if (this.general.data) {
      this.general.data[key] = value;
    } else {
      this.general[key] = value;
    }
  }
  
  updateVar(key: string, value: any): void {
    if (typeof this.general.updateVar === 'function') {
      this.general.updateVar(key, value);
    } else {
      this.setVar(key, value);
    }
  }
  
  updateVarWithLimit(key: string, value: any, min?: number, max?: number): void {
    if (typeof this.general.updateVarWithLimit === 'function') {
      this.general.updateVarWithLimit(key, value, min, max);
    } else {
      let newVal = value;
      if (min !== undefined && newVal < min) newVal = min;
      if (max !== undefined && newVal > max) newVal = max;
      this.setVar(key, newVal);
    }
  }
  
  increaseVar(key: string, value: number): void {
    if (typeof this.general.increaseVar === 'function') {
      this.general.increaseVar(key, value);
    } else {
      const current = this.getVar(key) || 0;
      this.setVar(key, current + value);
    }
  }
  
  increaseVarWithLimit(key: string, value: number, min?: number, max?: number): void {
    if (typeof this.general.increaseVarWithLimit === 'function') {
      this.general.increaseVarWithLimit(key, value, min, max);
    } else {
      const current = this.getVar(key) || 0;
      let newVal = current + value;
      if (min !== undefined && newVal < min) newVal = min;
      if (max !== undefined && newVal > max) newVal = max;
      this.setVar(key, newVal);
    }
  }
  
  multiplyVar(key: string, value: number): void {
    if (typeof this.general.multiplyVar === 'function') {
      this.general.multiplyVar(key, value);
    } else {
      const current = this.getVar(key) || 0;
      this.setVar(key, current * value);
    }
  }
  
  multiplyVarWithLimit(key: string, value: number, min?: number, max?: number): void {
    if (typeof this.general.multiplyVarWithLimit === 'function') {
      this.general.multiplyVarWithLimit(key, value, min, max);
    } else {
      const current = this.getVar(key) || 0;
      let newVal = current * value;
      if (min !== undefined && newVal < min) newVal = min;
      if (max !== undefined && newVal > max) newVal = max;
      this.setVar(key, newVal);
    }
  }
  
  getUpdatedValues(): any {
    return this.general.getUpdatedValues?.() || {};
  }
  
  flushUpdateValues(): void {
    this.general.flushUpdateValues?.();
  }
  
  protected clearActivatedSkill(): void {
    for (const [skillName, state] of Object.entries(this.activatedSkill)) {
      if (!state) continue;
      
      if (!this.logActivatedSkill[skillName]) {
        this.logActivatedSkill[skillName] = 1;
      } else {
        this.logActivatedSkill[skillName] += 1;
      }
    }
    this.activatedSkill = {};
  }
  
  getActivatedSkillLog(): Record<string, number> {
    return this.logActivatedSkill;
  }
  
  getRawNation(): any {
    return this.rawNation;
  }
  
  getNationVar(key: string): any {
    return this.rawNation?.[key];
  }
  
  getPhase(): number {
    return this.currPhase;
  }
  
  getRealPhase(): number {
    return this.prePhase + this.currPhase;
  }
  
  getName(): string {
    return 'EMPTY';
  }
  
  isAttackerUnit(): boolean {
    return this.isAttacker;
  }
  
  getCrewType(): GameUnitDetail | null {
    return this.crewType;
  }
  
  getCrewTypeName(): string {
    return this.crewType?.name || '병종';
  }
  
  getCrewTypeShortName(): string {
    return this.crewType?.name || '병종';
  }
  
  getLogger(): any {
    const logger = this.general.getLogger?.();
    if (!logger) {
      throw new Error('Logger not available');
    }
    return logger;
  }
  
  getKilled(): number {
    return this.killed;
  }
  
  getDead(): number {
    return this.dead;
  }
  
  getKilledCurrentBattle(): number {
    return this.killedCurr;
  }
  
  getDeadCurrentBattle(): number {
    return this.deadCurr;
  }
  
  getGeneral(): any {
    return this.general;
  }
  
  getMaxPhase(): number {
    const phase = this.crewType?.speed || 3;
    return phase + this.bonusPhase;
  }
  
  setPrePhase(phase: number): void {
    this.prePhase = phase;
  }
  
  addPhase(phase: number = 1): void {
    this.currPhase += phase;
  }
  
  addBonusPhase(cnt: number): void {
    this.bonusPhase += cnt;
  }
  
  setOppose(oppose: WarUnit | null): void {
    this.oppose = oppose;
    this.killedCurr = 0;
    this.deadCurr = 0;
    this.clearActivatedSkill();
  }
  
  setSiege(): void {
    // Only meaningful for WarUnitCity; override when needed
  }
  
  getOppose(): WarUnit | null {
    return this.oppose;
  }
  
  getWarPower(): number {
    return this.warPower * this.warPowerMultiply;
  }
  
  getRawWarPower(): number {
    return this.warPower;
  }
  
  getWarPowerMultiply(): number {
    return this.warPowerMultiply;
  }
  
  setWarPowerMultiply(multiply: number = 1.0): void {
    this.warPowerMultiply = multiply;
  }
  
  multiplyWarPowerMultiply(multiply: number): void {
    this.warPowerMultiply *= multiply;
  }
  
  getComputedAttack(): number {
    if (!this.crewType) return 100;

    // PHP: GameUnitDetail::getComputedAttack($general, $tech)
    const tech = this.getNationVar('tech') || 0;
    const techLevel = Math.min(
      Math.max(0, Math.floor(tech / 1000)),
      GameConst.maxTechLevel ?? 10,
    );
    const techAbil = techLevel * 25; // PHP getTechAbil($tech)

    const general: any = this.general;
    const strength: number =
      (typeof general.getStrength === 'function'
        ? general.getStrength(true, true, true)
        : general.getVar?.('strength') ?? general.data?.strength ?? general.strength ?? GameConst.defaultStat);
    const intel: number =
      (typeof general.getIntel === 'function'
        ? general.getIntel(true, true, true)
        : general.getVar?.('intel') ?? general.data?.intel ?? general.intel ?? GameConst.defaultStat);
    const leadership: number =
      (typeof general.getLeadership === 'function'
        ? general.getLeadership(true, true, true)
        : general.getVar?.('leadership') ?? general.data?.leadership ?? general.leadership ?? GameConst.defaultStat);

    let ratio: number;
    // armType 값은 GameUnitConst / PHP GameUnitConstBase 와 동일한 인덱스를 사용한다.
    if (this.crewType.armType === 4) {
      // WIZARD
      ratio = intel * 2 - 40;
    } else if (this.crewType.armType === 5) {
      // SIEGE
      ratio = leadership * 2 - 40;
    } else if (this.crewType.armType === 6) {
      // MISC
      ratio = ((intel + leadership + strength) * 2) / 3 - 40;
    } else {
      // 기본: 무력 기반
      ratio = strength * 2 - 40;
    }

    if (ratio < 10) {
      ratio = 10;
    }
    if (ratio > 100) {
      ratio = 50 + ratio / 2;
    }

    const baseAttack = (this.crewType.attack ?? 100) + techAbil;
    // PHP와 동일하게 float 반환 (반올림 없음)
    return baseAttack * ratio / 100;
  }
  
  getComputedDefence(): number {
    if (!this.crewType) return 100;

    // PHP: GameUnitDetail::getComputedDefence($general, $tech)
    const tech = this.getNationVar('tech') || 0;
    const techLevel = Math.min(
      Math.max(0, Math.floor(tech / 1000)),
      GameConst.maxTechLevel ?? 10,
    );
    const techAbil = techLevel * 25;

    const baseDefence = (this.crewType.defence ?? 100) + techAbil;

    const general: any = this.general;
    const crew: number =
      general.getVar?.('crew') ?? general.data?.crew ?? general.crew ?? 0;

    // PHP: $crew = ($general->getVar('crew') / (7000 / 30)) + 70;
    const crewCoef = crew / (7000 / 30) + 70;
    // PHP와 동일하게 float 반환 (반올림 없음)
    return baseDefence * crewCoef / 100;
  }
  
  computeWarPower(): [number, number] {
    const oppose = this.getOppose();
    if (!oppose) return [0, 1.0];
    
    const general = this.general;
    const opposeGeneral = oppose.getGeneral();
    
    const myAtt = this.getComputedAttack();
    const opDef = oppose.getComputedDefence();
    
    // 감소할 병사
    let warPower = (GameConst.armperphase || 100) + myAtt - opDef;
    let opposeWarPowerMultiply = 1.0;
    
    if (warPower < 100) {
      // 최소 전투력 50 보장
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = this.rng.nextRangeInt(warPower, 100);
    }
    
    warPower *= this.getComputedAtmos();
    warPower /= oppose.getComputedTrain();
    
    const genDexAtt = this.getDex(this.getCrewType()!);
    const oppDexDef = oppose.getDex(this.getCrewType()!);
    
    warPower *= this.getDexLog(genDexAtt, oppDexDef);
    
    // 병종 상성
    if (this.crewType && oppose.crewType) {
      warPower *= this.getAttackCoef(this.crewType, oppose.crewType);
      opposeWarPowerMultiply *= this.getDefenceCoef(this.crewType, oppose.crewType);
    }
    
    this.warPower = warPower;
    oppose.setWarPowerMultiply(opposeWarPowerMultiply);
    
    return [warPower, opposeWarPowerMultiply];
  }
  
  // 숙련도 로그 계산 (PHP: getDexLog)
  protected getDexLog(myDex: number, oppDex: number): number {
    // PHP: $ratio = (getDexLevel($dex1) - getDexLevel($dex2)) / 55 + 1;
    // 구현은 공용 유틸 getDexBonus()에 위임한다.
    return getDexBonus(myDex, oppDex);
  }
  
  // 병종 공격 상성 계수
  // PHP GameUnitConstBase.php의 attackCoef 배열 기준
  protected getAttackCoef(attacker: GameUnitDetail, defender: GameUnitDetail): number {
    // PHP에서는 GameUnitDetail.attackCoef[opposeCrewTypeID] 또는 attackCoef[armType]를 사용
    // TS에서는 armType 기반 기본 상성표 사용 (PHP 삼국지 데이터 기준)
    
    // 먼저 attacker가 attackCoef 배열을 가지고 있으면 사용
    if ((attacker as any).attackCoef) {
      const coefMap = (attacker as any).attackCoef as Record<number, number>;
      // 1. 상대 병종 ID로 직접 매칭
      if (coefMap[defender.id] !== undefined) {
        return coefMap[defender.id];
      }
      // 2. armType으로 매칭
      if (coefMap[defender.armType] !== undefined) {
        return coefMap[defender.armType];
      }
    }
    
    // 기본 상성표 (PHP GameUnitConstBase.php 기준)
    // armType: 1=보병, 2=궁병, 3=기병, 4=귀병, 5=차병, 0=성벽
    const attackCoefTable: Record<number, Record<number, number>> = {
      // 보병: 궁병에 강함, 기병에 약함
      1: { 2: 1.2, 3: 0.8, 5: 1.2 },
      // 궁병: 기병에 강함, 보병에 약함  
      2: { 1: 0.8, 3: 1.2, 5: 1.2 },
      // 기병: 보병에 강함, 궁병에 약함
      3: { 1: 1.2, 2: 0.8, 5: 1.2 },
      // 귀병: 차병에만 강함
      4: { 5: 1.2 },
      // 차병: 특수 상성 (정란, 충차, 벽력거 등 개별 정의)
      5: { 0: 1.8 }, // 성벽에 강함
    };
    
    return attackCoefTable[attacker.armType]?.[defender.armType] ?? 1.0;
  }
  
  // 병종 방어 상성 계수
  // PHP GameUnitConstBase.php의 defenceCoef 배열 기준
  protected getDefenceCoef(attacker: GameUnitDetail, defender: GameUnitDetail): number {
    // PHP에서는 GameUnitDetail.defenceCoef[opposeCrewTypeID] 또는 defenceCoef[armType]를 사용
    
    // 먼저 attacker가 defenceCoef 배열을 가지고 있으면 사용
    if ((attacker as any).defenceCoef) {
      const coefMap = (attacker as any).defenceCoef as Record<number, number>;
      // 1. 상대 병종 ID로 직접 매칭
      if (coefMap[defender.id] !== undefined) {
        return coefMap[defender.id];
      }
      // 2. armType으로 매칭
      if (coefMap[defender.armType] !== undefined) {
        return coefMap[defender.armType];
      }
    }
    
    // 기본 방어 상성표 (PHP GameUnitConstBase.php 기준)
    // armType: 1=보병, 2=궁병, 3=기병, 4=귀병, 5=차병, 0=성벽
    const defenceCoefTable: Record<number, Record<number, number>> = {
      // 보병: 궁병에 약함, 기병에 강함
      1: { 2: 0.8, 3: 1.2, 5: 0.8 },
      // 궁병: 기병에 약함, 보병에 강함
      2: { 1: 1.2, 3: 0.8, 5: 0.8 },
      // 기병: 보병에 약함, 궁병에 강함
      3: { 1: 0.8, 2: 1.2, 5: 0.8 },
      // 귀병: 차병에만 약함
      4: { 5: 0.8 },
      // 차병: 다른 병종에 대해 방어 페널티
      5: { 1: 1.2, 2: 1.2, 3: 1.2, 4: 1.2 },
    };
    
    return defenceCoefTable[attacker.armType]?.[defender.armType] ?? 1.0;
  }
  
  addTrain(train: number): void {
    // Override in subclasses
  }
  
  addAtmos(atmos: number): void {
    // Override in subclasses
  }
  
  addTrainBonus(trainBonus: number): void {
    this.trainBonus += trainBonus;
  }
  
  addAtmosBonus(atmosBonus: number): void {
    this.atmosBonus += atmosBonus;
  }
  
  getComputedTrain(): number {
    return GameConst.maxTrainByCommand || 100;
  }
  
  getComputedAtmos(): number {
    return GameConst.maxAtmosByCommand || 100;
  }
  
  getComputedCriticalRatio(): number {
    if (!this.crewType) return 0.05;
    // PHP: $this->getCrewType()->getCriticalRatio($this->general)
    return 0.05; // 기본 5%
  }
  
  getComputedAvoidRatio(): number {
    if (!this.crewType) return 0.05;
    return (this.crewType.avoid || 5) / 100;
  }
  
  addWin(): void {
    // Override in subclasses
  }
  
  addLose(): void {
    // Override in subclasses
  }
  
  abstract getDex(crewType: GameUnitDetail): number;
  
  abstract finishBattle(): void;
  
  beginPhase(): void {
    this.clearActivatedSkill();
    this.computeWarPower();
  }
  
  hasActivatedSkill(skillName: string): boolean {
    return this.activatedSkill[skillName] || false;
  }
  
  hasActivatedSkillOnLog(skillName: string): number {
    return (this.logActivatedSkill[skillName] || 0) + (this.hasActivatedSkill(skillName) ? 1 : 0);
  }
  
  activateSkill(...skillNames: string[]): void {
    for (const skillName of skillNames) {
      this.activatedSkill[skillName] = true;
    }
  }
  
  deactivateSkill(...skillNames: string[]): void {
    for (const skillName of skillNames) {
      this.activatedSkill[skillName] = false;
    }
  }
  
  abstract getHP(): number;
  
  abstract decreaseHP(damage: number): number;
  
  abstract increaseKilled(damage: number): number;
  
  calcDamage(): number {
    let warPower = this.getWarPower();
    warPower *= this.rng.nextRange(0.9, 1.1);
    return Util.round(warPower);
  }
  
  tryWound(): boolean {
    return false;
  }
  
  continueWar(noRice: { value: boolean }): boolean {
    // 전투가 가능하면 true
    noRice.value = false;
    return false;
  }
  
  logBattleResult(): void {
    const logger = this.getLogger();
    if (logger && typeof logger.pushBattleResultTemplate === 'function') {
      logger.pushBattleResultTemplate(this, this.getOppose());
    }
  }
  
  criticalDamage(): number {
    const range: [number, number] = [1.3, 2.0];
    
    // 전특, 병종에 따라 필살 데미지가 달라질 수 있음
    if (typeof this.general.onCalcStat === 'function') {
      // TODO: range = general.onCalcStat(general, 'criticalDamageRange', range)
    }
    
    return this.rng.nextRange(range[0], range[1]);
  }
  
  abstract applyDB(db: any): Promise<boolean>;
}
