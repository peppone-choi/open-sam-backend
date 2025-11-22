# 유닛 기반 병력/수비 리팩터링

도시 성벽/수비군 분리와 장수 병력 유닛화를 지원하기 위해 다음 시스템을 도입한다.

## 1. 핵심 데이터 모델

| 모델 | 설명 |
| --- | --- |
| `UnitStack` | 장수·도시 공통의 병력 스택. 기본 100명 단위로 병종, 훈련도, 사기, 장비, HP를 관리한다. |
| `CityDefenseState` | 각 도시의 성벽, 성문, 탑 등 방어 시설 내구도와 복구 속도를 추적한다. |

### UnitStack 주요 필드
- `owner_type`, `owner_id`: `city`, `general` 등 소유 주체
- `crew_type_id`, `crew_type_name`: 병종 정보 (전투·로그 노출 시 사용)
- `unit_size`, `stack_count`: 기본 100명 단위, 총 병력은 `unit_size × stack_count`
- `train`, `morale`, `hp`, `attack`, `defence`: 전투 계산에 필요한 수치
- `equipment`: 장비/버프 메타데이터 (향후 확장)

### CityDefenseState 주요 필드
- `wall_max / wall_hp`, `gate_max / gate_hp`: 성벽·성문 내구도
- `tower_level`, `repair_rate`: 시설 강화 수치
- `last_damage_at`, `last_repair_at`: 로그/이벤트 트래킹

## 2. 리포지토리/서비스
- `unit-stack.repository`: 소유자별 유닛 조회, 스택 분할/병합, 이동 지원
- `city-defense.repository`: 도시 방어 상태 보장, 피해/수리 처리
- `UnitTransferService`: 커맨드·전투 로직에서 사용할 공용 유닛 이동 API (분할 → 이동 → 병합)

## 3. 명령/시스템 반영 계획
1. **징병/모병**: `UnitStack` 생성 또는 기존 스택 `stack_count` 증가로 변경
2. **재배치/수비 지시**: `UnitTransferService.transfer` 사용해 도시 ↔ 장수 간 스택 이동
3. **전투 처리**: 전투 엔진에서 양측 `UnitStack`을 불러와 피해를 `hp`, `stack_count`에 반영
4. **성벽 커맨드**: `CityDefenseState.repair`/`applyDamage` 활용해 ‘성벽 수리/강화’ 명령 구현
5. **정보 패널/로그**: `UnitStack.troop_count`를 합산하여 “병종 + 총병력” 형태로 출력

## 4. 후속 작업 체크리스트
- [ ] 기존 `General`/`City` 문서에 남아 있는 `crew`, `def`, `wall` 현행화 로직 작성
- [ ] 전투/징병 커맨드가 새 시스템을 사용하도록 포팅
- [ ] 마이그레이션 스크립트: 기존 병력/성벽 데이터를 `UnitStack`/`CityDefenseState`로 이동
- [ ] API/프론트엔드 수정: 유닛 리스트, 성벽 HP 노출
- [ ] 게임 로그 포맷 정비 ("호표기 300명 전사" 등)

## 5. 기존 참조 지점 (Inventory)

### 장수 병력(`data.crew`, `crewtype`, `train`, `atmos`) 사용처
- 커맨드: `deploy.ts`, `conscript.ts`, `recruitSoldiers.ts`, `dismiss.ts`, `dismissTroops.ts`, `boostMorale.ts`, `train.ts`, `trainTroops.ts`, `intensiveTraining.ts`, `battleStance.ts`, `foundNation.ts`, `randomFoundNation.ts` 등
- 서비스/라우트: `GetFrontInfo.service.ts`, `AdminNationStats.service.ts`, 여러 REST 라우트(`game.routes.ts` 장수 정보 직렬화)
- 테스트 헬퍼: `src/commands/__tests__/test-helpers.ts`

### 도시 성벽/수비(`city.wall`, `wall_max`, `def`) 사용처
- 커맨드: `destroy.ts`, `repairWall.ts`, `repairWallExtend.ts`, `spy.ts`, `mobilizeCitizens.ts`, `scorchedEarth.ts`, `nation/reduceForce.ts`, `nation/expand.ts`
- 서비스: `StartBattle.service.ts` (지형/성벽 보정), `ProcessWar.service.ts`, `GenerateDefaultMaps.service.ts`, `BattleCreation.service.ts`, `GetFrontInfo.service.ts`
- 초기화/관리: `init.service.ts`, `scenario-reset.service.ts`
- 로깅/통계: `AdminNationStats.service.ts`

이 목록은 리팩터링 시 우선적으로 업데이트해야 하는 접점을 추적하기 위한 것이며, 파일 변경 시 함께 유지보수한다.

이 문서는 유닛 기반 리팩터링의 기준점이며, 각 단계별 구현 후 상태를 업데이트한다.
