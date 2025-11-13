/**
 * Battle Calculator - 전투 계산 시스템
 * 
 * PHP 원본(process_war.php)의 복잡한 전투 로직을 개선하여
 * 더 간결하고 균형잡힌 전투 시스템 구현
 */

export enum UnitType {
  FOOTMAN = 'FOOTMAN',     // 보병 (도검병)
  SPEARMAN = 'SPEARMAN',   // 창병 (기병 카운터)
  HALBERD = 'HALBERD',     // 극병 (창병 카운터, 최고 방어력)
  CAVALRY = 'CAVALRY',     // 기병 (극병 카운터)
  ARCHER = 'ARCHER',       // 궁병 (원거리)
  WIZARD = 'WIZARD',       // 귀병 (계략)
  SIEGE = 'SIEGE'          // 차병 (공성)
}

export enum TerrainType {
  PLAINS = 'PLAINS',       // 평지
  FOREST = 'FOREST',       // 숲
  MOUNTAIN = 'MOUNTAIN',   // 산악
  WATER = 'WATER',         // 수상
  FORTRESS = 'FORTRESS'    // 요새
}

export interface BattleUnit {
  name: string;
  troops: number;             // 병력
  leadership: number;         // 통솔 (0-150)
  strength: number;           // 무력 (0-150)
  intelligence: number;       // 지력 (0-150)
  unitType: UnitType;
  morale: number;             // 사기 (0-100)
  training: number;           // 훈련도 (0-100)
  techLevel: number;          // 기술력 (0-100)
  specialSkills?: string[];   // 특기 목록
}

export interface BattleContext {
  attacker: BattleUnit;
  defender: BattleUnit;
  terrain: TerrainType;
  isDefenderCity: boolean;    // 도시 공성전 여부
  cityWall?: number;          // 성벽 내구도 (0-100)
}

export interface PhaseResult {
  attackerDamage: number;     // 공격자가 입은 피해
  defenderDamage: number;     // 수비자가 입은 피해
  attackerCritical: boolean;
  defenderCritical: boolean;
  attackerEvaded: boolean;
  defenderEvaded: boolean;
  log: string;
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw';
  attackerSurvivors: number;
  defenderSurvivors: number;
  attackerCasualties: number;
  defenderCasualties: number;
  phases: PhaseResult[];
  battleLog: string[];
  duration: number;           // 전투 페이즈 수
}

/**
 * 병종 상성 테이블 (삼국지 11 완전 재현)
 * 
 * 핵심 가위바위보:
 * - 창병(SPEARMAN) → 기병(CAVALRY): 2.5배 압도
 * - 극병(HALBERD) → 창병(SPEARMAN): 1.7배 압도
 * - 기병(CAVALRY) → 극병(HALBERD): 1.6배 우세
 * 
 * 행: 공격자, 열: 수비자
 */
const UNIT_ADVANTAGE_TABLE: Record<UnitType, Record<UnitType, number>> = {
  // 보병 (일반 도검병) - 범용
  [UnitType.FOOTMAN]: {
    [UnitType.FOOTMAN]: 1.0,
    [UnitType.SPEARMAN]: 1.1,   // 창병에 약간 유리
    [UnitType.HALBERD]: 0.9,    // 극병과 호각
    [UnitType.CAVALRY]: 0.8,    // 기병에 불리
    [UnitType.ARCHER]: 1.1,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.2
  },
  // 창병 - 기병 카운터
  [UnitType.SPEARMAN]: {
    [UnitType.FOOTMAN]: 0.9,    // 보병에 약간 불리
    [UnitType.SPEARMAN]: 1.0,
    [UnitType.HALBERD]: 0.6,    // 극병에 매우 약함
    [UnitType.CAVALRY]: 2.5,    // 기병에 압도적 (삼국지 11)
    [UnitType.ARCHER]: 0.9,
    [UnitType.WIZARD]: 0.9,
    [UnitType.SIEGE]: 1.0
  },
  // 극병 - 창병 카운터, 최고 방어력
  [UnitType.HALBERD]: {
    [UnitType.FOOTMAN]: 0.9,    // 보병과 호각
    [UnitType.SPEARMAN]: 1.7,   // 창병에 압도적
    [UnitType.HALBERD]: 1.0,
    [UnitType.CAVALRY]: 0.7,    // 기병에 불리
    [UnitType.ARCHER]: 1.1,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.2
  },
  // 기병 - 극병 카운터, 고기동
  [UnitType.CAVALRY]: {
    [UnitType.FOOTMAN]: 1.2,    // 보병에 유리
    [UnitType.SPEARMAN]: 0.4,   // 창병에 자살 공격
    [UnitType.HALBERD]: 1.6,    // 극병에 우세
    [UnitType.CAVALRY]: 1.0,
    [UnitType.ARCHER]: 1.6,     // 궁병에 압도적
    [UnitType.WIZARD]: 1.2,
    [UnitType.SIEGE]: 1.5
  },
  // 궁병 - 원거리 공격, 상성 없음
  [UnitType.ARCHER]: {
    [UnitType.FOOTMAN]: 1.0,    // 상성 없음
    [UnitType.SPEARMAN]: 1.0,   // 상성 없음
    [UnitType.HALBERD]: 1.0,    // 상성 없음
    [UnitType.CAVALRY]: 1.0,    // 상성 없음
    [UnitType.ARCHER]: 1.0,
    [UnitType.WIZARD]: 0.8,
    [UnitType.SIEGE]: 0.8
  },
  // 계략병
  [UnitType.WIZARD]: {
    [UnitType.FOOTMAN]: 1.1,
    [UnitType.SPEARMAN]: 1.1,
    [UnitType.HALBERD]: 1.0,
    [UnitType.CAVALRY]: 0.9,
    [UnitType.ARCHER]: 1.2,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.0
  },
  // 공성병
  [UnitType.SIEGE]: {
    [UnitType.FOOTMAN]: 0.7,
    [UnitType.SPEARMAN]: 0.6,
    [UnitType.HALBERD]: 0.7,
    [UnitType.CAVALRY]: 0.6,    // 기병에 약함
    [UnitType.ARCHER]: 0.9,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.0
  }
};

/**
 * 지형별 병종 보너스
 */
const TERRAIN_BONUS: Record<TerrainType, Record<UnitType, number>> = {
  [TerrainType.PLAINS]: {
    [UnitType.FOOTMAN]: 1.0,
    [UnitType.SPEARMAN]: 1.0,
    [UnitType.HALBERD]: 1.0,
    [UnitType.CAVALRY]: 1.3,    // 평지에서 기병 강함
    [UnitType.ARCHER]: 1.1,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.0
  },
  [TerrainType.FOREST]: {
    [UnitType.FOOTMAN]: 1.2,
    [UnitType.SPEARMAN]: 1.2,   // 숲에서 창병 유리
    [UnitType.HALBERD]: 1.1,
    [UnitType.CAVALRY]: 0.7,    // 기병 불리
    [UnitType.ARCHER]: 1.3,
    [UnitType.WIZARD]: 1.1,
    [UnitType.SIEGE]: 0.6
  },
  [TerrainType.MOUNTAIN]: {
    [UnitType.FOOTMAN]: 1.3,
    [UnitType.SPEARMAN]: 1.3,
    [UnitType.HALBERD]: 1.2,
    [UnitType.CAVALRY]: 0.5,    // 산악에서 기병 매우 불리
    [UnitType.ARCHER]: 1.4,
    [UnitType.WIZARD]: 1.2,
    [UnitType.SIEGE]: 0.4
  },
  [TerrainType.WATER]: {
    [UnitType.FOOTMAN]: 0.9,
    [UnitType.SPEARMAN]: 0.8,
    [UnitType.HALBERD]: 0.9,
    [UnitType.CAVALRY]: 0.6,
    [UnitType.ARCHER]: 1.0,
    [UnitType.WIZARD]: 1.3,
    [UnitType.SIEGE]: 0.5
  },
  [TerrainType.FORTRESS]: {
    [UnitType.FOOTMAN]: 0.8,
    [UnitType.SPEARMAN]: 0.9,
    [UnitType.HALBERD]: 1.0,    // 극병 방어에 유리
    [UnitType.CAVALRY]: 0.6,
    [UnitType.ARCHER]: 1.0,
    [UnitType.WIZARD]: 0.9,
    [UnitType.SIEGE]: 1.5
  }
};

/**
 * 병종별 기본 공격력/방어력 계수
 * 
 * 삼국지 11 기준:
 * - 창병: 낮은 공격, 중간 방어, 느린 속도 (방어선)
 * - 극병: 중간 공격, 최고 방어, 느린 속도 (탱커)
 * - 기병: 높은 공격, 낮은 방어, 빠른 속도 (돌격)
 */
const UNIT_BASE_STATS: Record<UnitType, { attack: number; defense: number; speed: number }> = {
  [UnitType.FOOTMAN]: { attack: 1.0, defense: 1.1, speed: 3 },
  [UnitType.SPEARMAN]: { attack: 0.8, defense: 1.0, speed: 2 },  // 낮은 공격, 방어 특화
  [UnitType.HALBERD]: { attack: 0.9, defense: 1.4, speed: 2 },   // 최고 방어력
  [UnitType.CAVALRY]: { attack: 1.4, defense: 0.7, speed: 5 },   // 높은 공격, 빠른 속도
  [UnitType.ARCHER]: { attack: 1.0, defense: 0.6, speed: 3 },    // 원거리, 약한 방어
  [UnitType.WIZARD]: { attack: 1.2, defense: 1.0, speed: 3 },
  [UnitType.SIEGE]: { attack: 1.3, defense: 1.1, speed: 2 }
};

export class BattleCalculator {
  private readonly MAX_PHASES = 10;
  private readonly BASE_DAMAGE = 100;
  private readonly CRITICAL_DAMAGE_MULTIPLIER = 1.8;
  
  /**
   * 전투 계산 메인 함수
   */
  calculateBattle(context: BattleContext): BattleResult {
    const phases: PhaseResult[] = [];
    const battleLog: string[] = [];
    
    let attackerTroops = context.attacker.troops;
    let defenderTroops = context.defender.troops;
    
    battleLog.push(`=== 전투 시작 ===`);
    battleLog.push(`공격: ${context.attacker.name} (${attackerTroops}명, ${context.attacker.unitType})`);
    battleLog.push(`수비: ${context.defender.name} (${defenderTroops}명, ${context.defender.unitType})`);
    battleLog.push(`지형: ${context.terrain}`);
    battleLog.push('');
    
    let phase = 0;
    while (phase < this.MAX_PHASES && attackerTroops > 0 && defenderTroops > 0) {
      phase++;
      
      const phaseResult = this.calculatePhase({
        ...context,
        attacker: { ...context.attacker, troops: attackerTroops },
        defender: { ...context.defender, troops: defenderTroops }
      }, phase);
      
      attackerTroops -= phaseResult.attackerDamage;
      defenderTroops -= phaseResult.defenderDamage;
      
      phases.push(phaseResult);
      battleLog.push(phaseResult.log);
      
      // 한쪽이 괴멸하면 종료
      if (attackerTroops <= 0 || defenderTroops <= 0) break;
      
      // 사기 체크 (병력이 30% 이하로 떨어지면 패주 가능)
      if (this.checkMoraleBreak(context.attacker, attackerTroops, context.attacker.troops)) {
        battleLog.push(`${context.attacker.name}의 군대가 사기가 떨어져 퇴각합니다!`);
        break;
      }
      if (this.checkMoraleBreak(context.defender, defenderTroops, context.defender.troops)) {
        battleLog.push(`${context.defender.name}의 군대가 사기가 떨어져 퇴각합니다!`);
        break;
      }
    }
    
    battleLog.push('');
    battleLog.push('=== 전투 종료 ===');
    
    const winner = this.determineWinner(attackerTroops, defenderTroops, context.isDefenderCity);
    const result: BattleResult = {
      winner,
      attackerSurvivors: Math.max(0, attackerTroops),
      defenderSurvivors: Math.max(0, defenderTroops),
      attackerCasualties: context.attacker.troops - Math.max(0, attackerTroops),
      defenderCasualties: context.defender.troops - Math.max(0, defenderTroops),
      phases,
      battleLog,
      duration: phase
    };
    
    battleLog.push(`승자: ${winner === 'attacker' ? context.attacker.name : winner === 'defender' ? context.defender.name : '무승부'}`);
    battleLog.push(`공격자 생존: ${result.attackerSurvivors}명 (손실: ${result.attackerCasualties}명)`);
    battleLog.push(`수비자 생존: ${result.defenderSurvivors}명 (손실: ${result.defenderCasualties}명)`);
    
    return result;
  }
  
  /**
   * 단일 페이즈 계산
   */
  private calculatePhase(context: BattleContext, phaseNum: number): PhaseResult {
    const attackerPower = this.calculateCombatPower(context.attacker, context.defender, context, true);
    const defenderPower = this.calculateCombatPower(context.defender, context.attacker, context, false);
    
    // 필살 및 회피 판정
    const attackerCritical = this.checkCritical(context.attacker);
    const defenderCritical = this.checkCritical(context.defender);
    const attackerEvaded = this.checkEvasion(context.attacker);
    const defenderEvaded = this.checkEvasion(context.defender);
    
    // 피해 계산
    let attackerDamage = this.calculateDamage(defenderPower, defenderCritical, attackerEvaded);
    let defenderDamage = this.calculateDamage(attackerPower, attackerCritical, defenderEvaded);
    
    // 특기 적용
    attackerDamage = this.applySpecialSkills(context.attacker, attackerDamage, 'defense');
    defenderDamage = this.applySpecialSkills(context.defender, defenderDamage, 'defense');
    
    // 최대 피해 제한 (한 페이즈에 최대 20% 손실)
    attackerDamage = Math.min(attackerDamage, Math.floor(context.attacker.troops * 0.2));
    defenderDamage = Math.min(defenderDamage, Math.floor(context.defender.troops * 0.2));
    
    const log = this.generatePhaseLog(phaseNum, context, attackerDamage, defenderDamage, 
                                      attackerCritical, defenderCritical, attackerEvaded, defenderEvaded);
    
    return {
      attackerDamage,
      defenderDamage,
      attackerCritical,
      defenderCritical,
      attackerEvaded,
      defenderEvaded,
      log
    };
  }
  
  /**
   * 전투력 계산
   */
  private calculateCombatPower(
    attacker: BattleUnit,
    defender: BattleUnit,
    context: BattleContext,
    isAttacker: boolean
  ): number {
    const baseStats = UNIT_BASE_STATS[attacker.unitType];
    
    // 1. 기본 능력치 기반 전투력
    const statWeight = this.getStatWeight(attacker.unitType);
    const effectiveStat = 
      attacker.leadership * statWeight.leadership +
      attacker.strength * statWeight.strength +
      attacker.intelligence * statWeight.intelligence;
    
    // 2. 병력 수 반영 (제곱근 사용으로 대군의 이점 완화)
    const troopsFactor = Math.sqrt(attacker.troops / 100);
    
    // 3. 병종 기본 능력치
    const attackPower = baseStats.attack * effectiveStat * troopsFactor;
    
    // 4. 훈련도/사기 반영
    const moraleBonus = 0.5 + (attacker.morale / 100) * 0.5;
    const trainingBonus = 0.7 + (attacker.training / 100) * 0.3;
    
    // 5. 기술력 반영
    const techBonus = 1 + (attacker.techLevel / 100) * 0.3;
    
    // 6. 병종 상성
    const typeAdvantage = UNIT_ADVANTAGE_TABLE[attacker.unitType][defender.unitType];
    
    // 7. 지형 보너스
    const terrainBonus = this.applyTerrainBonus(attacker.unitType, context.terrain);
    
    // 8. 공성전 보너스/패널티
    let siegeModifier = 1.0;
    if (context.isDefenderCity) {
      if (isAttacker) {
        siegeModifier = attacker.unitType === UnitType.SIEGE ? 1.4 : 0.8;
      } else {
        siegeModifier = 1.3; // 수비자는 성벽 보너스
        if (context.cityWall) {
          siegeModifier += (context.cityWall / 100) * 0.3;
        }
      }
    }
    
    // 최종 전투력
    let power = attackPower * moraleBonus * trainingBonus * techBonus * 
                typeAdvantage * terrainBonus * siegeModifier;
    
    // 특기 효과
    power = this.applySpecialSkills(attacker, power, 'attack');
    
    return Math.floor(power);
  }
  
  /**
   * 병종별 능력치 가중치
   */
  private getStatWeight(unitType: UnitType): { leadership: number; strength: number; intelligence: number } {
    switch (unitType) {
      case UnitType.FOOTMAN:
        return { leadership: 0.4, strength: 0.5, intelligence: 0.1 };
      case UnitType.CAVALRY:
        return { leadership: 0.5, strength: 0.4, intelligence: 0.1 };
      case UnitType.ARCHER:
        return { leadership: 0.3, strength: 0.5, intelligence: 0.2 };
      case UnitType.WIZARD:
        return { leadership: 0.3, strength: 0.2, intelligence: 0.5 };
      case UnitType.SIEGE:
        return { leadership: 0.6, strength: 0.3, intelligence: 0.1 };
      default:
        return { leadership: 0.33, strength: 0.33, intelligence: 0.34 };
    }
  }
  
  /**
   * 지형 보너스 적용
   */
  applyTerrainBonus(unitType: UnitType, terrain: TerrainType): number {
    return TERRAIN_BONUS[terrain][unitType] || 1.0;
  }
  
  /**
   * 특기 효과 적용
   */
  applySpecialSkills(unit: BattleUnit, value: number, type: 'attack' | 'defense'): number {
    if (!unit.specialSkills || unit.specialSkills.length === 0) {
      return value;
    }
    
    let multiplier = 1.0;
    
    for (const skill of unit.specialSkills) {
      switch (skill) {
        case '돌격':
          if (type === 'attack' && unit.unitType === UnitType.CAVALRY) {
            multiplier *= 1.3;
          }
          break;
        case '저격':
          if (type === 'attack' && unit.unitType === UnitType.ARCHER) {
            multiplier *= 1.25;
          }
          break;
        case '책략':
          if (type === 'attack' && unit.unitType === UnitType.WIZARD) {
            multiplier *= 1.35;
          }
          break;
        case '공성':
          if (type === 'attack' && unit.unitType === UnitType.SIEGE) {
            multiplier *= 1.4;
          }
          break;
        case '철벽':
          if (type === 'defense') {
            multiplier *= 1.25;
          }
          break;
        case '회복':
          if (type === 'defense') {
            multiplier *= 1.15;
          }
          break;
        case '필살':
          if (type === 'attack') {
            multiplier *= 1.2;
          }
          break;
        case '간파':
          if (type === 'defense') {
            multiplier *= 1.2;
          }
          break;
      }
    }
    
    return Math.floor(value * multiplier);
  }
  
  /**
   * 필살 판정
   */
  private checkCritical(unit: BattleUnit): boolean {
    const baseCriticalRate = 0.1;
    const statBonus = (unit.strength + unit.intelligence) / 300 * 0.1;
    const criticalRate = baseCriticalRate + statBonus;
    
    let finalRate = criticalRate;
    if (unit.specialSkills?.includes('필살')) {
      finalRate += 0.15;
    }
    
    return Math.random() < finalRate;
  }
  
  /**
   * 회피 판정
   */
  private checkEvasion(unit: BattleUnit): boolean {
    const baseEvasionRate = 0.05;
    const statBonus = unit.strength / 150 * 0.1;
    const trainingBonus = unit.training / 100 * 0.05;
    
    let evasionRate = baseEvasionRate + statBonus + trainingBonus;
    
    if (unit.specialSkills?.includes('회피')) {
      evasionRate += 0.15;
    }
    
    return Math.random() < evasionRate;
  }
  
  /**
   * 피해량 계산
   */
  calculateDamage(power: number, isCritical: boolean, isEvaded: boolean): number {
    if (isEvaded) {
      return Math.floor(power * 0.2); // 회피 시 80% 감소
    }
    
    const variance = 0.9 + Math.random() * 0.2; // 90%~110%
    let damage = (this.BASE_DAMAGE + power) * variance;
    
    if (isCritical) {
      damage *= this.CRITICAL_DAMAGE_MULTIPLIER;
    }
    
    return Math.floor(damage);
  }
  
  /**
   * 사기 붕괴 체크
   */
  private checkMoraleBreak(unit: BattleUnit, currentTroops: number, initialTroops: number): boolean {
    const lossRate = 1 - (currentTroops / initialTroops);
    
    if (lossRate < 0.3) return false; // 손실률 30% 미만이면 안전
    
    const moraleThreshold = unit.morale / 100;
    const breakChance = (lossRate - 0.3) * (1 - moraleThreshold);
    
    return Math.random() < breakChance;
  }
  
  /**
   * 승자 판정
   */
  private determineWinner(
    attackerTroops: number, 
    defenderTroops: number, 
    isDefenderCity: boolean
  ): 'attacker' | 'defender' | 'draw' {
    if (attackerTroops <= 0 && defenderTroops <= 0) {
      return 'draw';
    }
    
    if (attackerTroops <= 0) {
      return 'defender';
    }
    
    if (defenderTroops <= 0) {
      // 공성전의 경우 수비군 전멸 = 공격자 승리
      return 'attacker';
    }
    
    // 둘 다 생존 시 병력 비교
    return attackerTroops > defenderTroops ? 'attacker' : 'defender';
  }
  
  /**
   * 전투 로그 생성
   */
  generateBattleLog(result: BattleResult): string[] {
    return result.battleLog;
  }
  
  /**
   * 페이즈별 로그 생성
   */
  private generatePhaseLog(
    phase: number,
    context: BattleContext,
    attackerDamage: number,
    defenderDamage: number,
    attackerCritical: boolean,
    defenderCritical: boolean,
    attackerEvaded: boolean,
    defenderEvaded: boolean
  ): string {
    let log = `[${phase}턴] `;
    
    const atkName = context.attacker.name;
    const defName = context.defender.name;
    
    const atkDmgStr = attackerCritical ? `${attackerDamage}(치명타!)` : `${attackerDamage}`;
    const defDmgStr = defenderCritical ? `${defenderDamage}(치명타!)` : `${defenderDamage}`;
    
    if (attackerEvaded) {
      log += `${atkName} 회피! `;
    }
    if (defenderEvaded) {
      log += `${defName} 회피! `;
    }
    
    log += `${atkName} -${atkDmgStr} ← ${defName} -${defDmgStr}`;
    
    return log;
  }
}

/**
 * 간편 사용을 위한 헬퍼 함수
 */
export function simulateBattle(
  attackerName: string,
  attackerTroops: number,
  attackerStats: [number, number, number], // [통솔, 무력, 지력]
  attackerType: UnitType,
  defenderName: string,
  defenderTroops: number,
  defenderStats: [number, number, number],
  defenderType: UnitType,
  terrain: TerrainType = TerrainType.PLAINS,
  isDefenderCity: boolean = false
): BattleResult {
  const calculator = new BattleCalculator();
  
  const context: BattleContext = {
    attacker: {
      name: attackerName,
      troops: attackerTroops,
      leadership: attackerStats[0],
      strength: attackerStats[1],
      intelligence: attackerStats[2],
      unitType: attackerType,
      morale: 80,
      training: 80,
      techLevel: 50,
      specialSkills: []
    },
    defender: {
      name: defenderName,
      troops: defenderTroops,
      leadership: defenderStats[0],
      strength: defenderStats[1],
      intelligence: defenderStats[2],
      unitType: defenderType,
      morale: 80,
      training: 80,
      techLevel: 50,
      specialSkills: []
    },
    terrain,
    isDefenderCity,
    cityWall: isDefenderCity ? 50 : undefined
  };
  
  return calculator.calculateBattle(context);
}
