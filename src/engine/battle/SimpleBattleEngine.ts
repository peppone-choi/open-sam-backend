import { IGeneral } from '../../models/general.model';
import { IMudBattleLog } from '../../models/mud-battle-log.model';

export interface BattleParticipant {
  id: number;
  name: string;
  nationId: number;
  nationName: string;
  
  // Stats
  leadership: number;
  strength: number;
  intel: number;
  
  // Status
  troops: number;
  morale: number; // 사기 (0-100)
  training: number; // 훈련도 (0-100)
  
  // Type
  crewType: number; // 병종 ID
}

export interface BattleResult {
  logs: string[];
  winner: 'attacker' | 'defender' | 'draw';
  detail: {
    attackerLoss: number;
    defenderLoss: number;
    attackerExp: number;
    defenderExp: number;
  };
}

export class SimpleBattleEngine {
  private attacker: BattleParticipant;
  private defender: BattleParticipant;
  private logs: string[] = [];
  private maxRounds = 10;
  
  constructor(attacker: IGeneral, defender: IGeneral, attackerNationName: string, defenderNationName: string) {
    this.attacker = this.mapGeneralToParticipant(attacker, attackerNationName);
    this.defender = this.mapGeneralToParticipant(defender, defenderNationName);
  }
  
  private mapGeneralToParticipant(general: IGeneral, nationName: string): BattleParticipant {
    return {
      id: general.no,
      name: general.name,
      nationId: general.nation || 0,
      nationName: nationName,
      leadership: general.getLeadership(),
      strength: general.getStrength(),
      intel: general.getIntel(),
      troops: general.getVar('crew') || 0,
      morale: general.getVar('atmos') || 0,
      training: general.getVar('train') || 0,
      crewType: general.getVar('crewtype') || 1100 // Default: Infantry
    };
  }
  
  private log(message: string) {
    this.logs.push(message);
  }
  
  // 병종 상성 계수 (간소화: 1.0 ~ 1.2)
  private getTypeModifier(attackerType: number, defenderType: number): number {
    // 11xx: 보병, 12xx: 궁병, 13xx: 기병
    const atkBase = Math.floor(attackerType / 100);
    const defBase = Math.floor(defenderType / 100);
    
    // 보병(11) > 궁병(12) > 기병(13) > 보병(11) (가위바위보 역순 예시)
    // 실제 삼국지 게임: 기병 > 보병 > 궁병 > 기병 ? (게임마다 다름)
    // 여기서는 보편적인: 기병 > 보병 > 궁병 > 기병 으로 설정
    
    if (atkBase === 13 && defBase === 11) return 1.2; // 기병 vs 보병
    if (atkBase === 11 && defBase === 12) return 1.2; // 보병 vs 궁병
    if (atkBase === 12 && defBase === 13) return 1.2; // 궁병 vs 기병
    
    return 1.0;
  }
  
  public run(): BattleResult {
    this.log(`===== 전투 시작: ${this.attacker.name} vs ${this.defender.name} =====`);
    this.log(`${this.attacker.name}: 병력 ${this.attacker.troops}, 사기 ${this.attacker.morale}`);
    this.log(`${this.defender.name}: 병력 ${this.defender.troops}, 사기 ${this.defender.morale}`);
    
    const initialAttackerTroops = this.attacker.troops;
    const initialDefenderTroops = this.defender.troops;
    
    for (let round = 1; round <= this.maxRounds; round++) {
      if (this.attacker.troops <= 0 || this.defender.troops <= 0) break;
      
      this.log(`[Round ${round}]`);
      
      // 선공 결정 (통솔 + 랜덤)
      const atkSpeed = this.attacker.leadership * (0.8 + Math.random() * 0.4);
      const defSpeed = this.defender.leadership * (0.8 + Math.random() * 0.4);
      
      if (atkSpeed >= defSpeed) {
        this.processAttack(this.attacker, this.defender);
        if (this.defender.troops > 0) {
          this.processAttack(this.defender, this.attacker);
        }
      } else {
        this.processAttack(this.defender, this.attacker);
        if (this.attacker.troops > 0) {
          this.processAttack(this.attacker, this.defender);
        }
      }
    }
    
    // 결과 판정
    let winner: 'attacker' | 'defender' | 'draw' = 'draw';
    if (this.attacker.troops <= 0 && this.defender.troops > 0) winner = 'defender';
    else if (this.defender.troops <= 0 && this.attacker.troops > 0) winner = 'attacker';
    else if (this.attacker.troops > this.defender.troops) winner = 'attacker'; // 병력 많은 쪽 판정승 (턴 종료 시)
    else if (this.defender.troops > this.attacker.troops) winner = 'defender';
    
    const result: BattleResult = {
      logs: this.logs,
      winner,
      detail: {
        attackerLoss: initialAttackerTroops - Math.max(0, this.attacker.troops),
        defenderLoss: initialDefenderTroops - Math.max(0, this.defender.troops),
        attackerExp: 100, // TODO: 계산 로직 추가
        defenderExp: 100
      }
    };
    
    this.log(`===== 전투 종료: 승자 ${winner === 'attacker' ? this.attacker.name : (winner === 'defender' ? this.defender.name : '무승부')} =====`);
    
    return result;
  }
  
  private processAttack(source: BattleParticipant, target: BattleParticipant) {
    // 기본 데미지: 무력 * (병력/1000 + 1)
    const baseDmg = source.strength * (source.troops / 1000 + 1);
    
    // 상성 보정
    const mod = this.getTypeModifier(source.crewType, target.crewType);
    
    // 최종 데미지 (랜덤성 추가)
    const damage = Math.floor(baseDmg * mod * (0.8 + Math.random() * 0.4));
    
    // 방어력 적용 (통솔/2)
    const defense = target.leadership / 2;
    const finalDamage = Math.max(1, Math.floor(damage * (100 / (100 + defense))));
    
    // 병력 감소
    const actualDamage = Math.min(target.troops, finalDamage);
    target.troops -= actualDamage;
    
    // 사기 저하
    const moraleDmg = Math.floor(actualDamage / 100);
    target.morale = Math.max(0, target.morale - moraleDmg);
    
    this.log(`${source.name}의 공격! ${target.name}에게 ${actualDamage}의 피해를 입혔습니다. (남은 병력: ${target.troops})`);
    
    // 크리티컬 (무력이 압도적으로 높을 때)
    if (source.strength > target.strength * 1.5 && Math.random() < 0.2) {
      this.log(`⚡ 치명타! ${target.name}의 부대가 혼란에 빠집니다!`);
      target.morale = Math.max(0, target.morale - 10);
    }
  }
}
