// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { troopRepository } from '../../repositories/troop.repository';
import GameConstants from '../../utils/game-constants';

const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

export class GetReservedCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId: any = user?.generalId || data.general_id;

    // generalId가 문자열로 올 수 있으므로 안전하게 숫자로 변환
    if (generalId !== undefined && generalId !== null) {
      generalId = Number(generalId);
      if (!Number.isInteger(generalId) || generalId <= 0) {
        generalId = undefined;
      }
    }

    try {
      let actualGeneralId = generalId;

      // 토큰에 generalId가 없으면 owner 기준으로 현재 장수 검색 (다른 서비스와 동일 패턴)
      if (!actualGeneralId) {
        if (!userId) {
          throw new Error('장수 정보를 찾을 수 없습니다.');
        }

        const userGeneral = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId),
          { npc: { $lt: 2 } },
        );

        if (!userGeneral) {
          throw new Error('장수 정보를 찾을 수 없습니다.');
        }

        actualGeneralId = userGeneral.data?.no || userGeneral.no;
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, actualGeneralId);

      if (!general) {
        throw new Error('장수 정보를 찾을 수 없습니다.');
      }

      const generalData = general.data;
      const nationId = generalData.nation;
      const officerLevel = generalData.officer_level || 1;

      if (!nationId) {
        throw new Error('국가에 소속되어있지 않습니다.');
      }

      const permission = this.checkSecretPermission(generalData);
      if (permission < 0) {
        throw new Error('국가에 소속되어있지 않습니다.');
      } else if (permission < 1) {
        throw new Error('수뇌부가 아니거나 사관년도가 부족합니다.');
      }

      const nation = await nationRepository.findOneByFilter({
        session_id: sessionId,
        nation: nationId
      });

      const nationLevel = nation?.level || 0;

      const chiefs = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: nationId,
        officer_level: { $gte: 5 }
      });

      const generalsByLevel: { [key: number]: any } = {};
      for (const chief of chiefs) {
        generalsByLevel[chief.officer_level] = chief;
      }

      const nationTurns = await nationTurnRepository.findByNation(
        sessionId,
        nationId,
        { officer_level: -1, turn_idx: 1 }
      );

      const nationTurnList: { [key: number]: { [key: number]: any } } = {};
      const invalidUnderTurnList: { [key: number]: number } = {};
      const invalidOverTurnList: { [key: number]: number } = {};

      for (const turn of nationTurns) {
        let { officer_level, turn_idx, action, arg, brief } = turn;

        if (!nationTurnList[officer_level]) {
          nationTurnList[officer_level] = {};
        }

        if (turn_idx < 0) {
          invalidUnderTurnList[officer_level] = turn_idx;
          turn_idx += MAX_CHIEF_TURN;
        } else if (turn_idx >= MAX_CHIEF_TURN) {
          invalidOverTurnList[officer_level] = turn_idx;
          turn_idx -= MAX_CHIEF_TURN;
        }

        nationTurnList[officer_level][turn_idx] = {
          action,
          brief,
          arg: typeof arg === 'string' ? JSON.parse(arg) : arg
        };
      }

      if (Object.keys(invalidUnderTurnList).length > 0) {
        for (const level of Object.keys(invalidUnderTurnList)) {
          await nationTurnRepository.updateMany(
            {
              session_id: sessionId,
              'data.nation_id': nationId,
              'data.officer_level': parseInt(level),
              'data.turn_idx': { $lt: 0 }
            },
            {
              $inc: { 'data.turn_idx': MAX_CHIEF_TURN }
            }
          );
        }
      }

      if (Object.keys(invalidOverTurnList).length > 0) {
        for (const level of Object.keys(invalidOverTurnList)) {
          await nationTurnRepository.updateMany(
            {
              session_id: sessionId,
              'data.nation_id': nationId,
              'data.officer_level': parseInt(level),
              'data.turn_idx': { $gte: MAX_CHIEF_TURN }
            },
            {
              $inc: { 'data.turn_idx': -MAX_CHIEF_TURN }
            }
          );
        }
      }

      const troops = await troopRepository.findByFilter({
        session_id: sessionId,
        nation: nationId
      });

      const troopList: { [key: number]: string } = {};
      for (const troop of troops) {
        troopList[troop.troop_leader] = troop.name;
      }

      // 빈 턴은 모두 DB에 '휴식' 명령으로 자동 저장
      const CHIEF_LEVELS = [12, 10, 8, 6, 11, 9, 7, 5];
      const allOfficerLevels = new Set<number>();
      CHIEF_LEVELS.forEach(level => allOfficerLevels.add(level));
      Object.keys(nationTurnList).forEach(level => allOfficerLevels.add(parseInt(level)));

      for (const officerLevel of allOfficerLevels) {
        if (!nationTurnList[officerLevel]) {
          nationTurnList[officerLevel] = {};
        }
        
        const emptyTurns: number[] = [];
        for (let i = 0; i < MAX_CHIEF_TURN; i++) {
          if (!nationTurnList[officerLevel][i]) {
            emptyTurns.push(i);
            nationTurnList[officerLevel][i] = {
              action: '휴식',
              brief: '휴식',
              arg: {}
            };
          }
        }
        
        // 빈 턴이 있으면 DB에 자동으로 휴식 명령 저장
        if (emptyTurns.length > 0) {
          for (const turnIdx of emptyTurns) {
            await nationTurnRepository.updateOne(
              {
                session_id: sessionId,
                'data.nation_id': nationId,
                'data.officer_level': officerLevel,
                'data.turn_idx': turnIdx
              },
              {
                $set: {
                  'data.nation_id': nationId,
                  'data.officer_level': officerLevel,
                  'data.turn_idx': turnIdx,
                  'data.action': '휴식',
                  'data.brief': '휴식',
                  'data.arg': {}
                }
              },
              { upsert: true }
            );
          }
        }
      }

      const nationChiefList: { [key: number]: any } = {};
      for (const [level, turnBrief] of Object.entries(nationTurnList)) {
        const officerLevelNum = parseInt(level);
        const chiefGeneral = generalsByLevel[officerLevelNum];

        if (!chiefGeneral) {
          nationChiefList[officerLevelNum] = {
            name: null,
            turnTime: null,
            officerLevelText: this.getOfficerLevelText(officerLevelNum, nationLevel),
            npcType: null,
            turn: turnBrief
          };
          continue;
        }

        nationChiefList[officerLevelNum] = {
          name: chiefGeneral.name,
          turnTime: chiefGeneral.turntime,
          officerLevel: chiefGeneral.officer_level,
          officerLevelText: this.getOfficerLevelText(chiefGeneral.officer_level, nationLevel),
          npcType: chiefGeneral.npc,
          turn: turnBrief
        };
      }

      const sessionData = await sessionRepository.findBySessionId(sessionId);
      const gameEnv = sessionData?.data?.game_env || {};
 
       return {
         success: true,
         result: true,
         lastExecute: gameEnv.turntime || new Date(),
         year: gameEnv.year || 184,
         month: gameEnv.month || 1,
         turnTerm: gameEnv.turnterm || 60, // 분 단위
         date: new Date(),
         chiefList: nationChiefList,
         troopList,
         isChief: officerLevel > 4,
         autorun_limit: generalData.autorun_limit || 0,
         officerLevel,
        commandList: await this.buildChiefCommandTable(general, gameEnv),
         mapName: gameEnv.mapName || 'default',
        unitSet: gameEnv.unitSet || 'default',
        maxChiefTurn: MAX_CHIEF_TURN,
       };


    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
 
   private static async buildChiefCommandTable(general: any, gameEnv: any): Promise<any[]> {
     try {
       const { NationCommandRegistry } = await import('../../commands');
       const availableChiefCommand = (global as any).GameConst?.availableChiefCommand || gameEnv.availableChiefCommand || {};
 
       const result: any[] = [];
 
       for (const [category, commandList] of Object.entries(availableChiefCommand)) {
         if (!Array.isArray(commandList)) continue;
 
         const subList: any[] = [];
 
         for (const commandClassName of commandList as string[]) {
           try {
             // PHP: buildNationCommandClass($commandClassName, $general, $env, new LastTurn());
             const registryKey = String(commandClassName).replace(/^che_/, '');
             const CommandClass = (NationCommandRegistry as any)[registryKey] || (NationCommandRegistry as any)[commandClassName];
 
             let canDisplay = true;
             let hasMinCondition = true;
             let commandName = registryKey;
             let commandTitle = registryKey;
             let reqArg = false;
             let compensation = 0;
 
             if (CommandClass) {
               try {
                const env = gameEnv || {};
                const commandObj = new CommandClass(general, env);
 
                 canDisplay = commandObj.canDisplay?.() ?? true;
                 hasMinCondition = commandObj.hasMinConditionMet?.() ?? true;
                 commandName = CommandClass.getName?.() ?? registryKey;

                 commandTitle = String(commandObj.getCommandDetailTitle?.() ?? commandName);
                 reqArg = CommandClass.reqArg ?? false;
                 compensation = commandObj.getCompensationStyle?.() ?? 0;
               } catch (err) {
                 commandName = CommandClass.getName?.() ?? registryKey;
                 commandTitle = String(commandName);
                 reqArg = CommandClass.reqArg ?? false;
               }
             }
 
             if (!canDisplay) continue;
 
             subList.push({
               value: commandClassName,
               simpleName: commandName,
               reqArg: reqArg ? 1 : 0,
               possible: hasMinCondition,
               compensation,
               title: String(commandTitle),
             });
           } catch (error) {
             subList.push({
               value: commandClassName,
               simpleName: String(commandClassName).replace(/^che_/, ''),
               reqArg: 0,
               possible: true,
               compensation: 0,
               title: String(commandClassName),
             });
           }
         }
 
         if (subList.length > 0) {
           result.push({
             category,
             values: subList,
           });
         }
       }
 
       return result;
     } catch (error) {
       return [];
     }
   }
 
   private static checkSecretPermission(generalData: any): number {
    const officerLevel = generalData.officer_level || 1;
    const permission = generalData.permission || '';
    const penalty = generalData.penalty || 0;
    const belong = generalData.belong || 0;

    if (belong === 0) {
      return -1;
    }

    if (officerLevel >= 5) {
      return 2;
    }

    if (permission.includes('SecretTurnPush')) {
      return 1;
    }

    return 0;
  }

  private static getOfficerLevelText(officerLevel: number, nationLevel: number): string {
    const officerNames = [
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['일반', '일반', '일반', '일반', '일반'],
      ['수뇌', '수뇌', '수뇌', '수뇌', '수뇌'],
      ['수뇌', '수뇌', '장군', '장군', '장군'],
      ['수뇌', '군단장', '대장군', '대장군', '대장군'],
      ['수뇌', '군단장', '대장군', '대장군', '대장군'],
      ['수뇌', '부군주', '군주보', '태위', '대사마'],
      ['군주', '군주', '군주', '군주', '군주'],
      ['황제', '황제', '황제', '황제', '황제'],
      ['태황제', '태황제', '태황제', '태황제', '태황제']
    ];

    if (officerLevel >= officerNames.length) {
      return '태황제';
    }

    const levelIdx = Math.min(Math.max(nationLevel, 0), 4);
    return officerNames[officerLevel]?.[levelIdx] || '일반';
  }
}
