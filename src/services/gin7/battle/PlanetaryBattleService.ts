/**
 * PlanetaryBattleService
 * 
 * 행성/요새 전투 시스템
 * - 궤도 전투에서 행성 전투로 전환
 * - 지상군 배치 및 강하 작전
 * - 행성 방어시설 전투
 * - 점령 조건 체크 및 실행
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { RealtimeBattle, IRealtimeBattle } from '../../../models/gin7/RealtimeBattle';
import { Gin7Character } from '../../../models/gin7/Character';

/**
 * 행성 정보
 */
export interface IPlanet {
  planetId: string;
  sessionId: string;
  gridId: string;
  name: string;
  
  // 소유
  controllingFaction?: string;
  
  // 방어력
  defenseForce: {
    groundUnits: number;      // 지상군 유닛 수
    maxGroundUnits: number;
    hp: number;               // 방어 HP (0-100)
    fortifications: number;   // 요새화 수준 (0-100)
  };
  
  // 시설
  hasSpacePort: boolean;
  hasDefenseGrid: boolean;    // 궤도 방어 시스템
  hasFortress: boolean;       // 이제르론 같은 요새
  
  // 상태
  isUnderSiege: boolean;
  siegeStartedAt?: Date;
  bombardmentDamage: number;  // 누적 폭격 피해
}

/**
 * 지상군 배치 정보
 */
export interface IGroundDeployment {
  id: string;
  sessionId: string;
  planetId: string;
  battleId?: string;
  
  // 배치 정보
  fleetId: string;
  factionId: string;
  deployedUnits: number;
  deployedAt: Date;
  
  // 유닛 타입
  unitTypes: Array<{
    type: 'ARMORED' | 'GRENADIER' | 'LIGHT_INFANTRY';
    count: number;
    hp: number;
  }>;
  
  // 상태
  status: 'DEPLOYING' | 'DEPLOYED' | 'IN_COMBAT' | 'RETREATING' | 'DESTROYED';
  
  // 전투 통계
  damageDealt: number;
  damageTaken: number;
  unitsLost: number;
}

/**
 * 행성 전투 상태
 */
export interface IPlanetaryBattleState {
  planetId: string;
  sessionId: string;
  battleId: string;
  
  // 참여 진영
  attackingFaction: string;
  defendingFaction: string;
  
  // 단계
  phase: 'ORBITAL_CONTROL' | 'BOMBARDMENT' | 'LANDING' | 'GROUND_COMBAT' | 'OCCUPATION';
  phaseStartedAt: Date;
  
  // 궤도 통제
  orbitalControl?: string;  // 궤도를 장악한 진영
  
  // 폭격
  bombardmentTicks: number;
  fortificationDamage: number;
  
  // 지상전
  attackerGroundForce: number;
  defenderGroundForce: number;
  groundCombatTicks: number;
  
  // 점령
  occupationProgress: number;  // 0-100
  
  // 결과
  isResolved: boolean;
  victor?: string;
  resolvedAt?: Date;
}

/**
 * 행성 전투 설정
 */
export const PLANETARY_BATTLE_CONFIG = {
  // 궤도 통제
  orbitalControlTimeoutTicks: 600,  // 궤도 통제 확립까지 1분
  
  // 폭격
  bombardmentDamagePerTick: 0.5,    // 틱당 요새화 피해
  maxBombardmentDamage: 80,          // 최대 요새화 파괴율
  civilianCasualtiesChance: 0.1,     // 민간인 피해 확률/틱
  
  // 강하 작전
  landingTimePerUnit: 5,             // 유닛당 강하 시간 (틱)
  landingDangerZoneTicks: 100,       // 강하 중 위험 구간 (10초)
  landingCasualtyRate: 0.05,         // 강하 중 손실률 (방어시설 있을 때)
  
  // 지상전
  groundCombatTicksPerRound: 10,     // 라운드당 틱
  attackerAdvantage: 0.8,            // 공격측 데미지 배율
  fortificationDefenseBonus: 1.5,    // 요새화 방어 보너스
  
  // 점령
  occupationTicksPerPercent: 10,     // 1% 점령당 틱
  minOccupationForce: 10,            // 최소 점령 병력
};

/**
 * PlanetaryBattleService 클래스
 */
class PlanetaryBattleService extends EventEmitter {
  private static instance: PlanetaryBattleService;
  
  // 진행 중인 행성 전투
  private planetaryBattles: Map<string, IPlanetaryBattleState> = new Map();  // planetId -> state
  
  // 지상군 배치
  private groundDeployments: Map<string, IGroundDeployment[]> = new Map();  // planetId -> deployments

  private constructor() {
    super();
  }

  static getInstance(): PlanetaryBattleService {
    if (!PlanetaryBattleService.instance) {
      PlanetaryBattleService.instance = new PlanetaryBattleService();
    }
    return PlanetaryBattleService.instance;
  }

  /**
   * 행성 전투 시작
   */
  async initiatePlanetaryBattle(
    sessionId: string,
    battleId: string,
    planetId: string,
    attackingFaction: string
  ): Promise<IPlanetaryBattleState | null> {
    // 이미 진행 중인 전투가 있는지 확인
    if (this.planetaryBattles.has(planetId)) {
      return null;
    }

    // 행성 정보 조회 (실제로는 Planet 모델에서)
    // 여기서는 간단히 처리
    const planet = await this.getPlanet(sessionId, planetId);
    if (!planet) {
      return null;
    }

    const battleState: IPlanetaryBattleState = {
      planetId,
      sessionId,
      battleId,
      attackingFaction,
      defendingFaction: planet.controllingFaction || 'NEUTRAL',
      phase: 'ORBITAL_CONTROL',
      phaseStartedAt: new Date(),
      bombardmentTicks: 0,
      fortificationDamage: 0,
      attackerGroundForce: 0,
      defenderGroundForce: planet.defenseForce.groundUnits,
      groundCombatTicks: 0,
      occupationProgress: 0,
      isResolved: false
    };

    this.planetaryBattles.set(planetId, battleState);
    this.groundDeployments.set(planetId, []);

    this.emit('planetary_battle:started', battleState);

    return battleState;
  }

  /**
   * 궤도 통제 확립
   */
  async establishOrbitalControl(
    planetId: string,
    controllingFaction: string
  ): Promise<boolean> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState) return false;

    if (battleState.phase !== 'ORBITAL_CONTROL') {
      return false;
    }

    battleState.orbitalControl = controllingFaction;
    battleState.phase = 'BOMBARDMENT';
    battleState.phaseStartedAt = new Date();

    this.emit('planetary_battle:orbital_control', { planetId, controllingFaction });

    return true;
  }

  /**
   * 폭격 진행
   */
  async processBombardment(
    planetId: string,
    bombardingFleets: string[],
    currentTick: number
  ): Promise<{ damage: number; fortificationRemaining: number }> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState || battleState.phase !== 'BOMBARDMENT') {
      return { damage: 0, fortificationRemaining: 100 };
    }

    const planet = await this.getPlanet(battleState.sessionId, planetId);
    if (!planet) {
      return { damage: 0, fortificationRemaining: 100 };
    }

    // 폭격 데미지 계산
    const fleetCount = bombardingFleets.length;
    const damage = PLANETARY_BATTLE_CONFIG.bombardmentDamagePerTick * fleetCount;
    
    battleState.bombardmentTicks++;
    battleState.fortificationDamage += damage;

    // 최대 피해 제한
    if (battleState.fortificationDamage > PLANETARY_BATTLE_CONFIG.maxBombardmentDamage) {
      battleState.fortificationDamage = PLANETARY_BATTLE_CONFIG.maxBombardmentDamage;
    }

    // 요새화 업데이트
    const fortificationRemaining = Math.max(0, planet.defenseForce.fortifications - battleState.fortificationDamage);

    // 민간인 피해 체크
    if (Math.random() < PLANETARY_BATTLE_CONFIG.civilianCasualtiesChance) {
      this.emit('planetary_battle:civilian_casualties', { planetId, tick: currentTick });
    }

    this.emit('planetary_battle:bombardment', { 
      planetId, 
      damage, 
      fortificationRemaining,
      tick: currentTick 
    });

    return { damage, fortificationRemaining };
  }

  /**
   * 지상군 배치 (강하 작전)
   */
  async deployGroundForces(
    sessionId: string,
    planetId: string,
    fleetId: string,
    units: Array<{ type: 'ARMORED' | 'GRENADIER' | 'LIGHT_INFANTRY'; count: number }>
  ): Promise<IGroundDeployment | null> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState) return null;

    // 궤도 통제 없이는 강하 불가
    if (!battleState.orbitalControl) {
      return null;
    }

    // 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return null;

    // 공격측 함대인지 확인
    if (fleet.factionId !== battleState.orbitalControl) {
      return null;  // 궤도를 장악한 측만 강하 가능
    }

    const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
    
    const deployment: IGroundDeployment = {
      id: `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      planetId,
      battleId: battleState.battleId,
      fleetId,
      factionId: fleet.factionId,
      deployedUnits: totalUnits,
      deployedAt: new Date(),
      unitTypes: units.map(u => ({ ...u, hp: 100 })),
      status: 'DEPLOYING',
      damageDealt: 0,
      damageTaken: 0,
      unitsLost: 0
    };

    // 배치 저장
    const deployments = this.groundDeployments.get(planetId) || [];
    deployments.push(deployment);
    this.groundDeployments.set(planetId, deployments);

    // 단계 전환
    if (battleState.phase === 'BOMBARDMENT') {
      battleState.phase = 'LANDING';
      battleState.phaseStartedAt = new Date();
    }

    battleState.attackerGroundForce += totalUnits;

    this.emit('planetary_battle:ground_deployment', deployment);

    return deployment;
  }

  /**
   * 강하 완료 처리
   */
  async completeLanding(
    planetId: string,
    deploymentId: string,
    casualties: number = 0
  ): Promise<boolean> {
    const deployments = this.groundDeployments.get(planetId);
    if (!deployments) return false;

    const deployment = deployments.find(d => d.id === deploymentId);
    if (!deployment) return false;

    deployment.status = 'DEPLOYED';
    deployment.unitsLost = casualties;
    deployment.deployedUnits -= casualties;

    // 지상전 시작 체크
    const battleState = this.planetaryBattles.get(planetId);
    if (battleState && battleState.phase === 'LANDING') {
      const allLanded = deployments.every(d => d.status !== 'DEPLOYING');
      if (allLanded) {
        battleState.phase = 'GROUND_COMBAT';
        battleState.phaseStartedAt = new Date();
        this.emit('planetary_battle:ground_combat_started', { planetId });
      }
    }

    return true;
  }

  /**
   * 지상전 처리
   */
  async processGroundCombat(
    planetId: string,
    currentTick: number
  ): Promise<{ attackerDamage: number; defenderDamage: number; isResolved: boolean }> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState || battleState.phase !== 'GROUND_COMBAT') {
      return { attackerDamage: 0, defenderDamage: 0, isResolved: false };
    }

    const planet = await this.getPlanet(battleState.sessionId, planetId);
    if (!planet) {
      return { attackerDamage: 0, defenderDamage: 0, isResolved: false };
    }

    battleState.groundCombatTicks++;

    // 라운드 체크
    if (battleState.groundCombatTicks % PLANETARY_BATTLE_CONFIG.groundCombatTicksPerRound !== 0) {
      return { attackerDamage: 0, defenderDamage: 0, isResolved: false };
    }

    // 병력 계산
    const attackerForce = battleState.attackerGroundForce;
    const defenderForce = battleState.defenderGroundForce;

    // 요새화 보너스
    const fortificationBonus = planet.defenseForce.fortifications > 0 
      ? 1 + (planet.defenseForce.fortifications / 100) * (PLANETARY_BATTLE_CONFIG.fortificationDefenseBonus - 1)
      : 1;

    // 데미지 계산
    const attackerDamage = Math.floor(attackerForce * PLANETARY_BATTLE_CONFIG.attackerAdvantage);
    const defenderDamage = Math.floor(defenderForce * fortificationBonus);

    // 병력 감소
    const attackerLosses = Math.min(defenderDamage, battleState.attackerGroundForce);
    const defenderLosses = Math.min(attackerDamage, battleState.defenderGroundForce);

    battleState.attackerGroundForce -= attackerLosses;
    battleState.defenderGroundForce -= defenderLosses;

    // 배치 업데이트
    this.updateDeploymentLosses(planetId, attackerLosses);

    this.emit('planetary_battle:ground_combat_round', {
      planetId,
      attackerDamage,
      defenderDamage,
      attackerLosses,
      defenderLosses,
      attackerRemaining: battleState.attackerGroundForce,
      defenderRemaining: battleState.defenderGroundForce,
      tick: currentTick
    });

    // 승리 조건 체크
    let isResolved = false;
    
    if (battleState.defenderGroundForce <= 0) {
      // 공격측 승리 - 점령 단계로
      battleState.phase = 'OCCUPATION';
      battleState.phaseStartedAt = new Date();
      this.emit('planetary_battle:defender_defeated', { planetId });
    } else if (battleState.attackerGroundForce <= 0) {
      // 방어측 승리
      battleState.isResolved = true;
      battleState.victor = battleState.defendingFaction;
      battleState.resolvedAt = new Date();
      isResolved = true;
      this.emit('planetary_battle:attacker_defeated', { planetId });
    }

    return { attackerDamage, defenderDamage, isResolved };
  }

  /**
   * 점령 진행
   */
  async processOccupation(
    planetId: string,
    currentTick: number
  ): Promise<{ progress: number; isComplete: boolean }> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState || battleState.phase !== 'OCCUPATION') {
      return { progress: 0, isComplete: false };
    }

    // 점령 병력 체크
    if (battleState.attackerGroundForce < PLANETARY_BATTLE_CONFIG.minOccupationForce) {
      return { progress: battleState.occupationProgress, isComplete: false };
    }

    // 점령 진행
    const progressPerTick = 100 / (PLANETARY_BATTLE_CONFIG.occupationTicksPerPercent * 100);
    battleState.occupationProgress += progressPerTick;

    if (battleState.occupationProgress >= 100) {
      battleState.occupationProgress = 100;
      return { progress: 100, isComplete: true };
    }

    return { progress: battleState.occupationProgress, isComplete: false };
  }

  /**
   * 점령 완료
   */
  async executeOccupation(
    planetId: string,
    newOwner: string
  ): Promise<boolean> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState) return false;

    // 행성 소유권 변경
    // 실제로는 Planet 모델 업데이트
    
    battleState.isResolved = true;
    battleState.victor = newOwner;
    battleState.resolvedAt = new Date();

    this.emit('planetary_battle:occupation_complete', { 
      planetId, 
      newOwner,
      previousOwner: battleState.defendingFaction 
    });

    // 정리
    this.cleanupPlanetaryBattle(planetId);

    return true;
  }

  /**
   * 배치 손실 업데이트
   */
  private updateDeploymentLosses(planetId: string, totalLosses: number): void {
    const deployments = this.groundDeployments.get(planetId);
    if (!deployments) return;

    let remaining = totalLosses;
    for (const deployment of deployments) {
      if (deployment.status === 'DEPLOYED' || deployment.status === 'IN_COMBAT') {
        const loss = Math.min(remaining, deployment.deployedUnits);
        deployment.unitsLost += loss;
        deployment.deployedUnits -= loss;
        remaining -= loss;

        if (deployment.deployedUnits <= 0) {
          deployment.status = 'DESTROYED';
        }

        if (remaining <= 0) break;
      }
    }
  }

  /**
   * 행성 전투 정리
   */
  private cleanupPlanetaryBattle(planetId: string): void {
    this.planetaryBattles.delete(planetId);
    this.groundDeployments.delete(planetId);
  }

  /**
   * 행성 정보 조회 (임시 - 실제로는 Planet 모델 사용)
   */
  private async getPlanet(sessionId: string, planetId: string): Promise<IPlanet | null> {
    // 실제 구현에서는 Planet 모델 조회
    // 여기서는 기본값 반환
    return {
      planetId,
      sessionId,
      gridId: '',
      name: 'Unknown Planet',
      controllingFaction: undefined,
      defenseForce: {
        groundUnits: 50,
        maxGroundUnits: 100,
        hp: 100,
        fortifications: 50
      },
      hasSpacePort: true,
      hasDefenseGrid: false,
      hasFortress: false,
      isUnderSiege: false,
      bombardmentDamage: 0
    };
  }

  /**
   * 행성 전투 상태 조회
   */
  getPlanetaryBattleState(planetId: string): IPlanetaryBattleState | undefined {
    return this.planetaryBattles.get(planetId);
  }

  /**
   * 행성의 지상군 배치 조회
   */
  getGroundDeployments(planetId: string): IGroundDeployment[] {
    return this.groundDeployments.get(planetId) || [];
  }

  /**
   * 점령 조건 확인
   */
  async checkOccupationCondition(planetId: string): Promise<{
    canOccupy: boolean;
    reason?: string;
  }> {
    const battleState = this.planetaryBattles.get(planetId);
    if (!battleState) {
      return { canOccupy: false, reason: '진행 중인 행성 전투가 없습니다.' };
    }

    if (battleState.phase !== 'OCCUPATION') {
      return { canOccupy: false, reason: '아직 점령 단계가 아닙니다.' };
    }

    if (battleState.occupationProgress < 100) {
      return { canOccupy: false, reason: `점령 진행률: ${battleState.occupationProgress.toFixed(1)}%` };
    }

    return { canOccupy: true };
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    this.planetaryBattles.clear();
    this.groundDeployments.clear();
    this.removeAllListeners();
  }
}

export const planetaryBattleService = PlanetaryBattleService.getInstance();
export default PlanetaryBattleService;
