#!/bin/bash
echo "=== 모든 Repository 수정: 캐시 비활성화 및 Document 반환 ==="

# 주요 Repository 파일들
REPOS=(
  "session.repository.ts"
  "general.repository.ts"
  "city.repository.ts"
  "nation.repository.ts"
)

for repo in "${REPOS[@]}"; do
  file="./src/repositories/$repo"
  echo "📝 수정 중: $repo"
  
  # 백업
  cp "$file" "$file.backup"
  
  # 캐시 조회 부분 주석 처리하고 직접 DB 조회로 변경
  # findBySessionId, findBySessionAndNo, findByCityNum, findByNationNum 등
  
  echo "  ✓ 백업 완료: $file.backup"
done

echo ""
echo "✅ 백업 완료. 이제 수동으로 수정하겠습니다."
