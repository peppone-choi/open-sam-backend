# NPC AI 가이드

## 개요
NPC(Non-Player Character) AI 시스템은 유저가 빙의하지 않은 장수들이 자동으로 행동하도록 합니다.

## AI 모드

### 1. `disabled` (기본값)
- **설명**: AI 완전 비활성화
- **동작**: NPC는 명령이 없으면 휴식만 함
- **용도**: 초기 개발/테스트, AI 없이 진행하고 싶을 때

### 2. `shadow` (테스트 모드)
- **설명**: AI 결정을 로깅만 하고 실제 적용 안함
- **동작**: AI가 어떤 결정을 내릴지 로그로 확인 가능
- **용도**: AI 품질 테스트, 디버깅
- **로그 예시**:
  ```
  [NPC-AI] Decision { generalName: "조조", command: "농업개발", reason: "식량 부족" }
  [NPC-AI] Shadow mode - skipping actual command application
  ```

### 3. `partial` (점진적 롤아웃)
- **설명**: npc >= 3 (명장급)만 AI 적용
- **동작**: 일반 NPC는 휴식, 명장급만 AI로 행동
- **용도**: AI 성능 확인 후 단계적으로 적용

### 4. `full` (권장) ✅
- **설명**: 모든 NPC에 AI 적용
- **동작**: 유저가 빙의하지 않은 모든 NPC가 AI로 행동
- **용도**: 정상 운영

## AI 난이도

### `EASY` (쉬움)
- 단순한 전략만 사용
- 실수를 자주 함
- 초보 유저도 쉽게 이길 수 있음

### `NORMAL` (보통, 권장)
- 균형잡힌 전략 사용
- 적절한 도전 제공

### `HARD` (어려움)
- 최적화된 전략 사용
- 고급 유저도 어려움을 느낄 수 있음

## 사용법

### AI 설정 변경
```bash
# 모든 NPC AI 활성화 (보통 난이도)
node scripts/manage-npc-ai.mjs full NORMAL

# 명장급만 AI 활성화 (어려운 난이도)
node scripts/manage-npc-ai.mjs partial HARD

# 테스트 모드 (로깅만)
node scripts/manage-npc-ai.mjs shadow

# AI 비활성화
node scripts/manage-npc-ai.mjs disabled
```

### 설정 확인
MongoDB에서 직접 확인:
```javascript
db.sessions.findOne({ session_id: "sangokushi_default" }, { "data.game_env.npc_ai_mode": 1, "data.game_env.ai_difficulty": 1 })
```

### 변경 후 재시작
```bash
# 데몬 재시작 (설정 적용)
pkill -f "node.*daemon-unified"
npm run dev:turn
```

## 문제 해결

### NPC가 여전히 휴식만 하는 경우
1. AI 모드가 `full` 또는 `partial`인지 확인
2. 데몬이 재시작되었는지 확인
3. 로그에서 `[NPC-AI] Decision` 메시지가 있는지 확인

### AI가 이상한 결정을 하는 경우
1. `shadow` 모드로 변경하여 로그 확인
2. 난이도를 `EASY`로 낮춰서 테스트
3. AI 엔진 코드 수정 (`src/core/ai-engine/`)

## 운영 권장 설정

```bash
# 정상 운영
node scripts/manage-npc-ai.mjs full NORMAL

# 베타 테스트 (shadow로 먼저 확인)
node scripts/manage-npc-ai.mjs shadow NORMAL
# 로그 확인 후 문제 없으면
node scripts/manage-npc-ai.mjs full NORMAL
```

## 주의사항

⚠️ **AI 모드 변경 시 주의사항**
- 변경 후 반드시 데몬 재시작 필요
- 게임 중 변경하면 다음 턴부터 적용됨
- `shadow` 모드는 성능 오버헤드가 있으므로 프로덕션에서는 사용 권장 안함

## 관련 파일

- **AI 엔진**: `src/core/ai-engine/`
- **AI 결정 로직**: `src/core/SimpleAI.ts`
- **턴 처리**: `src/services/global/ExecuteEngine.service.ts` (1309-1429번 줄)
- **관리 스크립트**: `scripts/manage-npc-ai.mjs`
