# Agent 12: API Documentation & Frontend Prep

## 📌 Context
프론트엔드 팀(또는 Agent)이 원활하게 작업할 수 있도록 백엔드 API 명세서를 최신화하고, 필요한 타입 정의를 공유합니다.

## ✅ Checklist
- [x] Swagger/OpenAPI 문서 생성 또는 업데이트 (`swagger-jsdoc` 등 활용)
- [x] 주요 API의 Request/Response 타입 정의 (`src/types` 또는 `src/dtos`) - 기존 코드 활용
- [ ] 프론트엔드에서 사용할 수 있는 `api-client` 코드 생성 (선택 사항)
- [x] 전투 리플레이 데이터 예시 JSON 파일 생성 (프론트엔드 더미 데이터용)

## 💬 Communication
- **Status**: [Done]
- **Current Issue**: 
- **Memo**: 1~11번 에이전트가 만든 API 변경 사항을 모두 반영해야 합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 테크니컬 라이터이자 백엔드 개발자입니다.
지금까지 개발된(또는 개발 중인) API들의 문서를 최신화해야 합니다.

1. `src/routes`를 스캔하여 현재 존재하는 모든 API 엔드포인트를 리스트업하세요.
2. 각 API의 파라미터와 응답 형식을 정의하세요.
3. 이를 바탕으로 Swagger(OpenAPI 3.0) 설정 파일이나 주석을 달아주세요.
```

### 이어지는 프롬프트
```markdown
프론트엔드 개발자가 전투 화면을 개발할 수 있도록, **전투 리플레이 데이터의 샘플 JSON**을 하나 만들어주세요.
`ProcessWar` 로직을 참고하여 실제 데이터와 유사한 더미 데이터를 생성해서 `docs/sample-replay.json`에 저장해주세요.
```

