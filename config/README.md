# Config Directory

## 디렉토리 구조

### scenarios/ - 시나리오 데이터
게임 시나리오별 데이터를 관리합니다.

```
scenarios/
└── sangokushi/          # 삼국지 시나리오
    ├── scenario.json    # 시나리오 메타데이터
    └── data/
        ├── cities.json       # 도시 데이터 (94개)
        ├── constants.json    # 게임 상수 (103개 + 14개 카테고리)
        ├── items.json        # 아이템/특기 (160개)
        ├── units.json        # 병과 (60개)
        ├── nation-types.json # 국가 타입
        ├── personalities.json # 성격
        ├── specials.json     # 특기
        └── map.json          # 맵 정보
```

### session-sangokushi.json
세션 설정 파일 (명령어, 필드 매핑 등)

## 데이터 로딩

InitService는 `scenarios/{scenarioId}/data/`에서 데이터를 로드합니다.

```typescript
// 도시 데이터 로드 예시
const citiesData = InitService.loadScenarioData('sangokushi', 'cities');
```
