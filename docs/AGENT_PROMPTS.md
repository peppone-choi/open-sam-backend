# 에이전트별 작업 프롬프트 및 참고 파일

## 개요

이 문서는 오픈 삼국 프로젝트의 전투 시스템 개발을 위해 각 에이전트에게 요청할 프롬프트와 참고해야 할 파일 목록을 정리합니다.

---

## 에이전트 1: 백엔드 전투 엔진 (삼국지 턴제)

### 작업 목표
삼국지 스타일의 그리드 기반 턴제 전투 엔진 완성

### 프롬프트

```
당신은 삼국지 스타일 턴제 전투 엔진 개발자입니다.

## 작업 내용
1. 기존 `BattleEngine.ts` 분석 및 개선
2. 40x40 그리드 기반 전투 맵 지원
3. 병종 상성 시스템 구현 (보병 < 기병 < 궁병 < 보병)
4. 진형(Formation) 시스템 완성
5. 턴제 전투 흐름: 이동 → 공격 → 반격 → 턴 종료
6. 전투 결과 로그 생성 (PHP 스타일)

## 기술 스택
- TypeScript, Node.js, MongoDB
- 기존 `Position3D` 타입 활용 (x, y, z)
- 그리드 좌표는 정수 (0-39)

## 주요 요구사항
- 최대 10개 유닛 vs 10개 유닛 전투 지원
- 각 유닛: 장수 + 병사(crew)
- 데미지 계산: 공격력 × 병사수 × 상성보정 × 지형보정
- 사기(morale) 시스템: 0이 되면 패주

## 참고
- units.json의 병종 데이터 활용
- 기존 BattleCalculator 로직 참조
```

### 참고 파일

#### 핵심 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/core/battle/BattleEngine.ts` | 기존 전투 엔진 |
| `open-sam-backend/src/core/battle/types.ts` | Position3D, IBattleUnit 타입 |
| `open-sam-backend/src/core/battle/BattleResolver.ts` | 전투 해결 로직 |
| `open-sam-backend/src/core/battle/BattleValidator.ts` | 액션 검증 |
| `open-sam-backend/src/core/battle/BattleAI.ts` | AI 결정 로직 |

#### 데이터 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/config/scenarios/sangokushi/data/units.json` | 병종 데이터 (ID, 공격력, 방어력 등) |
| `open-sam-backend/config/scenarios/sangokushi/data/constants.json` | 게임 상수 |

#### 참조 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/services/battle/BattleEngine.service.ts` | 전투 서비스 |
| `open-sam-backend/src/core/SimpleAI.ts` | AI 의사결정 (병종 선택 로직) |
| `open-sam-backend/docs/BATTLE_SYSTEM_IMPLEMENTATION.md` | 전투 시스템 문서 |

---

## 에이전트 2: 백엔드 전투 엔진 (은하영웅전설 실시간)

### 작업 목표
은하영웅전설 스타일의 연속좌표 기반 실시간 전투 엔진 완성

### 프롬프트

```
당신은 은하영웅전설 스타일 실시간 전투 엔진 개발자입니다.

## 작업 내용
1. 기존 `RealtimeCombat.service.ts` 분석 및 개선
2. 연속 좌표 시스템 (10000x10000) 완성
3. deltaTime 기반 이동 (50ms tick)
4. 함대 진형 시스템: 어린, 학익, 방원, 봉시, 장사
5. 사정거리 기반 공격 시스템
6. 실시간 WebSocket 통신

## 기술 스택
- TypeScript, Node.js, MongoDB, Redis
- WebSocket (Socket.io)
- 연속 좌표: float (0.0 ~ 10000.0)

## 주요 요구사항
- 함대 이동: velocity 기반 (속도 × deltaTime)
- 회전: facing 각도 (0-360)
- 공격: 사정거리 내 적 자동 타겟팅
- 진형별 공격/방어 보정
- 보급 시스템: 보급 부족 시 전투력 감소

## 참고
- LOGH7_MANUAL_SUMMARY.md의 전투 시스템 참조
- Fleet.model.ts의 strategicPosition, tacticalPosition 활용
```

### 참고 파일

#### 핵심 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/services/logh/RealtimeCombat.service.ts` | 실시간 전투 서비스 |
| `open-sam-backend/src/services/logh/FleetCombat.service.ts` | 함대 전투 로직 |
| `open-sam-backend/src/services/logh/FleetMovement.service.ts` | 함대 이동 로직 |
| `open-sam-backend/src/services/logh/RealtimeMovement.service.ts` | 실시간 이동 |
| `open-sam-backend/src/services/logh/WebSocketHandler.service.ts` | WebSocket 핸들러 |

#### 모델 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/models/logh/Fleet.model.ts` | 함대 모델 |
| `open-sam-backend/src/models/logh/Admiral.model.ts` | 제독 모델 |
| `open-sam-backend/src/models/logh/Ship.model.ts` | 함선 모델 |

#### 문서 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/docs/LOGH7_MANUAL_SUMMARY.md` | 은하영웅전설 VII 매뉴얼 요약 |
| `open-sam-backend/docs/GIN7_MODE.md` | GIN7 모드 문서 |

---

## 에이전트 3: 프론트엔드 전투 UI (삼국지)

### 작업 목표
삼국지 5 스타일의 그리드 기반 전투 UI 구현

### 프롬프트

```
당신은 삼국지 5 스타일 전투 UI 개발자입니다.

## 작업 내용
1. 40x40 그리드 전투 맵 렌더링
2. 유닛 스프라이트 표시 (병종별 아이콘)
3. 턴제 전투 UI: 이동 범위 표시, 공격 대상 선택
4. HP 바, 사기 바, 병사 수 표시
5. 전투 애니메이션: 공격, 피격, 크리티컬
6. 전투 로그 패널

## 기술 스택
- Next.js 16, React 19, TypeScript
- CSS Modules
- Canvas 또는 DOM 기반 렌더링

## 주요 요구사항
- 반응형 디자인 (모바일 지원)
- 유닛 클릭 시 정보 패널 표시
- 이동 가능 범위 하이라이트 (파란색)
- 공격 가능 범위 하이라이트 (빨간색)
- 턴 진행 버튼 및 자동 전투 옵션

## 디자인 참고
- 삼국지 5 스타일: 작은 유닛 아이콘, 깔끔한 그리드
- 아기자기한 느낌, 복고풍 픽셀아트
```

### 참고 파일

#### 핵심 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/components/battle/BattleMap.tsx` | 기존 전투 맵 컴포넌트 |
| `open-sam-front/src/components/battle/BattleMap.module.css` | 전투 맵 스타일 |
| `open-sam-front/src/components/battle/UnitSprite.tsx` | 유닛 스프라이트 |
| `open-sam-front/src/components/battle/BattleResultLog.tsx` | 전투 결과 로그 |
| `open-sam-front/src/components/battle/BattleResultLog.module.css` | 결과 로그 스타일 |

#### 애니메이션 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/components/battle/AttackAnimation.tsx` | 공격 애니메이션 |
| `open-sam-front/src/components/battle/DefendAnimation.tsx` | 방어 애니메이션 |
| `open-sam-front/src/components/battle/CriticalEffect.tsx` | 크리티컬 이펙트 |
| `open-sam-front/src/components/battle/EvadeEffect.tsx` | 회피 이펙트 |
| `open-sam-front/src/components/battle/HPBar.tsx` | HP 바 |

#### 에셋 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/public/assets/units/` | 유닛 PNG 이미지 |
| `open-sam-front/public/assets/icons/` | 아이콘 이미지 |

#### 타입 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/types/battle.ts` | 전투 관련 타입 정의 |

---

## 에이전트 4: 프론트엔드 전투 UI (은하영웅전설)

### 작업 목표
은하영웅전설 스타일의 실시간 전술 맵 UI 구현

### 프롬프트

```
당신은 은하영웅전설 스타일 실시간 전술 UI 개발자입니다.

## 작업 내용
1. 10000x10000 연속좌표 전술 맵 렌더링 (Canvas)
2. 함대 아이콘 및 진형 표시
3. 실시간 이동 애니메이션 (WebSocket)
4. 공격 범위 및 사정거리 표시
5. 함대 정보 HUD: HP, 사기, 보급, 함선 수
6. 명령 패널: 이동, 공격, 진형 변경, 후퇴

## 기술 스택
- Next.js 16, React 19, TypeScript
- Canvas API 또는 Three.js
- WebSocket (Socket.io-client)

## 주요 요구사항
- 부드러운 60fps 렌더링
- 줌 인/아웃 기능
- 미니맵 표시
- 함대 선택 및 드래그 이동
- 진형별 시각적 표현

## 디자인 참고
- 우주 배경 (별, 성운)
- 함대는 화살표 또는 함선 아이콘으로 표시
- SF 느낌의 UI (네온, 홀로그램 스타일)
```

### 참고 파일

#### 핵심 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/components/logh/TacticalMap.tsx` | 전술 맵 컴포넌트 |
| `open-sam-front/src/components/logh/TacticalHUD.tsx` | 전술 HUD |
| `open-sam-front/src/components/logh/TacticalSteeringPanel.tsx` | 조종 패널 |
| `open-sam-front/src/components/logh/StrategicMap.tsx` | 전략 맵 |
| `open-sam-front/src/components/logh/SteeringPanel.tsx` | 조종 패널 |

#### Canvas/3D 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/components/battle/BattleCanvas.tsx` | Canvas 기반 전투 |
| `open-sam-front/src/components/battle/ThreeBattleMap.tsx` | Three.js 전투 맵 |
| `open-sam-front/src/components/battle/ThreeTacticalMap.tsx` | Three.js 전술 맵 |

#### HUD 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-front/src/components/logh/EconomyHUD.tsx` | 경제 HUD |
| `open-sam-front/src/components/logh/GroundCombatHUD.tsx` | 지상전 HUD |
| `open-sam-front/src/components/logh/StarGrid.tsx` | 별 그리드 |

---

## 에이전트 5: 통합 전투 시스템 아키텍처

### 작업 목표
삼국지와 은하영웅전설 전투 시스템을 통합하는 추상화 레이어 설계

### 프롬프트

```
당신은 게임 엔진 아키텍트입니다.

## 작업 내용
1. 통합 Position 시스템 설계
   - GridPosition (정수 좌표, 삼국지용)
   - ContinuousPosition (실수 좌표, 은영전용)
   - 상호 변환 유틸리티

2. 통합 Unit 인터페이스 설계
   - IUnit: 공통 속성 (id, name, hp, position)
   - ISamgukjiUnit extends IUnit: 병종, 병사수, 장수
   - ILoghUnit extends IUnit: 함선, 함대, 제독

3. 통합 Battle 인터페이스 설계
   - IBattle: 공통 전투 로직
   - ITurnBasedBattle: 턴제 전투 (삼국지)
   - IRealtimeBattle: 실시간 전투 (은영전)

4. 이벤트 시스템 설계
   - BattleEvent: 전투 이벤트 타입
   - EventEmitter 패턴으로 UI 연동

## 기술 스택
- TypeScript
- 의존성 주입 (DI) 패턴
- 이벤트 기반 아키텍처

## 주요 요구사항
- 기존 코드 최대한 활용
- 새 게임 추가 시 확장 용이
- 테스트 용이한 구조
```

### 참고 파일

#### 타입/인터페이스 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/core/battle/types.ts` | 기존 전투 타입 |
| `open-sam-backend/src/models/battle.model.ts` | 전투 모델 |
| `open-sam-backend/src/models/logh/Fleet.model.ts` | 함대 모델 |
| `open-sam-front/src/types/battle.ts` | 프론트엔드 전투 타입 |

#### 서비스 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/services/battle/BattleEngine.service.ts` | 전투 엔진 서비스 |
| `open-sam-backend/src/services/logh/RealtimeCombat.service.ts` | 실시간 전투 서비스 |
| `open-sam-backend/src/services/logh/WebSocketHandler.service.ts` | WebSocket 핸들러 |

#### 문서 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/docs/LOGH7_MANUAL_SUMMARY.md` | 은영전 매뉴얼 |
| `open-sam-backend/docs/BATTLE_SYSTEM_IMPLEMENTATION.md` | 전투 시스템 문서 |
| `open-sam-backend/docs/AUTO_BATTLE_CHECKLIST.md` | 자동전투 체크리스트 |

---

## 에이전트 6: 테스트 및 QA

### 작업 목표
전투 시스템 테스트 및 품질 보증

### 프롬프트

```
당신은 게임 QA 엔지니어입니다.

## 작업 내용
1. 단위 테스트 작성
   - BattleEngine 테스트
   - 데미지 계산 테스트
   - 병종 상성 테스트

2. 통합 테스트 작성
   - 전투 흐름 테스트
   - WebSocket 통신 테스트
   - DB 저장/조회 테스트

3. E2E 테스트 작성 (Playwright)
   - 전투 UI 테스트
   - 유닛 이동/공격 테스트
   - 전투 결과 표시 테스트

4. 성능 테스트
   - 동시 전투 처리 테스트
   - 메모리 사용량 모니터링
   - 렌더링 성능 테스트

## 기술 스택
- Jest (단위/통합 테스트)
- Playwright (E2E 테스트)
- Artillery (부하 테스트)

## 주요 요구사항
- 커버리지 80% 이상
- CI/CD 파이프라인 연동
- 테스트 결과 리포트 생성
```

### 참고 파일

#### 기존 테스트 파일
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/src/services/logh/__tests__/` | LOGH 서비스 테스트 |
| `open-sam-front/src/components/logh/__tests__/` | LOGH 컴포넌트 테스트 |

#### 테스트 설정
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/jest.config.js` | Jest 설정 |
| `open-sam-backend/scripts/check-battle-readiness.ts` | 전투 준비 상태 체크 스크립트 |

#### 체크리스트
| 파일 경로 | 역할 |
|----------|------|
| `open-sam-backend/docs/AUTO_BATTLE_CHECKLIST.md` | 자동전투 체크리스트 |

---

## 공통 참고 자료

### 프로젝트 구조
```
오픈 삼국/
├── core/                    # PHP 레거시 (참고용)
├── open-sam-backend/        # Express + TypeScript 백엔드
│   ├── src/
│   │   ├── core/battle/     # 전투 엔진 코어
│   │   ├── services/battle/ # 전투 서비스
│   │   ├── services/logh/   # 은하영웅전설 서비스
│   │   └── models/          # 데이터 모델
│   ├── config/scenarios/    # 시나리오 데이터
│   └── docs/                # 문서
├── open-sam-front/          # Next.js 프론트엔드
│   ├── src/components/battle/ # 전투 컴포넌트
│   ├── src/components/logh/   # 은영전 컴포넌트
│   └── public/assets/       # 에셋 (이미지, 아이콘)
└── tools/                   # 유틸리티 스크립트
```

### 명령어
```bash
# 백엔드 개발 서버
cd open-sam-backend && npm run dev

# 프론트엔드 개발 서버
cd open-sam-front && npm run dev

# 테스트 실행
cd open-sam-backend && npm test

# 타입 체크
cd open-sam-backend && npm run typecheck
cd open-sam-front && npx tsc --noEmit
```

### 코드 스타일
- TypeScript strict 모드
- camelCase (함수/변수), PascalCase (클래스/컴포넌트)
- 한글 주석 허용
- ESLint/Prettier 적용

---

## 작업 우선순위

1. **에이전트 5 (아키텍처)**: 통합 인터페이스 설계 먼저
2. **에이전트 1 (삼국지 백엔드)**: 턴제 전투 엔진 완성
3. **에이전트 3 (삼국지 프론트엔드)**: 그리드 전투 UI
4. **에이전트 2 (은영전 백엔드)**: 실시간 전투 엔진
5. **에이전트 4 (은영전 프론트엔드)**: 전술 맵 UI
6. **에이전트 6 (테스트)**: 전체 테스트

---

---

## 빠른 참조: 에이전트별 상세 문서

| 에이전트 | 문서 파일 | 핵심 내용 |
|----------|----------|----------|
| 에이전트 1 | `AGENT_1_SAMGUKJI_BACKEND.md` | 삼국지 턴제 전투 엔진, 병종 상성, 진형 시스템 |
| 에이전트 2 | `AGENT_2_LOGH_BACKEND.md` | 은영전 실시간 전투, 연속좌표, WebSocket |
| 에이전트 3 | `AGENT_3_SAMGUKJI_FRONTEND.md` | 그리드 전투 UI, 유닛 스프라이트, 애니메이션 |
| 에이전트 4 | `AGENT_4_LOGH_FRONTEND.md` | Canvas 전술 맵, SF UI, 실시간 렌더링 |
| 에이전트 5 | `AGENT_5_ARCHITECTURE.md` | 통합 인터페이스, Position/Unit/Battle 시스템 |
| 에이전트 6 | `AGENT_6_TESTING.md` | Jest/Playwright 테스트, 성능 테스트 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-11-27 | 초안 작성 |
| 2025-11-27 | 에이전트별 상세 문서 추가 |

