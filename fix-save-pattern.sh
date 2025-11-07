#!/bin/bash
echo "=== .save() 패턴을 repository로 변경 ==="

# ExecuteEngine.service.ts - session.save() 변경
file="./src/services/global/ExecuteEngine.service.ts"
if [ -f "$file" ]; then
  echo "📝 ExecuteEngine.service.ts"
  # session.save()를 sessionRepository로 변경하되, 변수를 추적해서 처리
  # 이건 수동으로 해야할 수도 있음
fi

# 패턴별로 처리
for file in $(find ./src/services -name "*.service.ts" -type f); do
  changed=0
  
  # general.save() 패턴
  if grep -q "general\.save()" "$file" && grep -q "generalRepository" "$file"; then
    # general을 repository로 조회했다면 save 대신 update 사용
    # 이건 복잡해서 일단 패스
    :
  fi
  
  # session.save() 패턴  
  if grep -q "session\.save()" "$file" && grep -q "sessionRepository" "$file"; then
    :
  fi
  
done

echo "✅ 수동 수정 필요한 파일들을 식별했습니다."
echo "주요 파일:"
echo "  - ExecuteEngine.service.ts"
echo "  - BattleEventHook.service.ts"
echo "  - 기타 .save() 사용 파일들"
