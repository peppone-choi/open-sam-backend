# 전투 포팅 주요 격차 분석

## 1. 전투 준비/데이터 로딩
- **수비국 정보 폴백**: PHP는 `nation` 테이블에서 즉시 조회하며 실패 시 에러를 띄우지 않지만, TS 구현(`src/battle/ProcessWar.ts:111-145`)은 예외 발생 시 `rawDefenderNation`이 정의되지 않은 상태로 남을 수 있습니다. 기본 객체를 확실히 채워 넣어야 이후 계산이 안정적으로 이뤄집니다.
- **도시 장수 로딩 시 필터**: PHP는 `General::createObjListFromDB`로 전투 당시의 정적 스냅샷을 확보(`core/hwe/process_war.php:43-55`). TS는 `generalRepository.findByFilter`를 사용하지만, `defence_train`, `train`, `atmos` 같은 필드가 빠진 상태의 plain 객체일 수 있어 수비 순서 계산이 틀릴 여지가 있습니다.

## 2. Battle Init/Phase 트리거 호출 누락
- **초기 스킬 트리거**: PHP는 새 전투가 시작될 때 `getBattleInitSkillTriggerList`를 양측에서 취합해 실행(`core/hwe/process_war.php:331-344`). TS 루프(`src/battle/ProcessWar.ts:379-414`)는 해당 호출이 없어 특기/아이템의 시작 효과가 전혀 발동하지 않습니다.
- **페이즈 스킬 트리거**: 매 페이즈마다 PHP는 `battleCaller->fire()`로 양측 트리거를 실행한 뒤 데미지를 계산(`core/hwe/process_war.php:337-347`). TS는 `beginPhase()`만 호출하고 바로 `calcDamage()`에 들어가므로, 필살/회피/저격 등 모든 페이즈 기반 스킬이 비활성 상태입니다.
- **아이템 사용/소모 처리**: PHP는 트리거 내부에서 `processConsumableItem()`을 통해 일회성 아이템을 소모합니다(`core/hwe/sammo/WarUnitTrigger/che_전투치료발동.php:28-33`). TS의 `BaseWarUnitTrigger.processConsumableItem()`은 미구현 상태(`src/game/triggers/BaseWarUnitTrigger.ts:38-46`), 실질적으로 어떤 아이템도 소비되지 않습니다.

## 3. 전투 루프 세부 로직 차이
- **전투력 상성 로그/상속 포인트**: PHP는 병종 상성 계수를 비교해 상속 포인트를 부여하는 로직이 있으나 주석 처리(`core/hwe/process_war.php:290-299`). TS에는 해당 로직 자체가 없습니다 (`src/battle/ProcessWar.ts:383-404`). 향후 상속 시스템도 고려하면 구현 필요.
- **Phase 닉네임/선제 처리**: PHP는 `defender->getPhase() < 0`일 때 `先`으로 로그를 남기고 선제 공격을 표현(`core/hwe/process_war.php:375-386`). TS는 `defender?.getPhase()` 비교만 하고 선제 페이즈를 음수로 세팅하지 않아 동일한 로그를 만들 수 없습니다 (`src/battle/ProcessWar.ts:456-467`).
- **Truce/분쟁 처리 조건**: PHP는 `($city->getDead() || $defender instanceof WarUnitCity)` 조건에서 분쟁을 새로 기록하고, 필요 시 `setOppose` 재설정(`core/hwe/process_war.php:484-498`). TS도 유사한 블록이 있으나 `city !== defender` 조건을 지나치게 좁게 잡아 실제 분쟁이 발생하지 않는 경우가 있습니다 (`src/battle/ProcessWar.ts:561-575`).

## 4. 전투 후 정산 로직 누락
- **국가 타입/TechLimit 반영**: PHP는 국가 타입별 `onCalcDomestic`을 호출해 기술 상승량을 조정하고(`core/hwe/process_war.php:126-149`), `TechLimit` 조건을 통해 성장 한계를 부여(`core/hwe/process_war.php:153-157`). TS는 단순 상수 비율(1.2%, 0.9%)만 적용 (`src/battle/ProcessWar.ts:280-285`), 국가 특색이나 시대 제한이 반영되지 않습니다.
- **실제 장수 수 보정**: PHP는 실제 활동 장수 수(`gennum_eff`)를 조회해 기술 증가치를 다시 스케일링(`core/hwe/process_war.php:129-150`). TS는 해당 질량보정을 건너뜁니다.
- **도시 점령 처리**: PHP `ConquerCity`는 도시 소유권 변경, 수비 장수 이동, 전역 로그를 모두 수행 (`core/hwe/process_war.php:184-190`). TS `ConquerCity`는 TODO 상태로 대부분 미구현 (`src/battle/ProcessWar.ts:585-628`).

## 5. 로그/템플릿
- **템플릿 렌더링**: PHP는 Plates 템플릿(`$templates = new \League\Plates\Engine(...)`)을 사용해 전투 리포트를 생성 (`core/hwe/process_war.php:234-236`). TS는 동일한 템플릿 시스템을 사용하지 않아 UI에 필요한 HTML 로그가 누락됩니다.
- **전투 로그 상세도**: PHP는 `pushGlobalHistoryLog`, `pushGeneralBattleDetailLog`를 더 많은 지점에서 호출하고, Josa 처리/색상 태그가 표준화되어 있습니다. TS는 일부 로그만 남겨 정보량이 부족합니다 (`src/battle/ProcessWar.ts:458-493`).

## 6. 난수/재현성
- **RandUtil 소비 순서**: PHP는 트리거 실행 중 다양한 `RandUtil` 호출이 존재(예: 저격/격노/반계 트리거). TS는 아직 해당 트리거를 호출하지 않으므로 동일한 시드라도 난수 소비 순서가 크게 달라집니다. 이는 “같은 시드 → 같은 전투 결과” 요구사항을 충족하지 못하게 합니다.

## 7. 필요한 후속 작업 요약
1. `processWar_NG`에 `getBattleInitSkillTriggerList`/`getBattlePhaseSkillTriggerList` 호출을 추가하고, Special War 외 iAction(아이템, 국가, 성향 등)도 포함되도록 `GeneralSchema.getBattleActionList`를 확장합니다.
2. `BaseWarUnitTrigger.processConsumableItem`를 실제 아이템 소비 로직으로 구현하고, 각 Trigger에서 PHP와 동일한 환경 키(`magic`, `e_attacker`)를 세팅할 수 있도록 Env 타입을 확장합니다.
3. 전투 후 정산(`updateAttackerNation`, `ConquerCity`)을 PHP 로직과 동일하게 만들고, `TechLimit`, 장수 수 보정, 분쟁 발생 로그 등을 반영합니다.
4. Logger 호출 지점을 보강하여 PHP와 동일한 글로벌/개별 전투 로그가 쌓이도록 조정하고, 템플릿 출력 대체 방안을 마련합니다.
5. 위 작업이 끝나면 동일한 시드로 PHP/TS 전투를 실행하여 HP/로그/자원 변화가 일치하는지 비교하는 검증 스크립트를 추가합니다.
