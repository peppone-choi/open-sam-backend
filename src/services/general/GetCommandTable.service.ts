import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { CommandFactory } from '../../core/command/CommandFactory';
import { logger } from '../../common/logger';

/**
 * GetCommandTable Service (커맨드 테이블 조회)
 * 장수가 사용 가능한 커맨드 목록을 카테고리별로 반환
 * PHP: /sam/hwe/sammo/API/General/GetCommandTable.php
 */
export class GetCommandTableService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || (data.general_id ? parseInt(data.general_id) : null);
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다',
        reason: '장수 ID가 필요합니다'
      };
    }

    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다',
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return { 
          success: false, 
          message: '세션을 찾을 수 없습니다',
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const commandTable = await this.buildCommandTable(general, session);

      return {
        success: true,
        result: true,
        commandTable
      };
    } catch (error: any) {
      logger.error('GetCommandTable error:', error);
      return {
        success: false,
        message: error.message || '커맨드 테이블 조회 중 오류가 발생했습니다'
      };
    }
  }

  private static async buildCommandTable(general: any, session: any): Promise<any[]> {
    const gameEnv = session.data?.game_env || {};
    
    // 세션 설정에서 availableGeneralCommand 가져오기
    const availableGeneralCommand = gameEnv.availableGeneralCommand || this.getDefaultCommandCategories();
    
    logger.debug('buildCommandTable:', {
      hasAvailableGeneralCommand: !!gameEnv.availableGeneralCommand,
      categories: Object.keys(availableGeneralCommand),
      totalCommands: Object.values(availableGeneralCommand).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    });
    
    const result: any[] = [];
    
    // 카테고리별로 순회
    for (const [category, commandList] of Object.entries(availableGeneralCommand)) {
      if (!Array.isArray(commandList)) continue;
      
      const subList: any[] = [];
      
      // 각 명령에 대해
      for (const commandClassName of commandList) {
        try {
          // 명령 타입 변환 (예: '휴식' -> 'REST', 'che_농업개발' -> 'CULTIVATE_FARM')
          const commandType = this.convertCommandNameToType(commandClassName);
          
          // 명령 인스턴스 생성 시도
          let commandObj: any = null;
          let canDisplay = true;
          let hasMinCondition = true;
          let commandName = commandClassName;
          let commandTitle = commandClassName;
          let reqArg = false;
          let compensation = 0;
          
          try {
            // 명령 이름 그대로 사용 (CommandRegistry에 한글 이름으로 등록되어 있음)
            // 'che_' 접두사가 있으면 제거
            const registryKey = commandClassName.replace(/^che_/, '');
            
            // CommandRegistry에서 직접 가져오기
            const { CommandRegistry } = await import('../../commands');
            const CommandClass = CommandRegistry[registryKey];
            
            if (!CommandClass) {
              logger.debug(`Command not found in registry: ${registryKey} (original: ${commandClassName})`);
              // 명령이 없어도 기본 정보로 추가
              subList.push({
                value: commandClassName,
                simpleName: registryKey,
                reqArg: 0,
                possible: true,
                compensation: 0,
                title: String(registryKey)
              });
              continue;
            }
            
            if (CommandClass) {
              try {
                // 명령 인스턴스 생성 시도
                commandObj = new CommandClass(general, gameEnv);
                
                // 명령 정보 가져오기
                canDisplay = commandObj.canDisplay?.() ?? true;
                hasMinCondition = commandObj.hasMinConditionMet?.() ?? true;
                commandName = CommandClass.getName?.() ?? commandClassName.replace(/^che_/, '');
                commandTitle = String(commandObj.getCommandDetailTitle?.() ?? commandName);
                reqArg = CommandClass.reqArg ?? false;
                compensation = commandObj.getCompensationStyle?.() ?? 0;
              } catch (err: any) {
                // 인스턴스 생성 실패 시 정적 메서드만 사용
                commandName = CommandClass.getName?.() ?? commandClassName.replace(/^che_/, '');
                commandTitle = commandName;
                reqArg = CommandClass.reqArg ?? false;
              }
            }
          } catch (err: any) {
            // 명령 클래스가 없거나 생성 실패 시 기본값 사용
            logger.debug(`Command class not found or failed to create: ${commandClassName}`, err.message);
          }
          
          // canDisplay가 false면 스킵
          if (!canDisplay) continue;
          
          subList.push({
            value: commandClassName,
            simpleName: commandName,
            reqArg: reqArg ? 1 : 0,
            possible: hasMinCondition,
            compensation: compensation,
            title: String(commandTitle)
          });
        } catch (error: any) {
          logger.warn(`Failed to process command: ${commandClassName}`, error.message);
          // 에러가 나도 기본 정보로라도 추가
          subList.push({
            value: commandClassName,
            simpleName: commandClassName.replace(/^che_/, ''),
            reqArg: 0,
            possible: true,
            compensation: 0,
            title: String(commandClassName)
          });
        }
      }
      
      if (subList.length > 0) {
        result.push({
          category: category,
          values: subList
        });
      }
    }
    
    return result;
  }
  
  /**
   * 명령 이름을 타입으로 변환
   * '휴식' -> 'REST', 'che_농업개발' -> 'CULTIVATE_FARM' 등
   */
  private static convertCommandNameToType(commandName: string): string {
    // 'che_' 접두사 제거
    let type = commandName.replace(/^che_/, '');
    
    // 한글을 영문으로 변환하는 간단한 매핑
    const nameMap: Record<string, string> = {
      '휴식': 'REST',
      '단련': 'TRAIN',
      '치료': 'HEAL',
      '모집': 'RECRUIT',
      '징병': 'CONSCRIPT',
      '이동': 'MOVE',
      '귀환': 'RETURN',
      '접경귀환': 'BORDER_RETURN',
      '농업개발': 'CULTIVATE_FARM',
      '상업개발': 'INVEST_COMMERCE',
      '기술연구': 'RESEARCH_TECH',
      '방어': 'REINFORCE_DEFENSE',
      '치안': 'REINFORCE_SECURITY',
      '성벽': 'REPAIR_WALL',
      '농업': 'CULTIVATE_FARM',
      '상업': 'INVEST_COMMERCE',
    };
    
    if (nameMap[type]) {
      return nameMap[type];
    }
    
    // 매핑이 없으면 대문자로 변환
    return type.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }
  
  /**
   * 기본 명령 카테고리 (세션 설정에 없을 때 사용)
   * 원본 PHP GameConstBase.php의 $availableGeneralCommand 기반
   * 실제 CommandRegistry에 등록된 명령 이름과 매핑
   */
  private static getDefaultCommandCategories(): Record<string, string[]> {
    return {
      '개인': [
        '휴식',              // RestCommand
        '요양',            // RestCureCommand (che_요양)
        '단련',            // TrainCommand (che_단련)
        '숙련전환',        // ConvertExpCommand (che_숙련전환)
        '견문',            // SightseeingCommand (che_견문)
        '은퇴',            // RetireCommand (che_은퇴)
        '장비매매',        // TradeEquipmentCommand (che_장비매매)
        '군량매매',        // TradeRiceCommand (che_군량매매)
        '내정특기초기화',  // ResetAdminSkillCommand (che_내정특기초기화)
        '전투특기초기화',  // ResetBattleSkillCommand (che_전투특기초기화)
      ],
      '내정': [
        '농지개간',        // CultivateLandCommand (che_농지개간)
        '상업',            // InvestCommerceCommand (che_상업투자 → 상업)
        '기술연구',        // ResearchTechCommand (che_기술연구)
        '수비강화',        // ReinforceDefenseExtendCommand (che_수비강화)
        '성벽보수',        // RepairWallExtendCommand (che_성벽보수)
        '치안',            // ReinforceSecurityCommand (che_치안강화 → 치안)
        '정착장려',        // EncourageSettlementCommand (che_정착장려)
        '주민선정',        // SelectCitizenCommand (che_주민선정)
      ],
      '군사': [
        '징병',            // ConscriptCommand (che_징병)
        '모병',            // RecruitSoldiersCommand (che_모병)
        '집중훈련',        // IntensiveTrainingCommand (che_훈련 → 집중훈련 또는 부대훈련)
        '부대훈련',        // TrainTroopsCommand
        '사기',            // BoostMoraleCommand (che_사기진작 → 사기)
        '출병',            // DeployCommand (che_출병)
        '집합',            // GatherCommand (che_집합)
        '소집해제',        // DismissTroopsCommand (che_소집해제)
        '첩보',            // SpyCommand (che_첩보)
      ],
      '인사': [
        '이동',            // MoveCommand (che_이동)
        '강행',            // ForceMarchCommand (che_강행)
        '인재등용',        // SearchTalentCommand (che_인재탐색 → 인재등용)
        '등용',            // RecruitGeneralCommand (che_등용)
        '귀환',            // ReturnCommand (che_귀환)
        '임관',            // JoinNationCommand (che_임관)
        '랜덤임관',        // RandomJoinNationCommand (che_랜덤임관)
        '장수대상임관',    // JoinGeneralNationCommand (che_장수대상임관)
      ],
      '계략': [
        '선동',            // AgitateCommand (che_선동)
        '탈취',            // PlunderCommand (che_탈취)
        '파괴',            // DestroyCommand (che_파괴)
        '화계',            // FireAttackCommand (che_화계)
      ],
      '국가': [
        '증여',            // GrantCommand (che_증여)
        '헌납',            // DonateCommand (che_헌납)
        '물자조달',        // ProcureSupplyCommand (che_물자조달)
        '하야',            // AbdicateCommand (che_하야)
        '거병',            // RaiseArmyCommand (che_거병)
        '건국',            // FoundNationCommand (che_건국)
        '선양',            // AbdicateToCommand (che_선양)
        '해산',            // DisbandCommand (che_해산)
      ],
    };
  }
}
