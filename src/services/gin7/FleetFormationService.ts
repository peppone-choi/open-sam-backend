/**
 * FleetFormationService
 * 
 * 함대 진형(Formation) 및 고급 기동(Maneuver) 관리 서비스
 * - 은하영웅전설 VII 기준 구현
 */

import { EventEmitter } from 'events';
import {
  FormationType,
  FormationModifiers,
  FormationState,
  ManeuverType,
  ManeuverState,
  ManeuverCommand,
  ChangeFormationCommand,
  WingmanPosition,
  FORMATION_MODIFIERS,
  FORMATION_DEFINITIONS,
  MANEUVER_DURATIONS,
  MANEUVER_PENALTIES,
} from '../../types/gin7/formation.types';
import { UnitState, Vector3, TACTICAL_CONSTANTS } from '../../types/gin7/tactical.types';
import { ShipClass, SHIP_SPECS } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

/**
 * 진형 변경 이벤트
 */
export interface FormationChangeEvent {
  fleetId: string;
  previousFormation: FormationType;
  newFormation: FormationType;
  timestamp: number;
}

/**
 * 기동 완료 이벤트
 */
export interface ManeuverCompleteEvent {
  unitIds: string[];
  maneuverType: ManeuverType;
  success: boolean;
  timestamp: number;
}

/**
 * FleetFormationService
 */
export class FleetFormationService extends EventEmitter {
  // 대형 상태 관리
  private formationStates: Map<string, FormationState> = new Map();
  
  // 기동 상태 관리 (유닛별)
  private maneuverStates: Map<string, ManeuverState> = new Map();
  
  constructor() {
    super();
    logger.info('[FleetFormationService] Initialized');
  }
  
  // ============================================================
  // Formation Management
  // ============================================================
  
  /**
   * 함대 대형 초기화
   */
  initializeFormation(
    fleetId: string,
    leaderUnitId: string,
    unitIds: string[],
    formation: FormationType = 'STANDARD'
  ): FormationState {
    const wingmen = this.calculateWingmanPositions(leaderUnitId, unitIds, formation);
    
    const state: FormationState = {
      type: formation,
      leaderUnitId,
      wingmen,
      cohesion: 100,
      spreadLevel: 1,
      isChanging: false,
    };
    
    this.formationStates.set(fleetId, state);
    
    logger.debug('[FleetFormationService] Formation initialized', {
      fleetId,
      formation,
      wingmenCount: wingmen.length,
    });
    
    return state;
  }
  
  /**
   * 진형 변경 시작
   */
  startFormationChange(command: ChangeFormationCommand): {
    success: boolean;
    message: string;
    estimatedTime?: number;
  } {
    const state = this.formationStates.get(command.fleetId);
    
    if (!state) {
      return { success: false, message: 'Fleet formation state not found' };
    }
    
    if (state.isChanging) {
      return { success: false, message: 'Already changing formation' };
    }
    
    const definition = FORMATION_DEFINITIONS[command.targetFormation];
    if (!definition) {
      return { success: false, message: 'Invalid formation type' };
    }
    
    // 진형 변경 소요 시간 계산 (함선 수, 우선순위에 따라)
    const baseTime = definition.changeTime;
    const timeMultiplier = command.priority === 'URGENT' ? 0.5 : 1.0;
    const estimatedTime = baseTime * timeMultiplier;
    
    // 상태 업데이트
    state.isChanging = true;
    state.targetFormation = command.targetFormation;
    state.changeProgress = 0;
    
    // 긴급 변경 시 결속도 페널티
    if (command.priority === 'URGENT') {
      state.cohesion = Math.max(0, state.cohesion - 20);
    }
    
    logger.info('[FleetFormationService] Formation change started', {
      fleetId: command.fleetId,
      from: state.type,
      to: command.targetFormation,
      estimatedTime,
    });
    
    return {
      success: true,
      message: `진형 변경 시작: ${FORMATION_DEFINITIONS[state.type].nameKo} → ${definition.nameKo}`,
      estimatedTime,
    };
  }
  
  /**
   * 진형 변경 진행 업데이트 (틱 단위)
   */
  updateFormationChange(fleetId: string, deltaTime: number): boolean {
    const state = this.formationStates.get(fleetId);
    
    if (!state || !state.isChanging || !state.targetFormation) {
      return false;
    }
    
    const definition = FORMATION_DEFINITIONS[state.targetFormation];
    const progressIncrement = deltaTime / definition.changeTime;
    
    state.changeProgress = Math.min(1, (state.changeProgress || 0) + progressIncrement);
    
    // 변경 완료
    if (state.changeProgress >= 1) {
      const previousFormation = state.type;
      state.type = state.targetFormation;
      state.isChanging = false;
      state.changeProgress = undefined;
      state.targetFormation = undefined;
      
      // 윙맨 위치 재계산
      state.wingmen = this.calculateWingmanPositions(
        state.leaderUnitId,
        state.wingmen.map(w => w.unitId),
        state.type
      );
      
      // 이벤트 발생
      this.emit('FORMATION_CHANGED', {
        fleetId,
        previousFormation,
        newFormation: state.type,
        timestamp: Date.now(),
      } as FormationChangeEvent);
      
      logger.info('[FleetFormationService] Formation change completed', {
        fleetId,
        from: previousFormation,
        to: state.type,
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 진형 상태 조회
   */
  getFormationState(fleetId: string): FormationState | undefined {
    return this.formationStates.get(fleetId);
  }
  
  /**
   * 현재 진형의 스탯 보정치 조회
   */
  getFormationModifiers(fleetId: string): FormationModifiers {
    const state = this.formationStates.get(fleetId);
    
    if (!state) {
      return FORMATION_MODIFIERS.STANDARD;
    }
    
    const baseModifiers = FORMATION_MODIFIERS[state.type];
    
    // 결속도에 따른 보정 (결속도 낮으면 효과 감소)
    const cohesionFactor = 0.5 + (state.cohesion / 200);  // 50% ~ 100%
    
    // 진형 변경 중이면 효과 감소
    const changingPenalty = state.isChanging ? 0.7 : 1.0;
    
    return {
      attackPower: baseModifiers.attackPower * cohesionFactor * changingPenalty,
      defensePower: baseModifiers.defensePower * cohesionFactor * changingPenalty,
      accuracy: baseModifiers.accuracy * cohesionFactor * changingPenalty,
      evasion: baseModifiers.evasion * cohesionFactor * changingPenalty,
      turnRate: baseModifiers.turnRate * changingPenalty,
      broadside: baseModifiers.broadside * cohesionFactor,
      exposedArea: baseModifiers.exposedArea,
      blindSpot: baseModifiers.blindSpot,
      penetration: baseModifiers.penetration * cohesionFactor * changingPenalty,
      speed: baseModifiers.speed * changingPenalty,
    };
  }
  
  // ============================================================
  // Advanced Maneuvers
  // ============================================================
  
  /**
   * 기동 명령 실행
   */
  executeManeuver(command: ManeuverCommand): {
    success: boolean;
    message: string;
    affectedUnits: string[];
  } {
    const affectedUnits: string[] = [];
    
    for (const unitId of command.unitIds) {
      // 이미 기동 중인지 확인
      if (this.maneuverStates.has(unitId)) {
        continue;
      }
      
      const duration = MANEUVER_DURATIONS[command.type];
      const penalties = MANEUVER_PENALTIES[command.type];
      
      const state: ManeuverState = {
        type: command.type,
        startTick: Date.now(),
        duration,
        progress: 0,
        speedPenalty: penalties.speed,
        evasionPenalty: penalties.evasion,
        params: {
          direction: command.params?.direction,
        },
      };
      
      this.maneuverStates.set(unitId, state);
      affectedUnits.push(unitId);
    }
    
    if (affectedUnits.length === 0) {
      return {
        success: false,
        message: '기동 가능한 유닛이 없습니다.',
        affectedUnits: [],
      };
    }
    
    logger.debug('[FleetFormationService] Maneuver started', {
      type: command.type,
      units: affectedUnits.length,
    });
    
    return {
      success: true,
      message: `${this.getManeuverName(command.type)} 기동 시작`,
      affectedUnits,
    };
  }
  
  /**
   * 기동 상태 업데이트 (매 틱)
   */
  updateManeuver(unitId: string, unit: UnitState, deltaTime: number): void {
    const maneuver = this.maneuverStates.get(unitId);
    
    if (!maneuver) return;
    
    // 진행도 업데이트
    const ticksPerSecond = TACTICAL_CONSTANTS.TICKS_PER_SECOND;
    const progressIncrement = (deltaTime * ticksPerSecond) / maneuver.duration;
    maneuver.progress = Math.min(1, maneuver.progress + progressIncrement);
    
    // 기동 타입별 처리
    switch (maneuver.type) {
      case 'PARALLEL_MOVE':
        this.processParallelMove(unit, maneuver, deltaTime);
        break;
        
      case 'TURN_180':
        this.processTurn180(unit, maneuver, deltaTime);
        break;
        
      case 'TURN_90_LEFT':
      case 'TURN_90_RIGHT':
        this.processTurn90(unit, maneuver, deltaTime);
        break;
    }
    
    // 기동 완료 체크
    if (maneuver.progress >= 1) {
      this.maneuverStates.delete(unitId);
      
      this.emit('MANEUVER_COMPLETE', {
        unitIds: [unitId],
        maneuverType: maneuver.type,
        success: true,
        timestamp: Date.now(),
      } as ManeuverCompleteEvent);
    }
  }
  
  /**
   * 평행 이동 (기수 유지한 채 벡터 이동)
   */
  private processParallelMove(unit: UnitState, maneuver: ManeuverState, deltaTime: number): void {
    if (!maneuver.params.direction) return;
    
    const dir = maneuver.params.direction;
    const spec = SHIP_SPECS[unit.shipClass];
    
    // 속도 50% 페널티 적용
    const maxSpeed = spec.speed * 10 * (1 - maneuver.speedPenalty);
    
    // 기존 방향 유지하면서 측면으로 이동
    // 기수(heading)는 변경하지 않음
    unit.velocity.x = dir.x * maxSpeed;
    unit.velocity.y = dir.y * maxSpeed;
    unit.velocity.z = dir.z * maxSpeed;
  }
  
  /**
   * 180도 반전 (제자리 회전)
   */
  private processTurn180(unit: UnitState, maneuver: ManeuverState, deltaTime: number): void {
    // 속도 0으로 (정지 상태에서 회전)
    unit.velocity = { x: 0, y: 0, z: 0 };
    
    // 목표 방향 계산 (시작 시 설정)
    if (maneuver.params.targetHeading === undefined) {
      // 현재 heading에서 180도 반대
      const currentYaw = Math.atan2(
        2 * (unit.rotation.w * unit.rotation.y + unit.rotation.x * unit.rotation.z),
        1 - 2 * (unit.rotation.y * unit.rotation.y + unit.rotation.z * unit.rotation.z)
      );
      maneuver.params.targetHeading = currentYaw + Math.PI;
    }
    
    // 회전 보간
    const targetYaw = maneuver.params.targetHeading;
    const t = this.easeInOutCubic(maneuver.progress);
    
    // 새 rotation 계산 (Y축 회전만)
    const halfAngle = (targetYaw * t) / 2;
    unit.rotation = {
      x: 0,
      y: Math.sin(halfAngle),
      z: 0,
      w: Math.cos(halfAngle),
    };
  }
  
  /**
   * 90도 회전
   */
  private processTurn90(unit: UnitState, maneuver: ManeuverState, deltaTime: number): void {
    // 속도 감소
    const speedFactor = 1 - maneuver.speedPenalty;
    unit.velocity.x *= speedFactor;
    unit.velocity.y *= speedFactor;
    unit.velocity.z *= speedFactor;
    
    // 목표 방향
    const angleOffset = maneuver.type === 'TURN_90_LEFT' ? -Math.PI / 2 : Math.PI / 2;
    
    if (maneuver.params.targetHeading === undefined) {
      const currentYaw = Math.atan2(
        2 * (unit.rotation.w * unit.rotation.y + unit.rotation.x * unit.rotation.z),
        1 - 2 * (unit.rotation.y * unit.rotation.y + unit.rotation.z * unit.rotation.z)
      );
      maneuver.params.targetHeading = currentYaw + angleOffset;
    }
    
    const targetYaw = maneuver.params.targetHeading;
    const t = this.easeInOutCubic(maneuver.progress);
    
    const halfAngle = (targetYaw * t) / 2;
    unit.rotation = {
      x: 0,
      y: Math.sin(halfAngle),
      z: 0,
      w: Math.cos(halfAngle),
    };
  }
  
  /**
   * 유닛의 기동 상태 조회
   */
  getManeuverState(unitId: string): ManeuverState | undefined {
    return this.maneuverStates.get(unitId);
  }
  
  /**
   * 기동 중 여부 확인
   */
  isManeuveringg(unitId: string): boolean {
    return this.maneuverStates.has(unitId);
  }
  
  /**
   * 기동 중 페널티 계수 조회
   */
  getManeuverPenalties(unitId: string): { speed: number; evasion: number } {
    const maneuver = this.maneuverStates.get(unitId);
    
    if (!maneuver) {
      return { speed: 0, evasion: 0 };
    }
    
    return {
      speed: maneuver.speedPenalty,
      evasion: maneuver.evasionPenalty,
    };
  }
  
  // ============================================================
  // Wingman / Boids Logic
  // ============================================================
  
  /**
   * 윙맨 위치 계산 (기함 기준 상대 좌표)
   */
  private calculateWingmanPositions(
    leaderUnitId: string,
    unitIds: string[],
    formation: FormationType
  ): WingmanPosition[] {
    const wingmen: WingmanPosition[] = [];
    const otherUnits = unitIds.filter(id => id !== leaderUnitId);
    
    // 진형별 배치 패턴
    const pattern = this.getFormationPattern(formation, otherUnits.length);
    
    for (let i = 0; i < otherUnits.length; i++) {
      const pos = pattern[i % pattern.length];
      const row = Math.floor(i / pattern.length);
      
      wingmen.push({
        unitId: otherUnits[i],
        offsetX: pos.x + (row * pos.x * 0.5),
        offsetY: pos.y,
        offsetZ: pos.z + (row * 50),  // 후방 배치
        role: pos.role,
      });
    }
    
    return wingmen;
  }
  
  /**
   * 진형별 배치 패턴 정의
   */
  private getFormationPattern(
    formation: FormationType,
    unitCount: number
  ): Array<{ x: number; y: number; z: number; role: WingmanPosition['role'] }> {
    switch (formation) {
      case 'SPINDLE':
        // 방추진: V자 형태로 뒤따름
        return [
          { x: -30, y: 0, z: -30, role: 'LEFT_WING' },
          { x: 30, y: 0, z: -30, role: 'RIGHT_WING' },
          { x: -60, y: 0, z: -60, role: 'LEFT_WING' },
          { x: 60, y: 0, z: -60, role: 'RIGHT_WING' },
          { x: 0, y: 0, z: -90, role: 'REARGUARD' },
        ];
        
      case 'LINE':
        // 횡열진: 수평 배치
        return [
          { x: -50, y: 0, z: 0, role: 'LEFT_WING' },
          { x: 50, y: 0, z: 0, role: 'RIGHT_WING' },
          { x: -100, y: 0, z: 0, role: 'LEFT_WING' },
          { x: 100, y: 0, z: 0, role: 'RIGHT_WING' },
          { x: -150, y: 0, z: 0, role: 'LEFT_WING' },
          { x: 150, y: 0, z: 0, role: 'RIGHT_WING' },
        ];
        
      case 'CIRCULAR':
        // 차륜진: 원형 배치
        const circlePositions = [];
        const radius = 80;
        const count = Math.max(6, unitCount);
        for (let i = 0; i < count; i++) {
          const angle = (2 * Math.PI * i) / count;
          circlePositions.push({
            x: Math.cos(angle) * radius,
            y: 0,
            z: Math.sin(angle) * radius,
            role: 'CENTER' as const,
          });
        }
        return circlePositions;
        
      case 'ECHELON':
        // 사선진: 대각선 배치
        return [
          { x: -40, y: 0, z: -30, role: 'LEFT_WING' },
          { x: -80, y: 0, z: -60, role: 'LEFT_WING' },
          { x: -120, y: 0, z: -90, role: 'LEFT_WING' },
          { x: 40, y: 0, z: 30, role: 'RIGHT_WING' },
          { x: 80, y: 0, z: 60, role: 'RIGHT_WING' },
        ];
        
      case 'WEDGE':
        // 쐐기진: 화살촉 형태
        return [
          { x: -25, y: 0, z: -25, role: 'LEFT_WING' },
          { x: 25, y: 0, z: -25, role: 'RIGHT_WING' },
          { x: -50, y: 0, z: -50, role: 'LEFT_WING' },
          { x: 50, y: 0, z: -50, role: 'RIGHT_WING' },
          { x: -75, y: 0, z: -75, role: 'LEFT_WING' },
          { x: 75, y: 0, z: -75, role: 'RIGHT_WING' },
        ];
        
      case 'ENCIRCLE':
        // 포위진: 넓은 원형
        const encirclePositions = [];
        const encircleRadius = 150;
        for (let i = 0; i < 8; i++) {
          const angle = (2 * Math.PI * i) / 8;
          encirclePositions.push({
            x: Math.cos(angle) * encircleRadius,
            y: 0,
            z: Math.sin(angle) * encircleRadius,
            role: 'CENTER' as const,
          });
        }
        return encirclePositions;
        
      case 'RETREAT':
        // 퇴각진: 후방 집중
        return [
          { x: -30, y: 0, z: 30, role: 'REARGUARD' },
          { x: 30, y: 0, z: 30, role: 'REARGUARD' },
          { x: 0, y: 0, z: 60, role: 'REARGUARD' },
          { x: -50, y: 0, z: 90, role: 'REARGUARD' },
          { x: 50, y: 0, z: 90, role: 'REARGUARD' },
        ];
        
      default:
        // 기본진: 간단한 종대
        return [
          { x: -40, y: 0, z: -20, role: 'LEFT_WING' },
          { x: 40, y: 0, z: -20, role: 'RIGHT_WING' },
          { x: 0, y: 0, z: -50, role: 'REARGUARD' },
          { x: -40, y: 0, z: -80, role: 'LEFT_WING' },
          { x: 40, y: 0, z: -80, role: 'RIGHT_WING' },
        ];
    }
  }
  
  /**
   * 윙맨 위치 업데이트 (Boids 알고리즘 기반)
   * @param units 모든 유닛 상태 맵
   * @param fleetId 함대 ID
   * @param deltaTime 경과 시간
   */
  updateWingmanPositions(
    units: Map<string, UnitState>,
    fleetId: string,
    deltaTime: number
  ): void {
    const formationState = this.formationStates.get(fleetId);
    if (!formationState) return;
    
    const leader = units.get(formationState.leaderUnitId);
    if (!leader) return;
    
    for (const wingman of formationState.wingmen) {
      const unit = units.get(wingman.unitId);
      if (!unit || unit.isDestroyed) continue;
      
      // 목표 위치 계산 (기함 위치 + 오프셋)
      const targetX = leader.position.x + wingman.offsetX;
      const targetY = leader.position.y + wingman.offsetY;
      const targetZ = leader.position.z + wingman.offsetZ;
      
      // Boids 스타일 조향
      const steering = this.calculateBoidsSteeringForUnit(unit, {
        targetPosition: { x: targetX, y: targetY, z: targetZ },
        leader,
        neighbors: this.getNeighborUnits(unit, units, 100),
        separation: 30,   // 분리 거리
        cohesion: 0.3,    // 결합력
        alignment: 0.2,   // 정렬력
      });
      
      // 조향력 적용
      const spec = SHIP_SPECS[unit.shipClass];
      const maxForce = spec.speed * 0.5;
      
      unit.velocity.x += Math.max(-maxForce, Math.min(maxForce, steering.x)) * deltaTime;
      unit.velocity.y += Math.max(-maxForce, Math.min(maxForce, steering.y)) * deltaTime;
      unit.velocity.z += Math.max(-maxForce, Math.min(maxForce, steering.z)) * deltaTime;
    }
    
    // 결속도 업데이트
    this.updateCohesion(units, fleetId);
  }
  
  /**
   * Boids 조향 벡터 계산
   */
  private calculateBoidsSteeringForUnit(
    unit: UnitState,
    params: {
      targetPosition: Vector3;
      leader: UnitState;
      neighbors: UnitState[];
      separation: number;
      cohesion: number;
      alignment: number;
    }
  ): Vector3 {
    const steering: Vector3 = { x: 0, y: 0, z: 0 };
    
    // 1. Seek (목표 위치로 이동)
    const seekForce = this.seek(unit, params.targetPosition);
    steering.x += seekForce.x * 1.5;
    steering.y += seekForce.y * 1.5;
    steering.z += seekForce.z * 1.5;
    
    // 2. Separation (이웃과 거리 유지)
    const separationForce = this.separate(unit, params.neighbors, params.separation);
    steering.x += separationForce.x * 2.0;
    steering.y += separationForce.y * 2.0;
    steering.z += separationForce.z * 2.0;
    
    // 3. Alignment (리더 방향으로 정렬)
    const alignmentForce = this.align(unit, params.leader);
    steering.x += alignmentForce.x * params.alignment;
    steering.y += alignmentForce.y * params.alignment;
    steering.z += alignmentForce.z * params.alignment;
    
    return steering;
  }
  
  /**
   * Seek 행동: 목표 위치로 이동
   */
  private seek(unit: UnitState, target: Vector3): Vector3 {
    const dx = target.x - unit.position.x;
    const dy = target.y - unit.position.y;
    const dz = target.z - unit.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < 1) return { x: 0, y: 0, z: 0 };
    
    // 정규화
    return {
      x: dx / distance,
      y: dy / distance,
      z: dz / distance,
    };
  }
  
  /**
   * Separation 행동: 이웃과 거리 유지
   */
  private separate(unit: UnitState, neighbors: UnitState[], minDistance: number): Vector3 {
    const force: Vector3 = { x: 0, y: 0, z: 0 };
    let count = 0;
    
    for (const neighbor of neighbors) {
      const dx = unit.position.x - neighbor.position.x;
      const dy = unit.position.y - neighbor.position.y;
      const dz = unit.position.z - neighbor.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance > 0 && distance < minDistance) {
        // 거리에 반비례하는 힘
        const strength = (minDistance - distance) / minDistance;
        force.x += (dx / distance) * strength;
        force.y += (dy / distance) * strength;
        force.z += (dz / distance) * strength;
        count++;
      }
    }
    
    if (count > 0) {
      force.x /= count;
      force.y /= count;
      force.z /= count;
    }
    
    return force;
  }
  
  /**
   * Alignment 행동: 리더 방향으로 정렬
   */
  private align(unit: UnitState, leader: UnitState): Vector3 {
    // 리더의 속도 방향으로 정렬
    const leaderSpeed = Math.sqrt(
      leader.velocity.x * leader.velocity.x +
      leader.velocity.y * leader.velocity.y +
      leader.velocity.z * leader.velocity.z
    );
    
    if (leaderSpeed < 0.1) return { x: 0, y: 0, z: 0 };
    
    return {
      x: leader.velocity.x / leaderSpeed - unit.velocity.x,
      y: leader.velocity.y / leaderSpeed - unit.velocity.y,
      z: leader.velocity.z / leaderSpeed - unit.velocity.z,
    };
  }
  
  /**
   * 이웃 유닛 조회
   */
  private getNeighborUnits(
    unit: UnitState,
    units: Map<string, UnitState>,
    radius: number
  ): UnitState[] {
    const neighbors: UnitState[] = [];
    
    for (const [id, other] of units) {
      if (id === unit.id || other.isDestroyed || other.factionId !== unit.factionId) {
        continue;
      }
      
      const dx = other.position.x - unit.position.x;
      const dy = other.position.y - unit.position.y;
      const dz = other.position.z - unit.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance <= radius) {
        neighbors.push(other);
      }
    }
    
    return neighbors;
  }
  
  /**
   * 결속도 업데이트
   */
  private updateCohesion(units: Map<string, UnitState>, fleetId: string): void {
    const state = this.formationStates.get(fleetId);
    if (!state) return;
    
    const leader = units.get(state.leaderUnitId);
    if (!leader) return;
    
    let totalDeviation = 0;
    let count = 0;
    
    for (const wingman of state.wingmen) {
      const unit = units.get(wingman.unitId);
      if (!unit || unit.isDestroyed) continue;
      
      // 목표 위치와의 편차 계산
      const targetX = leader.position.x + wingman.offsetX;
      const targetY = leader.position.y + wingman.offsetY;
      const targetZ = leader.position.z + wingman.offsetZ;
      
      const dx = unit.position.x - targetX;
      const dy = unit.position.y - targetY;
      const dz = unit.position.z - targetZ;
      const deviation = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      totalDeviation += deviation;
      count++;
    }
    
    if (count > 0) {
      const avgDeviation = totalDeviation / count;
      // 편차가 작을수록 결속도 높음 (최대 50 거리 기준)
      const newCohesion = Math.max(0, Math.min(100, 100 - (avgDeviation / 50) * 100));
      
      // 부드러운 변화
      state.cohesion = state.cohesion * 0.9 + newCohesion * 0.1;
    }
  }
  
  // ============================================================
  // Utility Functions
  // ============================================================
  
  /**
   * Easing 함수 (부드러운 전환)
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * 기동 이름 조회
   */
  private getManeuverName(type: ManeuverType): string {
    const names: Record<ManeuverType, string> = {
      PARALLEL_MOVE: '평행 이동',
      TURN_180: '반전',
      TURN_90_LEFT: '좌측 90도 회전',
      TURN_90_RIGHT: '우측 90도 회전',
      SPREAD: '전개',
      COMPRESS: '압축',
    };
    return names[type];
  }
  
  /**
   * 대형 상태 클리어
   */
  clearFormationState(fleetId: string): void {
    this.formationStates.delete(fleetId);
    logger.debug('[FleetFormationService] Formation state cleared', { fleetId });
  }
  
  /**
   * 기동 상태 클리어
   */
  clearManeuverState(unitId: string): void {
    this.maneuverStates.delete(unitId);
  }
  
  /**
   * 모든 상태 정리
   */
  cleanup(): void {
    this.formationStates.clear();
    this.maneuverStates.clear();
    this.removeAllListeners();
    logger.info('[FleetFormationService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const fleetFormationService = new FleetFormationService();








