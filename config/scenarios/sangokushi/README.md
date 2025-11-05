# 삼국지 시나리오 (Sangokushi)

후한 말 삼국시대를 배경으로 한 전략 시뮬레이션 시나리오입니다.

## 파일 구조

```
sangokushi/
├── scenario.json              # 시나리오 메타데이터, Roles, Relations, Data 매핑
├── data/                      # 모든 게임 데이터 (단일 진실 공급원)
│   ├── cities.json            # 94개 도시 (정규화: regionId, levelId, neighbors as id[])
│   ├── map.json               # 맵 메타데이터 (width, height)
│   ├── units.json             # 8개 병종 데이터
│   ├── specials.json          # 49개 특기 (내정 29개, 전투 20개) + mechanics
│   └── constants.json         # 게임 밸런스 상수 (regions, cityLevels, gameBalance 등)
├── game-config.legacy.json    # 원본 레거시 데이터 (참조용, 사용 안 함)
└── README.md                  # 이 파일
```

## 데이터 요약

### 도시 (cities.json)
- **총 도시**: 94개
- **지역**: 8개 (하북, 중원, 서북, 서촉, 초, 오월, 동이, 남중)
- **특급 도시**: 업, 허창, 낙양, 장안, 성도, 양양, 건업
- **초기 속성**: 인구, 농업, 상업, 치안, 방어, 성벽

### 맵 (map.positions.json)
- **맵 크기**: 730x530
- **도시 위치**: x, y 좌표
- **연결 정보**: 인접 도시 목록

### 병종 (units.json)
- **1000 성벽**: 방어 전용 구조물
- **1100 보병**: 기본 병종, 방어 특화
- **1200 궁병**: 회피 특화
- **1300 기병**: 공격 특화
- **1400 귀병**: 계략 특화
- **1405 남귀병**: 계략 극대화
- **1500 정란**: 공성 병기
- **1501 충차**: 고급 공성 병기

### 특기 (specials.json)

#### 내정 특기 (29개)
- 개간, 경작, 귀모, 상재, 수비, 인덕, 축성, 통찰 등
- 각 특기는 mechanics로 효과 정의됨

#### 전투 특기 (20개)
- 격노, 견고, 공성, 궁병, 귀병, 기병, 돌격, 무쌍
- 반계, 보병, 신산, 신중, 위압, 의술, 저격, 집중
- 징병, 척사, 필살, 환술

### 게임 설정 (game-config.json + constants.json)
- **시작 연도**: 180년 (후한 말)
- **턴 제도**: 매일 21:00 기본
- **최대 턴**: 30턴/사이클
- **최대 군주 턴**: 12턴
- **자원**: 금, 쌀
- **기본 장수 능력치 범위**: 1~100
- **기본 도시 속성**: 인구, 농업, 상업, 치안, 방어, 성벽, 민심
- **최대 레벨**: 255
- **최대 기술 레벨**: 12

### 도시 레벨 시스템 (constants.json)
- **수(1)**: 인구 5,000 / 방어·성벽 500
- **진(2)**: 인구 5,000 / 방어·성벽 500
- **관(3)**: 인구 10,000 / 방어·성벽 1,000
- **이(4)**: 인구 50,000 / 방어·성벽 1,000
- **소(5)**: 인구 100,000 / 방어·성벽 2,000
- **중(6)**: 인구 100,000 / 방어·성벽 3,000
- **대(7)**: 인구 150,000 / 방어·성벽 4,000
- **특(8)**: 인구 150,000 / 방어·성벽 5,000

## Role 정의

### SETTLEMENT (도시)
- **컬렉션**: cities
- **속성**: population, defense, trust, development, commerce, agriculture
- **슬롯**: production_1~3, defense, security

### COMMANDER (장수)
- **컬렉션**: generals
- **속성**: leadership, strength, intel, charm, age, injury, loyalty, exp

### FACTION (국가)
- **컬렉션**: nations
- **속성**: tech, prestige, legitimacy

### FORCE (부대)
- **컬렉션**: forces

### DIPLOMACY (외교)
- **컬렉션**: diplomacy

## 관계 정의

- **ASSIGNED_SETTLEMENT**: 장수 → 도시 (via: city)
- **MEMBER_OF**: 장수 → 국가 (via: nation)
- **OWNS**: 국가 → 도시 (via: nation, inverse: cities)

## 데이터 출처

모든 데이터는 `sam/hwe/` PHP 프로젝트에서 추출되었습니다:
- 도시 데이터: sam/hwe/scenario/map/che.php 기반
- 병종 데이터: sam/hwe/scenario/unit/basic.php
- 특기 데이터: sam PHP 게임 로직
- 게임 상수: sam/hwe/d_setting/*.php

## 버전

- **Version**: 1.0.0
- **Author**: open-sam-backend
- **Generated**: 2025-10-31
