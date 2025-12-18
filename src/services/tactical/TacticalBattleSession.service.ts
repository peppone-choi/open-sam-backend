/**
 * 전술전투 세션 관리 서비스
 * 전투 생성, 참여, 상태 관리
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  TacticalBattle, 
  ITacticalBattle,
  ITacticalUnit,
  BattleStatus,
  UnitStatus,
  UnitType,
  TerrainType,
  BattleParticipant,
  Position,
} from '../../models/tactical_battle.model';
import { TacticalMapGeneratorService } from './TacticalMapGenerator.service';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { GameUnitConst, ARM_TYPE } from '../../const/GameUnitConst';

// ============================================================
// 인터페이스
// ============================================================

export interface CreateBattleParams {
  sessionId: string;
  cityId: number;
  attackerNationId: number;
  attackerGenerals: number[];  // 장수 ID 목록
  defenderNationId: number;
  defenderGenerals: number[];
  attackerUserId?: string;
  defenderUserId?: string;
  maxWaitTime?: number;  // 대기 시간 (초) - 전략 턴 주기와 연동
}

export interface JoinBattleParams {
  battleId: string;
  side: 'attacker' | 'defender';
  userId: string;
  aiStrategy?: 'aggressive' | 'defensive' | 'balanced';
}

// ============================================================
// 서비스
// ============================================================

export class TacticalBattleSessionService {
  
  /**
   * 전투 세션 생성
   */
  static async createSession(params: CreateBattleParams): Promise<ITacticalBattle> {
    const {
      sessionId,
      cityId,
      attackerNationId,
      attackerGenerals,
      defenderNationId,
      defenderGenerals,
      attackerUserId,
      defenderUserId,
      maxWaitTime: customMaxWaitTime,
    } = params;
    
    // 0. 세션에서 전술전투 설정 가져오기
    // - maxWaitTime: 대기 시간 = 전략 턴 주기 (초)
    // - maxTurns: 최대 전술턴 수 (서버별 설정, 기본 15)
    // - turnTimeLimit: 전술턴당 시간 = 전략턴(초) / 최대전술턴
    let maxWaitTime = customMaxWaitTime ?? 300; // 기본 5분 (300초)
    let maxTurns = 15; // 기본 15턴
    let turnTimeLimit = 20; // 기본 20초
    
    try {
      const { sessionRepository } = await import('../../repositories/session.repository');
      const session = await sessionRepository.findBySessionId(sessionId);
      if (session) {
        const sessionData = (session as any).data ?? {};
        
        // turnterm은 분 단위 → 초 단위로 변환
        const turntermMinutes = (session as any).turnterm ?? sessionData.turnterm ?? 5;
        maxWaitTime = turntermMinutes * 60; // 분 → 초 변환
        
        // 전술전투 최대 턴 수 (서버 설정, 기본 15)
        maxTurns = sessionData.tacticalMaxTurns ?? sessionData.game_env?.tacticalMaxTurns ?? 15;
        
        // 전술턴 시간 = 전략턴(초) / 최대전술턴 (최소 10초)
        turnTimeLimit = Math.max(10, Math.floor(maxWaitTime / maxTurns));
        
        console.log(`[TacticalBattle] 세션 설정 - 전략턴: ${turntermMinutes}분, 최대전술턴: ${maxTurns}, 턴당시간: ${turnTimeLimit}초`);
      }
    } catch (e) {
      console.warn('[TacticalBattle] 세션 설정 조회 실패, 기본값 사용:', e);
    }
    
    // 1. 도시 정보 조회
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    if (!city) {
      throw new Error(`도시를 찾을 수 없습니다: ${cityId}`);
    }
    
    // 2. 국가 정보 조회
    const attackerNation = await nationRepository.findByNationNum(sessionId, attackerNationId);
    const defenderNation = defenderNationId > 0 
      ? await nationRepository.findByNationNum(sessionId, defenderNationId)
      : null;
    
    // 3. 맵 생성
    const cityLevel = (city as any).level ?? 5;
    const terrain = TacticalMapGeneratorService.generateByCity(cityLevel);
    
    // 4. 참여자 정보 구성
    const attacker: BattleParticipant = {
      nationId: attackerNationId,
      nationName: (attackerNation as any)?.name || '공격군',
      nationColor: this.getNationColor(attackerNation),
      generals: attackerGenerals,
      userId: attackerUserId,
      isUserControlled: !!attackerUserId,
    };
    
    const defender: BattleParticipant = {
      nationId: defenderNationId,
      nationName: (defenderNation as any)?.name || '수비군',
      nationColor: this.getNationColor(defenderNation),
      generals: defenderGenerals,
      userId: defenderUserId,
      isUserControlled: !!defenderUserId,
    };
    
    // 5. 유닛 생성
    const units: ITacticalUnit[] = [];
    
    // 공격측 유닛
    const attackerSpawns = TacticalMapGeneratorService.getAttackerSpawnPoints(terrain);
    for (let i = 0; i < attackerGenerals.length; i++) {
      const generalId = attackerGenerals[i];
      const spawn = attackerSpawns[i % attackerSpawns.length];
      const unit = await this.createUnitFromGeneral(sessionId, generalId, 'attacker', attackerNationId, spawn);
      if (unit) {
        units.push(unit);
      }
    }
    
    // 방어측 유닛
    const defenderSpawns = TacticalMapGeneratorService.getDefenderSpawnPoints(terrain);
    for (let i = 0; i < defenderGenerals.length; i++) {
      const generalId = defenderGenerals[i];
      const spawn = defenderSpawns[i % defenderSpawns.length];
      const unit = await this.createUnitFromGeneral(sessionId, generalId, 'defender', defenderNationId, spawn);
      if (unit) {
        units.push(unit);
      }
    }
    
    // 성문/성벽 유닛 (방어측)
    const gatePositions = TacticalMapGeneratorService.getGatePositions(terrain);
    for (let i = 0; i < gatePositions.length; i++) {
      const gatePos = gatePositions[i];
      const gateCell = terrain[gatePos.y][gatePos.x];
      units.push({
        id: `gate_${i}`,
        generalId: 0,
        name: `성문 ${i + 1}`,
        side: 'defender',
        nationId: defenderNationId,
        position: gatePos,
        hp: gateCell.hp || 5000,
        maxHp: gateCell.maxHp || 5000,
        morale: 100,
        status: UnitStatus.ACTIVE,
        unitType: UnitType.GATE,
        attack: 0,
        defense: 50,
        speed: 0,
        actionPoints: 0,
        maxActionPoints: 0,
        hasMoved: true,
        hasActed: true,
      });
    }
    
    // 6. 전투 세션 저장
    const battleId = `tactical_${uuidv4()}`;
    const battle = new TacticalBattle({
      session_id: sessionId,
      battle_id: battleId,
      cityId,
      cityName: (city as any).name || `도시${cityId}`,
      status: BattleStatus.WAITING,
      mapWidth: 20,
      mapHeight: 20,
      terrain,
      attacker,
      defender,
      units,
      currentTurn: 0,
      currentSide: 'attacker',
      turnTimeLimit,  // 전술턴당 시간 (세션 설정 기반)
      maxTurns,       // 최대 전술턴 수 (세션 설정 기반)
      maxWaitTime,    // 대기 시간 = 전략 턴 주기
      actionLogs: [],
    });
    
    await battle.save();
    
    console.log(`[TacticalBattle] 전투 세션 생성: ${battleId} (${(city as any).name})`);
    
    return battle;
  }
  
  /**
   * 장수 정보로 유닛 생성
   */
  private static async createUnitFromGeneral(
    sessionId: string,
    generalId: number,
    side: 'attacker' | 'defender',
    nationId: number,
    position: Position
  ): Promise<ITacticalUnit | null> {
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
    if (!general) {
      console.warn(`[TacticalBattle] 장수를 찾을 수 없음: ${generalId}`);
      return null;
    }
    
    const data = general as any;
    const crewTypeId = data.crewtype ?? data.data?.crewtype ?? 0;
    const unitType = this.getUnitTypeFromCrewType(crewTypeId);
    
    // 장수 스탯 기반으로 유닛 스탯 계산
    const leadership = data.leadership ?? data.data?.leadership ?? 50;
    const strength = data.strength ?? data.data?.strength ?? 50;
    const intel = data.intel ?? data.data?.intel ?? 50;
    const crew = data.crew ?? data.data?.crew ?? 1000;
    
    return {
      id: `unit_${generalId}`,
      generalId,
      name: data.name || `장수${generalId}`,
      side,
      nationId,
      position,
      hp: crew,
      maxHp: crew,
      morale: data.atmos ?? data.data?.atmos ?? 100,
      status: UnitStatus.ACTIVE,
      unitType,
      crewTypeId,
      attack: Math.round(strength + leadership / 2),
      defense: Math.round(intel + leadership / 2),
      speed: Math.round(50 + leadership / 5),
      actionPoints: 2,
      maxActionPoints: 2,
      hasMoved: false,
      hasActed: false,
    };
  }
  
  /**
   * 병종 ID로 유닛 타입 결정
   */
  private static getUnitTypeFromCrewType(crewTypeId: number): UnitType {
    try {
      const unit = GameUnitConst.byID(crewTypeId);
      if (!unit) return UnitType.INFANTRY;
      
      switch (unit.armType) {
        case ARM_TYPE.CAVALRY:
          return UnitType.CAVALRY;
        case ARM_TYPE.ARCHER:
          return UnitType.ARCHER;
        case ARM_TYPE.SIEGE:
          return UnitType.SIEGE;
        default:
          return UnitType.INFANTRY;
      }
    } catch {
      return UnitType.INFANTRY;
    }
  }
  
  /**
   * 국가 색상 가져오기
   */
  private static getNationColor(nation: any): string {
    if (!nation) return '#888888';
    const color = nation.color ?? nation.data?.color ?? 0;
    if (typeof color === 'string') {
      return color.startsWith('#') ? color : `#${color}`;
    }
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  
  /**
   * 전투 세션 조회
   */
  static async getSession(battleId: string): Promise<ITacticalBattle | null> {
    return TacticalBattle.findOne({ battle_id: battleId });
  }
  
  /**
   * 세션의 진행 중인 전투 목록 조회
   */
  static async getActiveBattles(sessionId: string): Promise<ITacticalBattle[]> {
    return TacticalBattle.find({
      session_id: sessionId,
      status: { $in: [BattleStatus.WAITING, BattleStatus.READY, BattleStatus.ONGOING] },
    }).sort({ createdAt: -1 });
  }
  
  /**
   * 유저가 참여 가능한 전투 목록
   */
  static async getBattlesForUser(sessionId: string, nationId: number): Promise<ITacticalBattle[]> {
    return TacticalBattle.find({
      session_id: sessionId,
      status: { $in: [BattleStatus.WAITING, BattleStatus.ONGOING] },
      $or: [
        { 'attacker.nationId': nationId },
        { 'defender.nationId': nationId },
      ],
    }).sort({ createdAt: -1 });
  }
  
  /**
   * 전투 참여
   */
  static async joinBattle(params: JoinBattleParams): Promise<ITacticalBattle> {
    const { battleId, side, userId, aiStrategy } = params;
    
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다');
    }
    
    if (battle.status !== BattleStatus.WAITING && battle.status !== BattleStatus.READY) {
      throw new Error('참여할 수 없는 상태입니다');
    }
    
    // 해당 진영에 유저 배정
    if (side === 'attacker') {
      battle.attacker.userId = userId;
      battle.attacker.isUserControlled = true;
      if (aiStrategy) battle.attacker.aiStrategy = aiStrategy;
    } else {
      battle.defender.userId = userId;
      battle.defender.isUserControlled = true;
      if (aiStrategy) battle.defender.aiStrategy = aiStrategy;
    }
    
    // 양측 모두 준비되면 READY 상태로
    if (battle.attacker.isUserControlled || !battle.attacker.generals.length) {
      if (battle.defender.isUserControlled || !battle.defender.generals.length) {
        battle.status = BattleStatus.READY;
      }
    }
    
    await battle.save();
    
    console.log(`[TacticalBattle] 유저 참여: ${userId} → ${battleId} (${side})`);
    
    return battle;
  }
  
  /**
   * AI에게 위임
   */
  static async delegateToAI(battleId: string, side: 'attacker' | 'defender', strategy: 'aggressive' | 'defensive' | 'balanced' = 'balanced'): Promise<ITacticalBattle> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다');
    }
    
    if (side === 'attacker') {
      battle.attacker.isUserControlled = false;
      battle.attacker.aiStrategy = strategy;
    } else {
      battle.defender.isUserControlled = false;
      battle.defender.aiStrategy = strategy;
    }
    
    await battle.save();
    
    console.log(`[TacticalBattle] AI 위임: ${battleId} (${side}, ${strategy})`);
    
    return battle;
  }
  
  /**
   * 전투 시작
   */
  static async startBattle(battleId: string): Promise<ITacticalBattle> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다');
    }
    
    if (battle.status !== BattleStatus.WAITING && battle.status !== BattleStatus.READY) {
      throw new Error('시작할 수 없는 상태입니다');
    }
    
    battle.status = BattleStatus.ONGOING;
    battle.currentTurn = 1;
    battle.currentSide = 'attacker';
    battle.battleStartAt = new Date();
    battle.turnStartedAt = new Date();
    
    // 모든 유닛 행동력 초기화
    for (const unit of battle.units) {
      unit.actionPoints = unit.maxActionPoints;
      unit.hasMoved = false;
      unit.hasActed = false;
    }
    
    await battle.save();
    
    console.log(`[TacticalBattle] 전투 시작: ${battleId}`);
    
    return battle;
  }
  
  /**
   * 전투 종료
   */
  static async finishBattle(
    battleId: string, 
    winner: 'attacker' | 'defender' | 'draw',
    result: { attackerCasualties: number; defenderCasualties: number; cityOccupied: boolean }
  ): Promise<ITacticalBattle> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) {
      throw new Error('전투를 찾을 수 없습니다');
    }
    
    battle.status = BattleStatus.FINISHED;
    battle.winner = winner;
    battle.result = result;
    battle.finishedAt = new Date();
    
    await battle.save();
    
    console.log(`[TacticalBattle] 전투 종료: ${battleId} (승자: ${winner})`);
    
    return battle;
  }
  
  /**
   * 대기 시간 초과 전투 자동 시작
   */
  static async checkAndStartTimedOutBattles(sessionId: string): Promise<void> {
    const now = new Date();
    
    const waitingBattles = await TacticalBattle.find({
      session_id: sessionId,
      status: BattleStatus.WAITING,
    });
    
    for (const battle of waitingBattles) {
      const waitTime = (now.getTime() - battle.createdAt.getTime()) / 1000;
      
      if (waitTime >= battle.maxWaitTime) {
        console.log(`[TacticalBattle] 대기 시간 초과, 자동 시작: ${battle.battle_id}`);
        await this.startBattle(battle.battle_id);
      }
    }
  }
}

