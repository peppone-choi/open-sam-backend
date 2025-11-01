# Config Directory

## 디렉토리 구조

### scenarios/ - 시나리오 데이터 (사용 중)
게임 시나리오별 데이터를 관리합니다.

```
scenarios/
└── sangokushi/          # 삼국지 시나리오
    ├── scenario.json    # 시나리오 메타데이터
    └── data/
        ├── cities.json       # 도시 데이터 (94개)
        ├── constants.json    # 게임 상수
        ├── items.json        # 아이템/특기
        ├── units.json        # 병과
        ├── nation-types.json # 국가 타입
        ├── personalities.json # 성격
        ├── specials.json     # 특기
        └── map.json          # 맵 정보
```

### 루트 파일들 (레거시)

**사용 중**:
- `session-sangokushi.json` - 세션 설정 (명령어, 필드 매핑 등)

**레거시/중복**:
- `actions.json`, `actions-final.json` - items.json과 중복
- `units.json` - scenarios/sangokushi/data/units.json과 중복
- `constants.json` - scenarios/sangokushi/data/constants.json과 중복
- `commands-generated.json` - 생성된 명령어 목록
- `sam-complete.json` - 원본 PHP 데이터 추출본
- `schema.json` - 데이터베이스 스키마 정의

## 데이터 로딩 우선순위

1. **시나리오 데이터** (최우선) - `scenarios/{scenarioId}/data/`
2. **세션 설정** - `session-{templateId}.json`
3. **레거시 데이터** - 루트 JSON 파일들 (하위 호환용)
