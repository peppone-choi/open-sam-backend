# LOGH Development Roadmap (gin7manual.txt Based)

## 1. Core Engine (기반 시스템)
- [ ] **Galaxy Map System**
  - [ ] `GalaxyGrid` 모델 정의 (좌표, 타입, 점령 상태)
  - [ ] 100광년 그리드 좌표계 및 거리 계산 유틸리티
  - [ ] 맵 생성기 (초기 성계 배치)
- [ ] **Time System**
  - [ ] 24배속 시간 틱 처리 (1시간 = 1일)
  - [ ] 정기 이벤트 스케줄러 (CP 회복: 5분, 일일 결산, 월간 인사)
- [ ] **Command System**
  - [ ] `JobCard` 기반 실행 검증 미들웨어
  - [ ] CP (PCP/MCP) 소모 및 대용 로직
  - [ ] 커맨드 쿨타임(실행 대기/소요 시간) 처리

## 2. Strategic Game (전략)
- [ ] **Personnel (인사)**
  - [ ] 공적치 기반 `RankLadder` 시스템
  - [ ] 매월 1일 자동 승진 로직 (대령 이하)
  - [ ] 인원 제한(Cap) 체크 로직
- [ ] **Logistics (병참)**
  - [ ] 행성/요새 자동 생산 시스템 (유닛, 자원)
  - [ ] `Warehouse` (창고) 모델 (행성용/부대용)
  - [ ] 할당(Assign), 보충(Supply), 재편성(Reorg) 커맨드
- [ ] **Operation (작전)**
  - [ ] 작전 계획 수립 (점령/방어/소탕)
  - [ ] 발령 및 부대 할당
  - [ ] 작전 성공 여부 판정 및 보너스 지급

## 3. Tactical Game (전술 - RTS)
- [ ] **Battle Engine**
  - [ ] RTS 틱 프로세서 (이동, 삭적, 전투)
  - [ ] `EnergyDistribution` (조함 패널) 로직 적용
  - [ ] `CommandRange` (지휘 범위) 시각화 및 제한
- [ ] **Combat Logic**
  - [ ] 사선(Line of Fire) 판정 (장애물, 아군)
  - [ ] 데미지 계산 (쉴드 -> 장갑 -> 내구도)
  - [ ] 지상전 (Ground Battle) 로직 연동

## 4. Frontend
- [ ] **Lobby & Entry**
  - [x] 진영 선택 및 캐릭터 생성 (완료)
  - [x] 로비 / 세션 목록 (완료)
- [ ] **Strategic Map**
  - [ ] 그리드 맵 뷰어 (Canvas/WebGL)
  - [ ] 정보 패널 (행성, 함대 정보)
- [ ] **Tactical Map**
  - [ ] RTS 전투 뷰어
  - [ ] 조함 패널 UI
  - [ ] 유닛 컨트롤 UI






