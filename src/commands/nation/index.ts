// 국가 커맨드 - 모든 38개 커맨드 export

// 1. che_감축 - 감축
export { ReduceForceCommand } from './reduceForce';

// 2. che_국기변경 - 국기변경
export { che_국기변경, che_국기변경 as ChangeFlagCommand } from './changeFlag';

// 3. che_국호변경 - 국호변경
export { che_국호변경, che_국호변경 as ChangeNationNameCommand } from './changeNationName';

// 4. che_급습 - 급습
export { RaidCommand } from './raid';
// 4-1. che_피장파장 - 피장파장
export { che_피장파장, che_피장파장 as CounterAttackCommand } from './counterAttack';

// 5. che_몰수 - 몰수
export { che_몰수, che_몰수 as ConfiscateCommand } from './confiscate';

// 6. che_무작위수도이전 - 무작위 수도 이전
export { che_무작위수도이전, che_무작위수도이전 as RandomCapitalMoveCommand } from './randomCapitalMove';

// 7. che_물자원조 - 물자원조
export { che_물자원조, che_물자원조 as SendSuppliesCommand } from './sendSupplies';

// 8. che_발령 - 발령
export { che_발령 as AppointOfficerCommand } from './appointOfficer';

// 9. che_백성동원 - 백성동원
export { che_백성동원, che_백성동원 as MobilizeCitizensCommand } from './mobilizeCitizens';

// 10. che_부대탈퇴지시 - 부대탈퇴지시
export { che_부대탈퇴지시, che_부대탈퇴지시 as DisbandTroopOrderCommand } from './disbandTroopOrder';

// 11. che_불가침수락 - 불가침 수락
export { che_불가침수락, che_불가침수락 as AcceptNonAggressionCommand } from './acceptNonAggression';

// 12. che_불가침제의 - 불가침 제의
export { che_불가침제의, che_불가침제의 as ProposeNonAggressionCommand } from './proposeNonAggression';

// 13. che_불가침파기수락 - 불가침 파기 수락
export { che_불가침파기수락, che_불가침파기수락 as AcceptBreakNonAggressionCommand } from './acceptBreakNonAggression';

// 14. che_불가침파기제의 - 불가침 파기 제의
export { che_불가침파기제의, che_불가침파기제의 as ProposeBreakNonAggressionCommand } from './proposeBreakNonAggression';

// 15. che_선전포고 - 선전포고
export { che_선전포고 as DeclareWarCommand } from './declareWar';

// 16. che_수몰 - 수몰
export { che_수몰, che_수몰 as FloodCommand } from './flood';

// 17. che_의병모집 - 의병모집
export { che_의병모집, che_의병모집 as RecruitMilitiaCommand } from './recruitMilitia';

// 18. che_이호경식 - 이호경식
export { che_이호경식, che_이호경식 as RelocatePopulationCommand } from './relocatePopulation';

// 19. che_종전수락 - 종전 수락
export { che_종전수락, che_종전수락 as AcceptPeaceCommand } from './acceptPeace';

// 20. che_종전제의 - 종전 제의
export { che_종전제의, che_종전제의 as ProposePeaceCommand } from './proposePeace';

// 21. che_증축 - 증축
export { che_증축 as ExpandCommand } from './expand';

// 22. che_천도 - 천도
export { che_천도 as MoveCapitalCommand } from './moveCapital';

// 23. che_초토화 - 초토화
export { che_초토화, che_초토화 as ScorchedEarthCommand } from './scorchedEarth';

// 24. che_포상 - 포상
export { che_포상 as RewardCommand } from './reward';

// 25. che_피장파장 - 피장파장 (duplicate - same as line 4)

// 26. che_필사즉생 - 필사즉생
export { che_필사즉생, che_필사즉생 as DesperateDefenseCommand } from './desperateDefense';

// 27. che_허보 - 허보
export { che_허보, che_허보 as DisinformationCommand } from './disinformation';

// 28. cr_인구이동 - 인구이동
export { cr_인구이동, cr_인구이동 as CrPopulationMoveCommand } from './crPopulationMove';

// 29. event_극병연구 - 극병 연구 (Note: 원융노병 in eventCrossbowResearch.ts)
export { event_원융노병연구, event_원융노병연구 as EventCrossbowResearchCommand } from './eventCrossbowResearch';

// 30. event_대검병연구 - 대검병 연구
export { event_대검병연구, event_대검병연구 as EventGreatswordResearchCommand } from './eventGreatswordResearch';

// 31. event_무희연구 - 무희 연구
export { event_무희연구, event_무희연구 as EventDancerResearchCommand } from './eventDancerResearch';

// 32. event_산저병연구 - 산저병 연구
export { event_산저병연구, event_산저병연구 as EventMountainResearchCommand } from './eventMountainResearch';

// 33. event_상병연구 - 상병 연구
export { event_상병연구, event_상병연구 as EventElephantResearchCommand } from './eventElephantResearch';

// 34. event_원융노병연구 - 원융노병 연구 (Note: 극병 in eventPikeResearch.ts)
export { event_극병연구, event_극병연구 as EventPikeResearchCommand } from './eventPikeResearch';

// 35. event_음귀병연구 - 음귀병 연구
export { event_음귀병연구, event_음귀병연구 as EventShadowResearchCommand } from './eventShadowResearch';

// 36. event_화륜차연구 - 화륜차 연구
export { event_화륜차연구, event_화륜차연구 as EventFireCartResearchCommand } from './eventFireCartResearch';

// 37. event_화시병연구 - 화시병 연구
export { event_화시병연구, event_화시병연구 as EventFireArrowResearchCommand } from './eventFireArrowResearch';

// 38. 휴식 - 휴식
export { RestCommand } from './rest';
