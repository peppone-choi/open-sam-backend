/**
 * CharacterDeathService - 전사 시스템
 * 매뉴얼 2396-2399행: "戦死の概念"
 *
 * 매뉴얼 내용:
 * "『銀河英雄伝説Ⅶ』では、キャラクターが戦死するケースはプレイヤーの選択に委ねられています。
 * 通常は、自分の帰還が撃破されてもキャラクターが死亡することはありません。
 * この場合は「キャラクターの負傷」という処理が実行され、設定してある「帰還惑星」に瞬時にワープします"
 *
 * (戦死は現在未実装となっております) - 우리가 구현!
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet, IShipUnit } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

/**
 * 기함 상실 시 사기 감소량 정의
 */
const FLAGSHIP_LOSS_MORALE_PENALTIES = {
  FLAGSHIP_DESTROYED: 30,       // 기함 격파 시 기본 사기 감소
  NO_REPLACEMENT_FOUND: 10,     // 대체 기함 미선정 시 추가 감소
  COMMANDER_DEATH: 20,          // 사령관 전사 시 추가 감소
  COMMANDER_INJURY: 10,         // 사령관 부상 시 추가 감소
};

/**
 * 사기 수준에 따른 혼란 레벨 임계값
 * 기함 격침 시 적용
 */
const MORALE_CONFUSION_THRESHOLDS = {
  ROUTED: 20,      // 사기 20 미만: 패주
  SEVERE: 40,      // 사기 40 미만: 심각한 혼란
  MODERATE: 60,    // 사기 60 미만: 보통 혼란
  MINOR: 80,       // 사기 80 미만: 경미한 혼란
  // 80 이상: 정상 (NONE)
};

type ConfusionLevelType = 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'ROUTED';

/**
 * 기함 선정 우선순위 (높을수록 우선)
 */
const FLAGSHIP_PRIORITY: Record<string, number> = {
  flagship: 100,      // 기함급
  battleship: 80,     // 전함
  carrier: 70,        // 항공모함
  cruiser: 50,        // 순양함
  destroyer: 30,      // 구축함
  frigate: 20,        // 프리깃
  corvette: 10,       // 초계함
  transport: 5,       // 수송함
  engineering: 5,     // 공병함
};

/**
 * 전사 설정
 */
export interface DeathSettings {
  characterId: string;
  sessionId: string;
  
  // 전사 허용 여부 (플레이어 선택)
  deathEnabled: boolean;
  
  // 확률 설정
  injuryThreshold: number;        // 부상 확률 기준 (0-100)
  deathThreshold: number;         // 전사 확률 기준 (0-100)
  
  // 귀환 설정
  returnPlanetId: string;         // 귀환 행성
  returnPlanetName: string;
  
  // 추가 설정
  autoEvacuate: boolean;          // 기함 HP 낮을 때 자동 철수
  evacuateThreshold: number;      // 자동 철수 HP 비율 (%)
}

/**
 * 전투 사상 기록
 */
export interface CombatCasualty {
  casualtyId: string;
  sessionId: string;
  battleId: string;
  characterId: string;
  characterName: string;
  faction: string;
  
  // 사상 유형
  eventType: 'INJURY' | 'DEATH' | 'CAPTURED' | 'MISSING';
  
  // 상세 정보
  flagshipDestroyed: boolean;
  flagshipName?: string;
  causeOfDeath?: string;
  killerCharacterId?: string;
  killerCharacterName?: string;
  
  // 위치
  locationGridId: string;
  locationPlanetId?: string;
  
  // 시간
  timestamp: Date;
  
  // 결과
  returnedTo?: string;            // 부상 시 귀환 위치
  respawnDate?: Date;             // 부활 가능 시점 (하드코어 모드)
}

/**
 * 사망 결과
 */
export interface DeathResult {
  survived: boolean;
  casualtyType: CombatCasualty['eventType'] | 'SURVIVED';
  casualty?: CombatCasualty;
  message: string;
}

/**
 * CharacterDeathService 클래스
 */
export class CharacterDeathService extends EventEmitter {
  private static instance: CharacterDeathService;
  
  private deathSettings: Map<string, DeathSettings[]> = new Map(); // sessionId -> DeathSettings[]
  private casualties: Map<string, CombatCasualty[]> = new Map(); // sessionId -> CombatCasualty[]

  private constructor() {
    super();
    logger.info('[CharacterDeathService] Initialized - 매뉴얼 미구현 기능 완성');
  }

  public static getInstance(): CharacterDeathService {
    if (!CharacterDeathService.instance) {
      CharacterDeathService.instance = new CharacterDeathService();
    }
    return CharacterDeathService.instance;
  }

  // ==================== 초기화 ====================

  public initializeSession(sessionId: string): void {
    this.deathSettings.set(sessionId, []);
    this.casualties.set(sessionId, []);
    logger.info(`[CharacterDeathService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.deathSettings.delete(sessionId);
    this.casualties.delete(sessionId);
    logger.info(`[CharacterDeathService] Session ${sessionId} cleaned up`);
  }

  // ==================== 전사 설정 ====================

  /**
   * 캐릭터 전사 설정
   * 매뉴얼: "キャラクターが戦死するケースはプレイヤーの選択に委ねられています"
   */
  public async setDeathSettings(
    sessionId: string,
    characterId: string,
    settings: Partial<DeathSettings>,
  ): Promise<{ success: boolean; settings?: DeathSettings; error?: string }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    const existingSettings = this.getDeathSettings(sessionId, characterId);
    
    const newSettings: DeathSettings = {
      characterId,
      sessionId,
      deathEnabled: settings.deathEnabled ?? existingSettings?.deathEnabled ?? false, // 기본: 전사 비활성화
      injuryThreshold: settings.injuryThreshold ?? existingSettings?.injuryThreshold ?? 70,
      deathThreshold: settings.deathThreshold ?? existingSettings?.deathThreshold ?? 30,
      returnPlanetId: settings.returnPlanetId ?? existingSettings?.returnPlanetId ?? (character.homePlanetId || ''),
      returnPlanetName: settings.returnPlanetName ?? existingSettings?.returnPlanetName ?? '본거지',
      autoEvacuate: settings.autoEvacuate ?? existingSettings?.autoEvacuate ?? true,
      evacuateThreshold: settings.evacuateThreshold ?? existingSettings?.evacuateThreshold ?? 20,
    };

    // 기존 설정 업데이트 또는 추가
    const allSettings = this.deathSettings.get(sessionId) || [];
    const index = allSettings.findIndex(s => s.characterId === characterId);
    if (index > -1) {
      allSettings[index] = newSettings;
    } else {
      allSettings.push(newSettings);
    }
    this.deathSettings.set(sessionId, allSettings);

    this.emit('death:settingsUpdated', { sessionId, characterId, settings: newSettings });
    logger.info(`[CharacterDeathService] Death settings updated for ${character.name}: deathEnabled=${newSettings.deathEnabled}`);

    return { success: true, settings: newSettings };
  }

  // ==================== 기함 격파 판정 ====================

  /**
   * 기함 격파 시 사상 판정
   * 매뉴얼: "自分の帰還が撃破されてもキャラクターが死亡することはありません。
   *         この場合は「キャラクターの負傷」という処理が実行され、
   *         設定してある「帰還惑星」に瞬時にワープします"
   */
  public async processFlagshipDestroyed(
    sessionId: string,
    battleId: string,
    characterId: string,
    flagshipName: string,
    locationGridId: string,
    killerCharacterId?: string,
    killerCharacterName?: string,
  ): Promise<DeathResult> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { survived: false, casualtyType: 'DEATH', message: '캐릭터를 찾을 수 없습니다.' };
    }

    const settings = this.getDeathSettings(sessionId, characterId) || this.getDefaultSettings(sessionId, characterId);

    // 전사 비활성화 시 무조건 부상 처리
    if (!settings.deathEnabled) {
      return await this.processInjury(sessionId, battleId, character, flagshipName, locationGridId, settings);
    }

    // 전사 활성화 시 확률 판정
    const roll = Math.random() * 100;

    if (roll < settings.deathThreshold) {
      // 전사
      return await this.processDeath(sessionId, battleId, character, flagshipName, locationGridId, 
        killerCharacterId, killerCharacterName);
    } else if (roll < settings.deathThreshold + settings.injuryThreshold) {
      // 부상
      return await this.processInjury(sessionId, battleId, character, flagshipName, locationGridId, settings);
    } else {
      // 생존 (탈출 성공)
      return await this.processEscape(sessionId, battleId, character, flagshipName, locationGridId, settings);
    }
  }

  /**
   * 전사 처리
   */
  private async processDeath(
    sessionId: string,
    battleId: string,
    character: IGin7Character,
    flagshipName: string,
    locationGridId: string,
    killerCharacterId?: string,
    killerCharacterName?: string,
  ): Promise<DeathResult> {
    const casualty: CombatCasualty = {
      casualtyId: `CASUALTY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      battleId,
      characterId: character.characterId,
      characterName: character.name,
      faction: character.faction,
      eventType: 'DEATH',
      flagshipDestroyed: true,
      flagshipName,
      causeOfDeath: '기함 격파로 인한 전사',
      killerCharacterId,
      killerCharacterName,
      locationGridId,
      timestamp: new Date(),
    };

    this.casualties.get(sessionId)?.push(casualty);

    // 기함 교체 및 사기 감소 로직 (사령관 전사로 인한 추가 사기 감소)
    const flagshipResult = await this.processFlagshipReplacementAndMorale(
      sessionId,
      character.characterId,
      'DEATH',
    );

    // 캐릭터 사망 처리
    character.isAlive = false;
    character.deathDate = new Date();
    character.deathReason = casualty.causeOfDeath;
    await character.save();

    this.emit('death:characterDied', { 
      sessionId, 
      casualty,
      flagshipReplacement: flagshipResult,
    });
    logger.warn(`[CharacterDeathService] ${character.name} has died in battle! Fleet morale -${flagshipResult.moraleReduction}`);

    let message = `${character.name}이(가) ${flagshipName}의 격파와 함께 전사했습니다.`;
    if (flagshipResult.fleetAffected) {
      message += ` 함대 사기가 ${flagshipResult.moraleReduction}% 감소했습니다.`;
    }

    return {
      survived: false,
      casualtyType: 'DEATH',
      casualty,
      message,
    };
  }

  /**
   * 부상 처리
   * 매뉴얼: "「キャラクターの負傷」という処理が実行され、設定してある「帰還惑星」に瞬時にワープします"
   */
  private async processInjury(
    sessionId: string,
    battleId: string,
    character: IGin7Character,
    flagshipName: string,
    locationGridId: string,
    settings: DeathSettings,
  ): Promise<DeathResult> {
    const casualty: CombatCasualty = {
      casualtyId: `CASUALTY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      battleId,
      characterId: character.characterId,
      characterName: character.name,
      faction: character.faction,
      eventType: 'INJURY',
      flagshipDestroyed: true,
      flagshipName,
      causeOfDeath: '기함 격파로 인한 부상',
      locationGridId,
      timestamp: new Date(),
      returnedTo: settings.returnPlanetId,
    };

    this.casualties.get(sessionId)?.push(casualty);

    // 기함 교체 및 사기 감소 로직 (부상으로 인한 추가 사기 감소)
    const flagshipResult = await this.processFlagshipReplacementAndMorale(
      sessionId,
      character.characterId,
      'INJURY',
    );

    // 캐릭터 부상 처리
    character.status = 'INJURED';
    character.locationPlanetId = settings.returnPlanetId;
    character.injuryDetails = {
      injuredBy: 'FLAGSHIP_DESTRUCTION',
      injuredAt: new Date(),
      severity: 'MODERATE',
      recoveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
    };
    await character.save();

    this.emit('death:characterInjured', { 
      sessionId, 
      casualty,
      flagshipReplacement: flagshipResult,
    });
    logger.info(`[CharacterDeathService] ${character.name} injured and returned to ${settings.returnPlanetName}. Fleet morale -${flagshipResult.moraleReduction}`);

    let message = `${character.name}이(가) 부상을 입고 ${settings.returnPlanetName}으로 귀환했습니다.`;
    if (flagshipResult.newFlagship) {
      message += ` 새 기함: ${flagshipResult.newFlagship.name || flagshipResult.newFlagship.shipClass}`;
    } else if (flagshipResult.fleetAffected) {
      message += ' 대체 기함을 찾지 못했습니다.';
    }
    if (flagshipResult.moraleReduction > 0) {
      message += ` 함대 사기 -${flagshipResult.moraleReduction}%`;
    }

    return {
      survived: true,
      casualtyType: 'INJURY',
      casualty,
      message,
    };
  }

  /**
   * 탈출 처리
   */
  private async processEscape(
    sessionId: string,
    battleId: string,
    character: IGin7Character,
    flagshipName: string,
    locationGridId: string,
    settings: DeathSettings,
  ): Promise<DeathResult> {
    // 캐릭터는 무사하지만 기함은 잃음
    character.locationPlanetId = settings.returnPlanetId;
    
    // 기함 교체 및 사기 감소 로직
    const flagshipResult = await this.processFlagshipReplacementAndMorale(
      sessionId,
      character.characterId,
      'SURVIVED',
    );
    
    await character.save();

    this.emit('death:characterEscaped', { 
      sessionId, 
      characterId: character.characterId,
      flagshipReplacement: flagshipResult,
    });
    
    let message = `${character.name}이(가) ${flagshipName}에서 탈출하여 ${settings.returnPlanetName}으로 귀환했습니다.`;
    if (flagshipResult.newFlagship) {
      message += ` 새 기함: ${flagshipResult.newFlagship.name || flagshipResult.newFlagship.shipClass}`;
    } else if (flagshipResult.fleetAffected) {
      message += ' 대체 기함을 찾지 못했습니다.';
    }
    
    logger.info(`[CharacterDeathService] ${character.name} escaped from ${flagshipName} and returned to ${settings.returnPlanetName}`);

    return {
      survived: true,
      casualtyType: 'SURVIVED',
      message,
    };
  }

  // ==================== 기함 교체 및 사기 관리 ====================

  /**
   * 기함 격파 시 차기 기함 선정 및 사기 감소 처리
   * @param sessionId 세션 ID
   * @param characterId 사령관 캐릭터 ID
   * @param eventType 사상 유형 (DEATH, INJURY, SURVIVED 등)
   * 
   * NOTE: TacticalSession 연동
   * - 이 메서드가 발생시키는 이벤트('flagship:lost', 'flagship:replaced', 'fleet:unitsRouted')를
   *   TacticalSession이 구독하여 다음 틱에서 새로운 기함 정보를 반영해야 합니다.
   * - TacticalSession 수정이 필요한 경우, 해당 서비스에서 이벤트 핸들러를 추가하세요.
   */
  private async processFlagshipReplacementAndMorale(
    sessionId: string,
    characterId: string,
    eventType: 'DEATH' | 'INJURY' | 'SURVIVED' | 'CAPTURED' | 'MISSING',
  ): Promise<{
    fleetAffected: boolean;
    newFlagship?: IShipUnit;
    moraleReduction: number;
    confusionApplied: boolean;
    message: string;
  }> {
    // 캐릭터가 지휘하는 함대 찾기
    const fleet = await Fleet.findOne({ sessionId, commanderId: characterId });
    
    if (!fleet) {
      return {
        fleetAffected: false,
        moraleReduction: 0,
        confusionApplied: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 사기 감소 계산
    let totalMoraleReduction = FLAGSHIP_LOSS_MORALE_PENALTIES.FLAGSHIP_DESTROYED;
    
    // 사상 유형에 따른 추가 사기 감소
    switch (eventType) {
      case 'DEATH':
        totalMoraleReduction += FLAGSHIP_LOSS_MORALE_PENALTIES.COMMANDER_DEATH;
        break;
      case 'INJURY':
        totalMoraleReduction += FLAGSHIP_LOSS_MORALE_PENALTIES.COMMANDER_INJURY;
        break;
    }

    // 차기 기함 선정
    const newFlagship = this.selectNewFlagship(fleet);
    
    if (!newFlagship) {
      // 대체 기함 없음 - 추가 사기 감소
      totalMoraleReduction += FLAGSHIP_LOSS_MORALE_PENALTIES.NO_REPLACEMENT_FOUND;
      
      // 함대의 모든 유닛 사기 감소 및 혼란/패주 플래그 설정
      await this.applyMoraleReductionToFleet(fleet, totalMoraleReduction);
      
      // 기함 없음 상태에서는 추가로 모든 유닛에 최소 MODERATE 혼란 적용
      await this.applyMinimumConfusionOnFlagshipLoss(fleet, 'MODERATE');
      
      // 함대 상태 데이터에 기함 없음 표시
      fleet.statusData = {
        ...fleet.statusData,
        hasFlagship: false,
        flagshipLostAt: new Date(),
        lastConfusionEvent: 'FLAGSHIP_DESTROYED_NO_REPLACEMENT',
      };
      await fleet.save();
      
      // TacticalSession이 이 이벤트를 구독하여 전투 상태를 업데이트해야 함
      this.emit('flagship:lost', { 
        sessionId, 
        fleetId: fleet.fleetId, 
        moraleReduction: totalMoraleReduction,
        newFlagship: null,
        eventType,
      });
      
      logger.warn(`[CharacterDeathService] Fleet ${fleet.name} lost flagship. No replacement found. Morale -${totalMoraleReduction}`);
      
      return {
        fleetAffected: true,
        moraleReduction: totalMoraleReduction,
        confusionApplied: true,
        message: `${fleet.name} 함대가 기함을 상실했습니다. 대체 기함을 찾지 못해 함대 사기가 크게 저하되었습니다.`,
      };
    }

    // 새 기함 지정
    await this.applyMoraleReductionToFleet(fleet, totalMoraleReduction);
    
    // 새 기함이 있어도 기함 격침 충격으로 최소 MINOR 혼란 적용
    await this.applyMinimumConfusionOnFlagshipLoss(fleet, 'MINOR');
    
    // 함대 상태 데이터 업데이트
    fleet.statusData = {
      ...fleet.statusData,
      hasFlagship: true,
      currentFlagshipUnitId: newFlagship.unitId,
      flagshipReplacedAt: new Date(),
      lastConfusionEvent: 'FLAGSHIP_DESTROYED_REPLACED',
    };
    await fleet.save();
    
    // TacticalSession이 이 이벤트를 구독하여 전투 상태를 업데이트해야 함
    this.emit('flagship:replaced', { 
      sessionId, 
      fleetId: fleet.fleetId, 
      newFlagship,
      moraleReduction: totalMoraleReduction,
      eventType,
    });
    
    logger.info(`[CharacterDeathService] Fleet ${fleet.name} new flagship: ${newFlagship.name || newFlagship.shipClass}. Morale -${totalMoraleReduction}`);
    
    return {
      fleetAffected: true,
      newFlagship,
      moraleReduction: totalMoraleReduction,
      confusionApplied: true,
      message: `${fleet.name} 함대의 새 기함으로 ${newFlagship.name || newFlagship.shipClass}이(가) 지정되었습니다.`,
    };
  }
  
  /**
   * 기함 상실 시 최소 혼란 레벨 적용
   * 기함 격침은 중대한 사건이므로 사기와 무관하게 최소한의 혼란이 발생
   */
  private async applyMinimumConfusionOnFlagshipLoss(
    fleet: IFleet,
    minimumLevel: ConfusionLevelType,
  ): Promise<void> {
    const minimumSeverity = this.getConfusionSeverity(minimumLevel);
    let updatedCount = 0;
    
    for (const unit of fleet.units) {
      const currentLevel = (unit.confusionLevel as ConfusionLevelType) || 'NONE';
      const currentSeverity = this.getConfusionSeverity(currentLevel);
      
      // 현재 혼란이 최소 레벨보다 낮으면 최소 레벨로 상향
      if (currentSeverity < minimumSeverity) {
        unit.confusionLevel = minimumLevel;
        updatedCount++;
        logger.info(`[CharacterDeathService] Unit ${unit.unitId} minimum confusion applied: ${currentLevel} -> ${minimumLevel}`);
      }
    }
    
    if (updatedCount > 0) {
      await fleet.save();
      logger.info(`[CharacterDeathService] Fleet ${fleet.name}: ${updatedCount} units received minimum confusion level ${minimumLevel}`);
    }
  }

  /**
   * 함대 내에서 차기 기함 선정
   * 우선순위: 기함급 > 전함 > 항공모함 > 순양함 > 구축함 > 프리깃 > 초계함 > 기타
   * 동일 함급 내에서는 HP와 사기가 높은 유닛 우선
   */
  private selectNewFlagship(fleet: IFleet): IShipUnit | undefined {
    // 파괴되지 않은 유닛만 필터링 (HP > 0, count > 0)
    const availableUnits = fleet.units.filter(
      unit => unit.hp > 0 && unit.count > 0 && unit.destroyed < unit.count
    );

    if (availableUnits.length === 0) {
      return undefined;
    }

    // 우선순위 기반 정렬
    availableUnits.sort((a, b) => {
      // 1. 함급 우선순위
      const priorityA = FLAGSHIP_PRIORITY[a.shipClass] || 0;
      const priorityB = FLAGSHIP_PRIORITY[b.shipClass] || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 높은 우선순위 먼저
      }

      // 2. HP 비율
      if (a.hp !== b.hp) {
        return b.hp - a.hp; // 높은 HP 먼저
      }

      // 3. 사기
      if (a.morale !== b.morale) {
        return b.morale - a.morale; // 높은 사기 먼저
      }

      // 4. 숙련도
      return b.veterancy - a.veterancy; // 높은 숙련도 먼저
    });

    return availableUnits[0];
  }

  /**
   * 함대 전체에 사기 감소 적용 및 혼란/패주 플래그 설정
   */
  private async applyMoraleReductionToFleet(
    fleet: IFleet,
    moraleReduction: number,
  ): Promise<void> {
    let routedCount = 0;
    let confusedCount = 0;
    
    for (const unit of fleet.units) {
      // 사기 감소 적용
      const previousMorale = unit.morale;
      unit.morale = Math.max(0, Math.min(100, unit.morale - moraleReduction));
      
      // 사기 수준에 따른 혼란 레벨 결정
      const newConfusionLevel = this.calculateConfusionLevel(unit.morale);
      const previousConfusionLevel = unit.confusionLevel || 'NONE';
      
      // 혼란 레벨은 더 심각한 방향으로만 변경 (기함 격침 직후이므로)
      if (this.getConfusionSeverity(newConfusionLevel) > this.getConfusionSeverity(previousConfusionLevel as ConfusionLevelType)) {
        unit.confusionLevel = newConfusionLevel;
        
        if (newConfusionLevel === 'ROUTED') {
          routedCount++;
          logger.warn(`[CharacterDeathService] Unit ${unit.unitId} (${unit.shipClass}) is now ROUTED! Morale: ${unit.morale}`);
        } else if (newConfusionLevel !== 'NONE') {
          confusedCount++;
          logger.info(`[CharacterDeathService] Unit ${unit.unitId} (${unit.shipClass}) confusion: ${previousConfusionLevel} -> ${newConfusionLevel}, Morale: ${unit.morale}`);
        }
      }
    }
    
    // 함대 전체 사기도 업데이트 (평균)
    if (fleet.units.length > 0) {
      const averageMorale = fleet.units.reduce((sum, u) => sum + u.morale, 0) / fleet.units.length;
      // Fleet 모델에 전체 morale 필드가 있다면 업데이트
      // (현재 IFleet에는 units 내부에만 morale이 있음)
    }
    
    await fleet.save();
    
    logger.info(`[CharacterDeathService] Fleet ${fleet.name} morale reduced by ${moraleReduction}. Routed: ${routedCount}, Confused: ${confusedCount}`);
    
    // 패주 유닛이 있으면 이벤트 발생
    if (routedCount > 0) {
      this.emit('fleet:unitsRouted', {
        fleetId: fleet.fleetId,
        sessionId: fleet.sessionId,
        routedCount,
        confusedCount,
      });
    }
  }
  
  /**
   * 사기 수준에 따른 혼란 레벨 계산
   */
  private calculateConfusionLevel(morale: number): ConfusionLevelType {
    if (morale < MORALE_CONFUSION_THRESHOLDS.ROUTED) {
      return 'ROUTED';
    } else if (morale < MORALE_CONFUSION_THRESHOLDS.SEVERE) {
      return 'SEVERE';
    } else if (morale < MORALE_CONFUSION_THRESHOLDS.MODERATE) {
      return 'MODERATE';
    } else if (morale < MORALE_CONFUSION_THRESHOLDS.MINOR) {
      return 'MINOR';
    }
    return 'NONE';
  }
  
  /**
   * 혼란 레벨 심각도 반환 (높을수록 심각)
   */
  private getConfusionSeverity(level: ConfusionLevelType): number {
    const severities: Record<ConfusionLevelType, number> = {
      'NONE': 0,
      'MINOR': 1,
      'MODERATE': 2,
      'SEVERE': 3,
      'ROUTED': 4,
    };
    return severities[level];
  }

  // ==================== 실종/포로 처리 ====================

  /**
   * 실종 처리 (전투 중 행방불명)
   */
  public async processMissing(
    sessionId: string,
    battleId: string,
    characterId: string,
    locationGridId: string,
  ): Promise<DeathResult> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { survived: false, casualtyType: 'MISSING', message: '캐릭터를 찾을 수 없습니다.' };
    }

    const casualty: CombatCasualty = {
      casualtyId: `CASUALTY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      battleId,
      characterId,
      characterName: character.name,
      faction: character.faction,
      eventType: 'MISSING',
      flagshipDestroyed: false,
      locationGridId,
      timestamp: new Date(),
    };

    this.casualties.get(sessionId)?.push(casualty);

    character.status = 'MISSING';
    await character.save();

    this.emit('death:characterMissing', { sessionId, casualty });
    logger.warn(`[CharacterDeathService] ${character.name} is missing in action`);

    return {
      survived: true, // 일단 생존으로 처리
      casualtyType: 'MISSING',
      casualty,
      message: `${character.name}이(가) 전투 중 행방불명되었습니다.`,
    };
  }

  /**
   * 포로 처리
   */
  public async processCaptured(
    sessionId: string,
    battleId: string,
    characterId: string,
    capturerFaction: string,
    locationGridId: string,
  ): Promise<DeathResult> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { survived: false, casualtyType: 'CAPTURED', message: '캐릭터를 찾을 수 없습니다.' };
    }

    const casualty: CombatCasualty = {
      casualtyId: `CASUALTY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      battleId,
      characterId,
      characterName: character.name,
      faction: character.faction,
      eventType: 'CAPTURED',
      flagshipDestroyed: true,
      locationGridId,
      timestamp: new Date(),
    };

    this.casualties.get(sessionId)?.push(casualty);

    character.status = 'CAPTURED';
    character.capturedBy = capturerFaction;
    await character.save();

    this.emit('death:characterCaptured', { sessionId, casualty, capturerFaction });
    logger.warn(`[CharacterDeathService] ${character.name} was captured by ${capturerFaction}`);

    return {
      survived: true,
      casualtyType: 'CAPTURED',
      casualty,
      message: `${character.name}이(가) ${capturerFaction}에게 포로가 되었습니다.`,
    };
  }

  // ==================== 유틸리티 ====================

  private getDeathSettings(sessionId: string, characterId: string): DeathSettings | undefined {
    return this.deathSettings.get(sessionId)?.find(s => s.characterId === characterId);
  }

  private getDefaultSettings(sessionId: string, characterId: string): DeathSettings {
    return {
      characterId,
      sessionId,
      deathEnabled: false,
      injuryThreshold: 70,
      deathThreshold: 30,
      returnPlanetId: '',
      returnPlanetName: '본거지',
      autoEvacuate: true,
      evacuateThreshold: 20,
    };
  }

  // ==================== 조회 ====================

  public getCharacterDeathSettings(sessionId: string, characterId: string): DeathSettings | undefined {
    return this.getDeathSettings(sessionId, characterId);
  }

  public getCasualtiesByBattle(sessionId: string, battleId: string): CombatCasualty[] {
    return (this.casualties.get(sessionId) || []).filter(c => c.battleId === battleId);
  }

  public getCasualtiesByFaction(sessionId: string, faction: string): CombatCasualty[] {
    return (this.casualties.get(sessionId) || []).filter(c => c.faction === faction);
  }

  public getAllCasualties(sessionId: string): CombatCasualty[] {
    return this.casualties.get(sessionId) || [];
  }

  public getDeathStatistics(sessionId: string): {
    totalDeaths: number;
    totalInjuries: number;
    totalCaptured: number;
    totalMissing: number;
    byFaction: Record<string, number>;
  } {
    const casualties = this.casualties.get(sessionId) || [];
    
    const stats = {
      totalDeaths: 0,
      totalInjuries: 0,
      totalCaptured: 0,
      totalMissing: 0,
      byFaction: {} as Record<string, number>,
    };

    for (const casualty of casualties) {
      switch (casualty.eventType) {
        case 'DEATH':
          stats.totalDeaths++;
          break;
        case 'INJURY':
          stats.totalInjuries++;
          break;
        case 'CAPTURED':
          stats.totalCaptured++;
          break;
        case 'MISSING':
          stats.totalMissing++;
          break;
      }

      stats.byFaction[casualty.faction] = (stats.byFaction[casualty.faction] || 0) + 1;
    }

    return stats;
  }
}

export const characterDeathService = CharacterDeathService.getInstance();
export default CharacterDeathService;

