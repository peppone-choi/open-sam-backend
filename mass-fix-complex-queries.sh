#!/bin/bash
echo "=== 복잡한 쿼리 패턴 대량 수정 ==="

# 모든 서비스 파일
for file in $(find ./src/services -name "*.service.ts" -type f); do
  changed=0
  
  # General.find (복잡한 패턴)
  if grep -q "(General as any)\.find(" "$file"; then
    perl -i -pe 's/\(General as any\)\.find\(\{/generalRepository.findByFilter({/g' "$file"
    changed=1
  fi
  
  # General.countDocuments
  if grep -q "(General as any)\.countDocuments(" "$file"; then
    perl -i -pe 's/\(General as any\)\.countDocuments\(\{/generalRepository.count({/g' "$file"
    changed=1
  fi
  
  # General.updateMany
  if grep -q "(General as any)\.updateMany(" "$file"; then
    perl -i -pe 's/\(General as any\)\.updateMany\(/generalRepository.updateManyByFilter(/g' "$file"
    changed=1
  fi
  
  # City.find
  if grep -q "(City as any)\.find(" "$file"; then
    perl -i -pe 's/\(City as any\)\.find\(\{/cityRepository.findByFilter({/g' "$file"
    changed=1
  fi
  
  # Nation.find
  if grep -q "(Nation as any)\.find(" "$file"; then
    perl -i -pe 's/\(Nation as any\)\.find\(\{/nationRepository.findByFilter({/g' "$file"
    changed=1
  fi
  
  # Session.find
  if grep -q "(Session as any)\.find(" "$file"; then
    perl -i -pe 's/\(Session as any\)\.find\(\{\}\)/sessionRepository.findAll()/g' "$file"
    perl -i -pe 's/\(Session as any\)\.find\(\{/sessionRepository.findByFilter({/g' "$file"
    changed=1
  fi
  
  if [ $changed -eq 1 ]; then
    echo "  ✓ $(basename $file)"
  fi
done

echo "✅ 완료!"
