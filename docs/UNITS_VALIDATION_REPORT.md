# 병종 데이터 검증 리포트

## 검증 날짜
2024-12-XX

## 요약

### 데이터 현황
- **새 JSON (units.json)**: 60개 병종
- **레거시 (session-sangokushi.json)**: 25개 병종
- **공통 ID**: 25개
- **이름/타입 불일치**: 21개
- **구조 문제**: 8개 (레거시 형식 병종 4개 + 타입 문제 4개)

## 주요 발견사항

### 1. 레거시 형식 병종이 혼재되어 있음

다음 병종들이 레거시 형식으로 남아있습니다:
- **1100** (보병) - `type: "footman"`, `cost: 100` (숫자), `stats` 없음
- **1200** (궁병) - `type: "footman"`, `cost: 100` (숫자), `stats` 없음
- **1300** (기병) - `type: "footman"`, `cost: 150` (숫자), `stats` 없음
- **1500** (정란) - `type: "misc"`, `cost: 100` (숫자), `stats` 없음

이들은 새 형식으로 변환해야 합니다:
```json
{
  "id": 1100,
  "type": "FOOTMAN",
  "name": "보병",
  "cost": {
    "gold": 100,
    "rice": 150
  },
  "stats": {
    "tech": 9,
    "offense": 15,
    "magic": 0,
    "attackRange": 9,
    "defenseRange": 9
  },
  "attacks": {},
  "defenses": {},
  "description": [],
  "constraints": []
}
```

### 2. 레거시와 새 데이터가 다른 병종 체계

레거시 데이터와 새 데이터가 완전히 다른 병종 명칭을 사용합니다:

| ID | 새 JSON | 레거시 | 새 타입 | 레거시 타입 |
|----|---------|--------|---------|-------------|
| 1101 | 향병 | 청주병 | FOOTMAN | footman |
| 1102 | 정병 | 수병 | FOOTMAN | footman |
| 1103 | 검병 | 자객병 | FOOTMAN | footman |
| 1104 | 부월수 | 근위병 | FOOTMAN | footman |
| 1201 | 향용 | 궁기병 | SPEARMAN | footman |
| 1202 | 창병 | 연노병 | SPEARMAN | footman |
| 1301 | 향궁수 | 백마병 | ARCHER | footman |
| 1302 | 정궁수 | 중장기병 | ARCHER | footman |

이는 **의도적인 변경**일 수 있습니다 (새로운 게임 밸런스).

### 3. GetConstService 호환성 문제

`GetConstService`가 다음 문제가 있습니다:
- 경로: `config/units.json` 참조 (실제는 `config/scenarios/sangokushi/data/units.json`)
- 구조: `unitsData.unit_types` 참조 (실제는 `unitsData.units`)

## 해결 방안

### 즉시 수정 필요
1. **레거시 형식 병종 변환** (1100, 1200, 1300, 1500)
2. **GetConstService 업데이트** - 새 경로와 구조에 맞게 수정

### 검토 필요
1. **레거시 데이터와의 매핑** - 레거시 세션과의 호환성 유지 방법
2. **기본 병종 템플릿** - 1100, 1200, 1300이 기본 병종이라면 적절히 처리

## 새 JSON 구조

새 units.json은 다음 구조를 사용합니다:
```json
{
  "units": {
    "ID": {
      "id": number,
      "type": "FOOTMAN" | "ARCHER" | "CAVALRY" | "WIZARD" | "SIEGE" | "CASTLE" | "SPEARMAN" | "MIXED",
      "name": string,
      "cost": {
        "gold": number,
        "rice": number
      },
      "stats": {
        "tech": number,
        "offense": number,
        "magic": number,
        "attackRange": number,
        "defenseRange": number
      },
      "attacks": { [unitType]: number },
      "defenses": { [unitType]: number },
      "description": string[],
      "constraints": Array<{ type: string, value?: any }>
    }
  }
}
```

## 병종 타입별 분포

- **FOOTMAN**: 17개
- **SPEARMAN**: 11개
- **ARCHER**: 10개
- **CAVALRY**: 8개
- **MIXED**: 4개
- **WIZARD**: 3개
- **SIEGE**: 2개
- **CASTLE**: 1개

## 다음 단계

1. 레거시 형식 병종 변환 스크립트 작성
2. GetConstService 수정
3. 데이터 마이그레이션 계획 수립

