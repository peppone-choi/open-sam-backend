import { RedisService } from '../../infrastructure/cache/redis.service';
import { logger } from '../common/utils/logger';
import { CommandRepository } from '../command/repository/command.repository';
import { GeneralRepository } from '../general/repository/general.repository';
import { CommandType, CommandStatus } from '../command/@types/command.types';

/**
 * Command Processor
 * Redis Streams에서 명령을 소비하고 처리하는 데몬
 */
export class CommandProcessor {
  private redis: RedisService;
  private commandRepo: CommandRepository;
  private generalRepo: GeneralRepository;
  private isRunning = false;
  private readonly STREAM_KEY = 'cmd:game';
  private readonly GROUP_NAME = 'game-daemon';
  private readonly CONSUMER_NAME = 'processor-1';

  constructor(
    commandRepo: CommandRepository,
    generalRepo: GeneralRepository
  ) {
    this.redis = new RedisService();
    this.commandRepo = commandRepo;
    this.generalRepo = generalRepo;
  }

  async start() {
    this.isRunning = true;
    logger.info('🔄 Command processor started');

    // Consumer Group 생성 (이미 존재하면 무시)
    try {
      await this.redis.createConsumerGroup(this.STREAM_KEY, this.GROUP_NAME);
      logger.info(`✅ Consumer group created: ${this.GROUP_NAME}`);
    } catch (error) {
      // Group already exists - ignore
    }

    this.poll();
  }

  stop() {
    this.isRunning = false;
    logger.info('⏸️  Command processor stopped');
  }

  private async poll() {
    while (this.isRunning) {
      try {
        // Redis Streams에서 메시지 읽기
        const messages = await this.redis.readGroup(
          this.STREAM_KEY,
          this.GROUP_NAME,
          this.CONSUMER_NAME,
          10, // count
          1000 // block ms
        );

        if (messages && messages.length > 0) {
          for (const message of messages) {
            await this.processMessage(message.id, message.data);
          }
        }
      } catch (error) {
        logger.error('Poll error:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processMessage(messageId: string, data: any) {
    try {
      const commandData = typeof data === 'string' ? JSON.parse(data) : data;
      
      logger.info(`📨 Processing command: ${commandData.type} (${messageId})`);

      // DB에 Command 레코드 생성
      const command = await this.commandRepo.create({
        sessionId: commandData.sessionId || 'default',
        generalId: commandData.generalId,
        type: commandData.type,
        status: CommandStatus.EXECUTING,
        payload: commandData.payload,
        cpCost: commandData.cpCost || 0,
        cpType: commandData.cpType || 'PCP',
        startTime: new Date(),
      });

      // 명령 타입별 처리
      await this.processCommand(command.id, commandData);

      // ACK
      await this.redis.ack(this.STREAM_KEY, this.GROUP_NAME, messageId);
      logger.info(`✅ Command processed: ${messageId}`);

    } catch (error) {
      logger.error(`❌ Error processing command ${messageId}:`, error);
      // TODO: DLQ (Dead Letter Queue)로 이동
    }
  }

  private async processCommand(commandId: string, commandData: any) {
    try {
      switch (commandData.type) {
        // 개인 커맨드
        case CommandType.REST:
          await this.handleRest(commandId, commandData);
          break;
        case CommandType.CURE:
          await this.handleCure(commandId, commandData);
          break;
        case CommandType.DRILL:
          await this.handleDrill(commandId, commandData);
          break;

        // 내정 커맨드
        case CommandType.DEVELOP_AGRICULTURE:
        case CommandType.INVEST_COMMERCE:
        case CommandType.RESEARCH_TECH:
        case CommandType.FORTIFY_DEFENSE:
        case CommandType.REPAIR_WALL:
        case CommandType.IMPROVE_SECURITY:
        case CommandType.ENCOURAGE_SETTLEMENT:
        case CommandType.GOVERN_PEOPLE:
          await this.handleDomestic(commandId, commandData);
          break;

        // 군사 커맨드
        case CommandType.CONSCRIPT:
          await this.handleConscript(commandId, commandData);
          break;
        case CommandType.RECRUIT:
          await this.handleRecruit(commandId, commandData);
          break;
        case CommandType.TRAIN:
          await this.handleTrain(commandId, commandData);
          break;
        case CommandType.BOOST_MORALE:
          await this.handleBoostMorale(commandId, commandData);
          break;
        case CommandType.DEPLOY:
          await this.handleDeploy(commandId, commandData);
          break;

        // 인사 커맨드
        case CommandType.MOVE:
          await this.handleMove(commandId, commandData);
          break;
        case CommandType.FORCE_MARCH:
          await this.handleForceMarch(commandId, commandData);
          break;

        // 계략 커맨드
        case CommandType.AGITATE:
        case CommandType.PLUNDER:
        case CommandType.SABOTAGE:
        case CommandType.ARSON:
          await this.handleStratagem(commandId, commandData);
          break;

        // 국가 커맨드
        case CommandType.GRANT:
          await this.handleGrant(commandId, commandData);
          break;
        case CommandType.TRIBUTE:
          await this.handleTribute(commandId, commandData);
          break;

        default:
          logger.warn(`⚠️  Command not implemented: ${commandData.type}`);
          await this.commandRepo.updateStatus(
            commandId,
            CommandStatus.COMPLETED,
            { message: 'Command type not yet implemented' }
          );
      }
    } catch (error) {
      logger.error(`❌ Error executing command ${commandId}:`, error);
      await this.commandRepo.updateStatus(
        commandId,
        CommandStatus.FAILED,
        null,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * 휴식 처리
   */
  private async handleRest(commandId: string, data: any) {
    logger.info(`😴 Rest: ${data.generalId}`);
    
    // TODO: 자율행동 처리
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { rested: true }
    );
  }

  /**
   * 요양 처리
   */
  private async handleCure(commandId: string, data: any) {
    const { generalId } = data;
    logger.info(`🏥 Cure: ${generalId}`);

    const general = await this.generalRepo.findById(generalId);
    if (!general) {
      throw new Error('General not found');
    }

    // 부상 완전 치료
    await this.generalRepo.update(generalId, { injury: 0 });

    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { injury: 0 }
    );

    logger.info(`✅ Cure completed: ${generalId}`);
  }

  /**
   * 단련 처리
   */
  private async handleDrill(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { unitType } = payload;

    logger.info(`🏋️  Drill: ${generalId}, unitType: ${unitType}`);

    // TODO: 병종 숙련도 증가 로직 구현
    
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { unitType, increased: true }
    );

    logger.info(`✅ Drill completed: ${generalId}`);
  }

  /**
   * 내정 처리
   */
  private async handleDomestic(commandId: string, data: any) {
    const { generalId, type, payload } = data;
    logger.info(`🏛️  Domestic ${type}: ${generalId}`);

    // TODO: 도시 내정 수치 증가 로직
    
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { type, completed: true }
    );
  }

  /**
   * 징병 처리
   */
  private async handleConscript(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { unitType, amount } = payload;
    
    logger.info(`⚔️  Conscript: ${generalId}, ${amount} troops of type ${unitType}`);
    
    // TODO: 징병 로직 구현
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { conscripted: amount }
    );
  }

  /**
   * 모병 처리
   */
  private async handleRecruit(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { unitType, amount } = payload;
    
    logger.info(`🎖️  Recruit: ${generalId}, ${amount} troops of type ${unitType}`);
    
    // TODO: 모병 로직 구현
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { recruited: amount }
    );
  }

  /**
   * 훈련 처리
   */
  private async handleTrain(commandId: string, data: any) {
    logger.info(`💪 Train: ${data.generalId}`);
    
    // TODO: 훈련도 증가 로직
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { trained: true }
    );
  }

  /**
   * 사기진작 처리
   */
  private async handleBoostMorale(commandId: string, data: any) {
    logger.info(`📣 Boost morale: ${data.generalId}`);
    
    // TODO: 사기 증가 로직
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { boosted: true }
    );
  }

  /**
   * 출병 처리
   */
  private async handleDeploy(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { targetCityId } = payload;
    
    logger.info(`⚔️  Deploy: ${generalId} → ${targetCityId}`);
    
    // TODO: 출병 로직 구현 (전투 시스템 연동)
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { deployed: true, targetCityId }
    );
  }

  /**
   * 이동 처리
   */
  private async handleMove(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { targetCityId } = payload;
    
    logger.info(`🚶 Move: ${generalId} → ${targetCityId}`);
    
    // TODO: 이동 로직 구현
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { moved: true, targetCityId }
    );
  }

  /**
   * 강행 처리
   */
  private async handleForceMarch(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { targetCityId } = payload;
    
    logger.info(`🏃 Force march: ${generalId} → ${targetCityId}`);
    
    // TODO: 강행 로직 (병력/훈련/사기 감소)
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { forcedMarch: true, targetCityId }
    );
  }

  /**
   * 계략 처리
   */
  private async handleStratagem(commandId: string, data: any) {
    const { generalId, type, payload } = data;
    const { targetCityId } = payload;
    
    logger.info(`🎭 Stratagem ${type}: ${generalId} → ${targetCityId}`);
    
    // TODO: 계략 로직 구현
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { stratagem: type, targetCityId }
    );
  }

  /**
   * 증여 처리
   */
  private async handleGrant(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { targetGeneralId, gold, rice } = payload;
    
    logger.info(`🎁 Grant: ${generalId} → ${targetGeneralId}, gold: ${gold}, rice: ${rice}`);
    
    // TODO: 자원 이전 로직
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { granted: true, targetGeneralId, gold, rice }
    );
  }

  /**
   * 헌납 처리
   */
  private async handleTribute(commandId: string, data: any) {
    const { generalId, payload } = data;
    const { gold, rice } = payload;
    
    logger.info(`🏛️  Tribute: ${generalId}, gold: ${gold}, rice: ${rice}`);
    
    // TODO: 국가에 헌납 로직
    await this.commandRepo.updateStatus(
      commandId,
      CommandStatus.COMPLETED,
      { tributed: true, gold, rice }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
