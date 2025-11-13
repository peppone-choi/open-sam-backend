import * as generalCommands from './general';
import * as nationCommands from './nation';

// 영문 커맨드 타입 → 한글 매핑 (레거시 DB 호환)
const englishToKoreanCommandMap: Record<string, string> = {
  'REST': '휴식',
  'TRAIN': '단련',
  'HEAL': '치료',
  'RECRUIT': '모집',
  'CONSCRIPT': '징병',
  'MOVE': '이동',
  'RETURN': '귀환',
  'BORDER_RETURN': '접경귀환',
  'CULTIVATE_FARM': '농업',
  'INVEST_COMMERCE': '상업',
  'RESEARCH_TECH': '기술연구',
  'REINFORCE_DEFENSE': '방어',
  'REINFORCE_SECURITY': '치안',
  'REPAIR_WALL': '성벽',
  'INTENSIVE_TRAINING': '집중훈련',
  'TRAIN_TROOPS': '부대훈련',
  'BOOST_MORALE': '사기',
  'DEPLOY': '출병',
  'FOUND_NATION': '건국',
  'RANDOM_FOUND_NATION': '무작위건국',
  'ABDICATE': '하야',
  'RETIRE': '은퇴',
  'SEARCH_TALENT': '인재등용',
  'DISBAND': '해산',
  'SIGHTSEEING': '견문',
  'TRADE_RICE': '군량매매',
  'CULTIVATE_LAND': '농지개간',
  'ABDICATE_TO': '선양',
  'NPC_AUTO': 'NPC능동',
  'WANDER': '방랑',
  'TRAVEL': '순행',
  'RECRUIT_SOLDIERS': '모병',
  'PROCURE_SUPPLY': '물자조달',
  'BATTLE_STANCE': '전투태세',
  'RESET_BATTLE_SKILL': '전투특기초기화',
  'RESET_ADMIN_SKILL': '내정특기초기화',
  'ENCOURAGE_SETTLEMENT': '정착장려',
  'SELECT_CITIZEN': '주민선정',
  'GRANT': '증여',
  'DONATE': '헌납',
  'PLUNDER': '탈취',
  'DESTROY': '파괴',
  'FIRE_ATTACK': '화계',
  'FORCE_MARCH': '강행',
  'GATHER': '집합',
  'RAISE_ARMY': '거병',
  'SPY': '첩보',
  'RECRUIT_GENERAL': '등용',
  'ACCEPT_RECRUIT': '등용수락',
  'JOIN_NATION': '임관',
  'RANDOM_JOIN_NATION': '랜덤임관',
  'ATTEMPT_REBELLION': '모반시도',
  'AGITATE': '선동',
  'TRADE_EQUIPMENT': '장비매매',
  'TRADE_MILITARY': '군사매매',
  'CONVERT_EXP': '숙련전환',
  'REST_CURE': '요양',
  'REPAIR_WALL_EXTEND': '성벽보수',
  'DISMISS_TROOPS': '소집해제',
  'REINFORCE_DEFENSE_EXTEND': '수비강화',
  'JOIN_GENERAL_NATION': '장수대상임관',
};

const englishToKoreanNationCommandMap: Record<string, string> = {
  'REDUCE_FORCE': '감축',
  'RAID': '급습',
  'COUNTER_ATTACK': '피장파장',
  'RANDOM_CAPITAL_MOVE': '무작위수도이전',
  'APPOINT_OFFICER': '발령',
  'DECLARE_WAR': '선전포고',
  'EXPAND': '증축',
  'MOVE_CAPITAL': '천도',
  'REWARD': '포상',
  'CR_POPULATION_MOVE': '인구이동',
  'REST': '휴식',
  // che_ 접두사가 붙은 커맨드들은 한글명 그대로 사용
  '국기변경': '국기변경',
  '국호변경': '국호변경',
  '몰수': '몰수',
  '물자원조': '물자원조',
  '백성동원': '백성동원',
  '부대탈퇴지시': '부대탈퇴지시',
  '불가침수락': '불가침수락',
  '불가침제의': '불가침제의',
  '불가침파기수락': '불가침파기수락',
  '불가침파기제의': '불가침파기제의',
  '수몰': '수몰',
  '의병모집': '의병모집',
  '이호경식': '이호경식',
  '종전수락': '종전수락',
  '종전제의': '종전제의',
  '초토화': '초토화',
  '필사즉생': '필사즉생',
  '허보': '허보',
  // event_ 접두사가 붙은 커맨드들도 한글명 그대로
  '극병연구': '극병연구',
  '대검병연구': '대검병연구',
  '무희연구': '무희연구',
  '산저병연구': '산저병연구',
  '상병연구': '상병연구',
  '원융노병연구': '원융노병연구',
  '음귀병연구': '음귀병연구',
  '화륜차연구': '화륜차연구',
  '화시병연구': '화시병연구',
};

export const CommandRegistry: Record<string, any> = {
  '휴식': generalCommands.RestCommand,
  '단련': generalCommands.TrainCommand,
  '치료': generalCommands.HealCommand,
  '모집': generalCommands.RecruitCommand,
  '징병': generalCommands.ConscriptCommand,
  '이동': generalCommands.MoveCommand,
  '귀환': generalCommands.ReturnCommand,
  '접경귀환': generalCommands.BorderReturnCommand,
  '농업': generalCommands.CultivateFarmCommand,
  '상업': generalCommands.InvestCommerceCommand,
  '기술연구': generalCommands.ResearchTechCommand,
  '방어': generalCommands.ReinforceDefenseCommand,
  '치안': generalCommands.ReinforceSecurityCommand,
  '성벽': generalCommands.RepairWallCommand,
  '집중훈련': generalCommands.IntensiveTrainingCommand,
  '부대훈련': generalCommands.TrainTroopsCommand,
  '사기': generalCommands.BoostMoraleCommand,
  '출병': generalCommands.DeployCommand,
  '건국': generalCommands.FoundNationCommand,
  '무작위건국': generalCommands.RandomFoundNationCommand,
  '하야': generalCommands.AbdicateCommand,
  '은퇴': generalCommands.RetireCommand,
  '인재등용': generalCommands.SearchTalentCommand,
  '해산': generalCommands.DisbandCommand,
  '견문': generalCommands.SightseeingCommand,
  '군량매매': generalCommands.TradeRiceCommand,
  '농지개간': generalCommands.CultivateLandCommand,
  '선양': generalCommands.AbdicateToCommand,
  'NPC능동': generalCommands.NpcAutoCommand,
  '방랑': generalCommands.WanderCommand,
  '순행': generalCommands.TravelCommand,
  '모병': generalCommands.RecruitSoldiersCommand,
  '물자조달': generalCommands.ProcureSupplyCommand,
  '전투태세': generalCommands.BattleStanceCommand,
  '전투특기초기화': generalCommands.ResetBattleSkillCommand,
  '내정특기초기화': generalCommands.ResetAdminSkillCommand,
  '정착장려': generalCommands.EncourageSettlementCommand,
  '주민선정': generalCommands.GoodGovernanceCommand,
  '증여': generalCommands.GrantCommand,
  '헌납': generalCommands.DonateCommand,
  '탈취': generalCommands.PlunderCommand,
  '파괴': generalCommands.DestroyCommand,
  '화계': generalCommands.FireAttackCommand,
  '강행': generalCommands.ForceMarchCommand,
  '집합': generalCommands.GatherCommand,
  '거병': generalCommands.RaiseArmyCommand,
  '첩보': generalCommands.SpyCommand,
  '등용': generalCommands.RecruitGeneralCommand,
  '등용수락': generalCommands.AcceptRecruitCommand,
  '임관': generalCommands.JoinNationCommand,
  '랜덤임관': generalCommands.RandomJoinNationCommand,
  '모반시도': generalCommands.AttemptRebellionCommand,
  '선동': generalCommands.AgitateCommand,
  '장비매매': generalCommands.TradeEquipmentCommand,
  '군사매매': generalCommands.TradeMilitaryCommand,
  '숙련전환': generalCommands.ConvertExpCommand,
  '요양': generalCommands.RestCureCommand,
  '성벽보수': generalCommands.RepairWallExtendCommand,
  '소집해제': generalCommands.DismissTroopsCommand,
  '수비강화': generalCommands.ReinforceDefenseExtendCommand,
  '장수대상임관': generalCommands.JoinGeneralNationCommand,
};

export const NationCommandRegistry: Record<string, any> = {
  '감축': nationCommands.ReduceForceCommand,
  '국기변경': nationCommands.che_국기변경,
  '국호변경': nationCommands.che_국호변경,
  '급습': nationCommands.RaidCommand,
  '피장파장': nationCommands.CounterAttackCommand,
  '몰수': nationCommands.che_몰수,
  '무작위수도이전': nationCommands.RandomCapitalMoveCommand,
  '물자원조': nationCommands.che_물자원조,
  '발령': nationCommands.AppointOfficerCommand,
  '백성동원': nationCommands.che_백성동원,
  '부대탈퇴지시': nationCommands.che_부대탈퇴지시,
  '불가침수락': nationCommands.che_불가침수락,
  '불가침제의': nationCommands.che_불가침제의,
  '불가침파기수락': nationCommands.che_불가침파기수락,
  '불가침파기제의': nationCommands.che_불가침파기제의,
  '선전포고': nationCommands.DeclareWarCommand,
  '수몰': nationCommands.che_수몰,
  '의병모집': nationCommands.che_의병모집,
  '이호경식': nationCommands.che_이호경식,
  '종전수락': nationCommands.che_종전수락,
  '종전제의': nationCommands.che_종전제의,
  '증축': nationCommands.ExpandCommand,
  '천도': nationCommands.MoveCapitalCommand,
  '초토화': nationCommands.che_초토화,
  '포상': nationCommands.RewardCommand,
  '필사즉생': nationCommands.che_필사즉생,
  '허보': nationCommands.che_허보,
  '인구이동': nationCommands.CrPopulationMoveCommand,
  '극병연구': nationCommands.event_극병연구,
  '대검병연구': nationCommands.event_대검병연구,
  '무희연구': nationCommands.event_무희연구,
  '산저병연구': nationCommands.event_산저병연구,
  '상병연구': nationCommands.event_상병연구,
  '원융노병연구': nationCommands.event_원융노병연구,
  '음귀병연구': nationCommands.event_음귀병연구,
  '화륜차연구': nationCommands.event_화륜차연구,
  '화시병연구': nationCommands.event_화시병연구,
  '휴식': nationCommands.RestCommand,
};

export function getCommand(action: string) {
  // 1. 한글 커맨드명으로 직접 조회
  if (CommandRegistry[action]) {
    return CommandRegistry[action];
  }
  
  // 2. 영문 타입 (INVEST_COMMERCE 등)을 한글로 변환
  const koreanName = englishToKoreanCommandMap[action];
  if (koreanName && CommandRegistry[koreanName]) {
    return CommandRegistry[koreanName];
  }
  
  return null;
}

export function getNationCommand(action: string) {
  // 1. 한글 커맨드명으로 직접 조회
  if (NationCommandRegistry[action]) {
    return NationCommandRegistry[action];
  }
  
  // 2. 영문 타입을 한글로 변환
  const koreanName = englishToKoreanNationCommandMap[action];
  if (koreanName && NationCommandRegistry[koreanName]) {
    return NationCommandRegistry[koreanName];
  }
  
  return null;
}

export * from './base/BaseCommand';
export * from './base/GeneralCommand';
export * from './base/NationCommand';
