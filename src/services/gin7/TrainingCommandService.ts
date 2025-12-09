/**
 * TrainingCommandService - 훈련 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 훈련 커맨드:
 * - MAINTAIN_DISCIPLINE (군기유지): 혼란율 감소
 * - TRAIN_FLEET (항주훈련): 훈련도 증가
 * - TRAIN_GROUND (육전훈련): 육전 훈련도 증가
 * - TRAIN_AIR (공전훈련): 공전 훈련도 증가
 * - TACTICS_GROUND (육전전술훈련): 육전 스킬 습득
 * - TACTICS_AIR (공전전술훈련): 공전 스킬 습득
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { COMMAND_DEFINITIONS, ICommandDefinition } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface TrainingRequest {
  sessionId: string;
  characterId: string;    // 실행자
  fleetId: string;        // 대상 함대
  commandId: string;      // 훈련 커맨드 ID
}

export interface TrainingResult {
  success: boolean;
  commandId: string;
  fleetId: string;
  previousValue: number;
  newValue: number;
  cpCost: number;
  error?: string;
}

// 훈련도 타입
export type TrainingType = 'discipline' | 'navigation' | 'ground' | 'air';

// 훈련도 증가량
const TRAINING_INCREMENTS: Record<string, { type: TrainingType; increment: number }> = {
  MAINTAIN_DISCIPLINE: { type: 'discipline', increment: 5 },
  TRAIN_FLEET: { type: 'navigation', increment: 3 },
  TRAIN_GROUND: { type: 'ground', increment: 3 },
  TRAIN_AIR: { type: 'air', increment: 3 },
};

// 최대 훈련도
const MAX_TRAINING = 100;

// ============================================================
// TrainingCommandService Class
// ============================================================

export class TrainingCommandService extends EventEmitter {
  private static instance: TrainingCommandService;

  private constructor() {
    super();
    logger.info('[TrainingCommandService] Initialized');
  }

  public static getInstance(): TrainingCommandService {
    if (!TrainingCommandService.instance) {
      TrainingCommandService.instance = new TrainingCommandService();
    }
    return TrainingCommandService.instance;
  }

  // ============================================================
  // 훈련 커맨드 실행
  // ============================================================

  /**
   * 훈련 커맨드 실행
   */
  public async executeTraining(request: TrainingRequest): Promise<TrainingResult> {
    const { sessionId, characterId, fleetId, commandId } = request;

    // 1. 커맨드 정의 확인
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    if (!commandDef || commandDef.category !== 'TRAINING') {
      return { 
        success: false, 
        commandId, 
        fleetId, 
        previousValue: 0, 
        newValue: 0, 
        cpCost: 0, 
        error: '유효하지 않은 훈련 커맨드입니다.' 
      };
    }

    // 2. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { 
        success: false, 
        commandId, 
        fleetId, 
        previousValue: 0, 
        newValue: 0, 
        cpCost: commandDef.cost, 
        error: '함대를 찾을 수 없습니다.' 
      };
    }

    // 3. 실행자 확인 및 권한 체크
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { 
        success: false, 
        commandId, 
        fleetId, 
        previousValue: 0, 
        newValue: 0, 
        cpCost: commandDef.cost, 
        error: '캐릭터를 찾을 수 없습니다.' 
      };
    }

    // 4. 훈련 실행
    const trainingInfo = TRAINING_INCREMENTS[commandId];
    if (!trainingInfo) {
      return { 
        success: false, 
        commandId, 
        fleetId, 
        previousValue: 0, 
        newValue: 0, 
        cpCost: commandDef.cost, 
        error: '훈련 정보를 찾을 수 없습니다.' 
      };
    }

    // 5. 훈련도 적용
    const result = await this.applyTraining(fleet, trainingInfo.type, trainingInfo.increment);

    // 6. 이벤트 발생
    this.emit('training:completed', {
      sessionId,
      characterId,
      fleetId,
      commandId,
      trainingType: trainingInfo.type,
      increment: trainingInfo.increment,
      newValue: result.newValue,
    });

    logger.info(`[TrainingCommandService] ${commandId} executed on fleet ${fleetId}: ${result.previousValue} -> ${result.newValue}`);

    return {
      success: true,
      commandId,
      fleetId,
      previousValue: result.previousValue,
      newValue: result.newValue,
      cpCost: commandDef.cost,
    };
  }

  /**
   * 훈련도 적용
   */
  private async applyTraining(
    fleet: IFleet,
    trainingType: TrainingType,
    increment: number,
  ): Promise<{ previousValue: number; newValue: number }> {
    // 훈련도 필드 초기화 (없으면)
    if (!fleet.training) {
      fleet.training = {
        gunnery: 50,
        navigation: 50,
        engineering: 50,
        boarding: 50,
        discipline: 50,
        ground: 50,
        air: 50,
      };
    }

    const previousValue = fleet.training[trainingType] || 50;
    const newValue = Math.min(MAX_TRAINING, previousValue + increment);

    fleet.training[trainingType] = newValue;
    await fleet.save();

    return { previousValue, newValue };
  }

  // ============================================================
  // 전술 스킬 습득
  // ============================================================

  /**
   * 전술 훈련 (스킬 습득)
   */
  public async executeTacticsTraining(request: TrainingRequest): Promise<{
    success: boolean;
    skillLearned?: string;
    error?: string;
  }> {
    const { sessionId, characterId, commandId } = request;

    // 1. 커맨드 확인
    if (commandId !== 'TACTICS_GROUND' && commandId !== 'TACTICS_AIR') {
      return { success: false, error: '유효하지 않은 전술 훈련 커맨드입니다.' };
    }

    // 2. 캐릭터 확인
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 3. 스킬 풀에서 랜덤 선택
    const skillPool = commandId === 'TACTICS_GROUND' 
      ? GROUND_TACTICS_SKILLS 
      : AIR_TACTICS_SKILLS;

    // 이미 보유한 스킬 제외
    const characterSkills = character.skills || [];
    const availableSkills = skillPool.filter(s => !characterSkills.includes(s));

    if (availableSkills.length === 0) {
      return { success: false, error: '모든 전술 스킬을 이미 습득했습니다.' };
    }

    // 4. 랜덤 스킬 습득
    const randomIndex = Math.floor(Math.random() * availableSkills.length);
    const newSkill = availableSkills[randomIndex];

    character.skills = [...characterSkills, newSkill];
    await character.save();

    // 5. 이벤트 발생
    this.emit('skill:learned', {
      sessionId,
      characterId,
      characterName: character.name,
      skillId: newSkill,
      commandId,
    });

    logger.info(`[TrainingCommandService] ${character.name} learned skill: ${newSkill}`);

    return {
      success: true,
      skillLearned: newSkill,
    };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 함대 훈련도 조회
   */
  public async getFleetTraining(sessionId: string, fleetId: string): Promise<{
    discipline: number;
    navigation: number;
    ground: number;
    air: number;
  } | null> {
    const fleet = await Fleet.findOne({ sessionId, fleetId }).lean();
    if (!fleet) return null;

    return {
      discipline: fleet.training?.discipline ?? 50,
      navigation: fleet.training?.navigation ?? 50,
      ground: fleet.training?.ground ?? 50,
      air: fleet.training?.air ?? 50,
    };
  }

  /**
   * 캐릭터 전술 스킬 조회
   */
  public async getCharacterSkills(sessionId: string, characterId: string): Promise<string[]> {
    const character = await Gin7Character.findOne({ sessionId, characterId }).lean();
    return character?.skills || [];
  }
}

// ============================================================
// 전술 스킬 정의
// ============================================================

const GROUND_TACTICS_SKILLS = [
  'ASSAULT',           // 강습
  'DEFENSIVE_LINE',    // 방어진
  'SIEGE_WARFARE',     // 공성전
  'URBAN_COMBAT',      // 시가전
  'INFILTRATION',      // 침투
  'AMBUSH',            // 매복
  'FORTIFICATION',     // 요새화
];

const AIR_TACTICS_SKILLS = [
  'DOGFIGHT',          // 공중전
  'BOMBER_RUN',        // 폭격
  'INTERCEPTION',      // 요격
  'RECONNAISSANCE',    // 정찰
  'CARRIER_STRIKE',    // 항모 타격
  'FORMATION_FLYING',  // 편대비행
  'EVASIVE_MANEUVER',  // 회피기동
];

export const trainingCommandService = TrainingCommandService.getInstance();
export default TrainingCommandService;





