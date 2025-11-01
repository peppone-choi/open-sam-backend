# Scripts

유틸리티 스크립트 모음

## 커맨드 리네임 관련
- `generate-rename-skeleton.ts` - 리네임 매핑 생성
- `rename-commands.ts` - 파일명 일괄 변경
- `rename-command-classes.ts` - 클래스명 변경
- `update-imports.ts` - import 경로 자동 수정
- `command-rename-map.json` - General 커맨드 매핑
- `nation-command-rename-map.json` - Nation 커맨드 매핑

## 사용법

### 커맨드 리네임
```bash
npx ts-node scripts/generate-rename-skeleton.ts
npx ts-node scripts/rename-commands.ts
npx ts-node scripts/update-imports.ts
npx ts-node scripts/rename-command-classes.ts
```
