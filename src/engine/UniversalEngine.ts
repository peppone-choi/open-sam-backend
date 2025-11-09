/**
 * OpenSAM 범용 게임 엔진
 *
 * 삼국지와 은하영웅전설을 동시에 지원하는 범용 전략 게임 엔진입니다.
 *
 * **핵심 원칙**:
 * 1. 세계 독립적 설계 (World-agnostic)
 * 2. 플러그인 아키텍처 (Plugin Architecture)
 * 3. 데이터 주도 설계 (Data-driven Design)
 *
 * @module UniversalEngine
 */

/**
 * 게임 세계 타입
 */
export enum GameWorld {
  /** 삼국지 (Romance of the Three Kingdoms) */
  SANGOKUSHI = 'sangokushi',
  /** 은하영웅전설 (Legend of Galactic Heroes) */
  LOGH = 'logh',
}

/**
 * 범용 엔티티 인터페이스
 *
 * 모든 게임 엔티티(장수, 커맨더, 도시, 행성 등)의 기본 구조입니다.
 */
export interface IUniversalEntity {
  /** 엔티티 고유 ID */
  id: string;

  /** 게임 세계 타입 */
  worldType: GameWorld;

  /** 엔티티 이름 */
  name: string;

  /** 엔티티 역할 (commander, settlement, faction, fleet, unit 등) */
  role: string;

  /** 기본 능력치 (범용) */
  baseStats: {
    /** 리더십/통솔 */
    leadership: number;
    /** 지력/전략 */
    intelligence: number;
    /** 정치/행정 */
    politics: number;
    /** 무력/전투력 */
    strength: number;
  };

  /** 자원 (범용) */
  resources: {
    /** 금/화폐 */
    gold: number;
    /** 식량/보급품 */
    supplies: number;
    /** 기타 자원 */
    [key: string]: number;
  };

  /** 세계별 고유 데이터 */
  worldSpecificData: {
    [key: string]: any;
  };

  /** 메타데이터 */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

/**
 * 범용 커맨드 인터페이스
 */
export interface IUniversalCommand {
  /** 커맨드 고유 ID */
  id: string;

  /** 커맨드 타입 (move, train, attack, research 등) */
  type: string;

  /** 실행자 엔티티 ID */
  executorId: string;

  /** 대상 엔티티 ID (선택) */
  targetId?: string;

  /** 커맨드 파라미터 */
  params: Record<string, any>;

  /** 소요 턴 수 */
  requiredTurns: number;

  /** 실행 상태 */
  status: 'pending' | 'executing' | 'completed' | 'failed';

  /** 실행 결과 */
  result?: {
    success: boolean;
    message: string;
    effects: Array<{
      targetId: string;
      type: string;
      value: any;
    }>;
  };
}

/**
 * 범용 게임 엔진 클래스
 */
export class UniversalEngine {
  private worldType: GameWorld;
  private entities: Map<string, IUniversalEntity> = new Map();
  private commands: Map<string, IUniversalCommand> = new Map();

  constructor(worldType: GameWorld) {
    this.worldType = worldType;
  }

  /**
   * 엔티티 생성
   */
  createEntity(entity: Omit<IUniversalEntity, 'id' | 'metadata'>): IUniversalEntity {
    const newEntity: IUniversalEntity = {
      ...entity,
      id: this.generateId(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    };

    this.entities.set(newEntity.id, newEntity);
    return newEntity;
  }

  /**
   * 엔티티 조회
   */
  getEntity(id: string): IUniversalEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * 커맨드 등록
   */
  registerCommand(command: Omit<IUniversalCommand, 'id' | 'status'>): IUniversalCommand {
    const newCommand: IUniversalCommand = {
      ...command,
      id: this.generateId(),
      status: 'pending',
    };

    this.commands.set(newCommand.id, newCommand);
    return newCommand;
  }

  /**
   * 턴 처리
   */
  async processTurn(): Promise<void> {
    // 1. 모든 실행 중인 커맨드 처리
    for (const [id, command] of this.commands) {
      if (command.status === 'executing' || command.status === 'pending') {
        await this.executeCommand(command);
      }
    }

    // 2. 세계별 턴 처리
    await this.processWorldSpecificTurn();
  }

  /**
   * 커맨드 실행
   */
  private async executeCommand(command: IUniversalCommand): Promise<void> {
    // TODO: 커맨드 타입별 실행 로직
    command.status = 'executing';

    // 여기서 실제 게임 로직 수행

    command.status = 'completed';
    command.result = {
      success: true,
      message: 'Command executed successfully',
      effects: [],
    };
  }

  /**
   * 세계별 턴 처리
   */
  private async processWorldSpecificTurn(): Promise<void> {
    switch (this.worldType) {
      case GameWorld.SANGOKUSHI:
        await this.processSangokushiTurn();
        break;
      case GameWorld.LOGH:
        await this.processLoghTurn();
        break;
    }
  }

  /**
   * 삼국지 턴 처리
   */
  private async processSangokushiTurn(): Promise<void> {
    // 삼국지 고유 턴 처리
    // - 도시 농업/상업 증가
    // - 장수 경험치 증가
    // - 계절 변화 이벤트
  }

  /**
   * 은하영웅전설 턴 처리
   */
  private async processLoghTurn(): Promise<void> {
    // 은하영웅전설 고유 턴 처리
    // - 함대 이동
    // - 행성 생산
    // - 작전 계획 진행
  }

  /**
   * ID 생성
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 게임 상태 저장
   */
  async saveState(): Promise<void> {
    // MongoDB에 전체 게임 상태 저장
    // - 엔티티 목록
    // - 커맨드 큐
    // - 턴 정보
  }

  /**
   * 게임 상태 로드
   */
  async loadState(sessionId: string): Promise<void> {
    // MongoDB에서 게임 상태 로드
  }
}

/**
 * 삼국지 전용 엔진
 */
export class SangokushiEngine extends UniversalEngine {
  constructor() {
    super(GameWorld.SANGOKUSHI);
  }

  /**
   * 삼국지 장수 생성
   */
  createCommander(data: {
    name: string;
    leadership: number;
    intelligence: number;
    politics: number;
    strength: number;
  }): IUniversalEntity {
    return this.createEntity({
      worldType: GameWorld.SANGOKUSHI,
      name: data.name,
      role: 'commander',
      baseStats: {
        leadership: data.leadership,
        intelligence: data.intelligence,
        politics: data.politics,
        strength: data.strength,
      },
      resources: {
        gold: 1000,
        supplies: 1000,
        rice: 2000,
      },
      worldSpecificData: {
        // 삼국지 고유 데이터
        age: 20,
        loyalty: 100,
        experience: 0,
        weapon: null,
        horse: null,
        skills: [],
      },
    });
  }
}

/**
 * 은하영웅전설 전용 엔진
 */
export class LoghEngine extends UniversalEngine {
  constructor() {
    super(GameWorld.LOGH);
  }

  /**
   * 은하영웅전설 커맨더 생성
   */
  createCommander(data: {
    name: string;
    leadership: number;
    intelligence: number;
    politics: number;
    strength: number;
  }): IUniversalEntity {
    return this.createEntity({
      worldType: GameWorld.LOGH,
      name: data.name,
      role: 'commander',
      baseStats: {
        leadership: data.leadership,
        intelligence: data.intelligence,
        politics: data.politics,
        strength: data.strength,
      },
      resources: {
        gold: 0,
        supplies: 0,
        // 은하영웅전설에서는 개인 자원보다 함대 자원이 중요
      },
      worldSpecificData: {
        // 은하영웅전설 고유 데이터
        rank: '대위',
        faction: 'empire', // empire | alliance
        flagship: null,
        fleetId: null,
        commandPoints: 10,
      },
    });
  }

  /**
   * 함대 생성
   */
  createFleet(data: {
    name: string;
    commanderId: string;
    ships: number;
  }): IUniversalEntity {
    return this.createEntity({
      worldType: GameWorld.LOGH,
      name: data.name,
      role: 'fleet',
      baseStats: {
        leadership: 0,
        intelligence: 0,
        politics: 0,
        strength: data.ships,
      },
      resources: {
        gold: 0,
        supplies: data.ships * 100,
      },
      worldSpecificData: {
        commanderId: data.commanderId,
        ships: data.ships,
        position: { x: 0, y: 0, z: 0 },
        formation: 'standard',
      },
    });
  }
}
