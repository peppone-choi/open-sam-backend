#!/bin/bash
echo "=== Repository 체인 메서드 제거 ==="

# 모든 서비스 파일에서 .lean(), .select(), .sort() 제거
for file in $(find ./src/services -name "*.service.ts" -type f); do
  # repository 뒤의 .lean() 제거
  if sed -i 's/Repository\.findByFilter([^)]*))\.lean()/Repository.findByFilter(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/repository\.findByFilter([^)]*))\.lean()/repository.findByFilter(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/Repository\.findAll()\.lean()/Repository.findAll()/g' "$file" 2>/dev/null || \
     sed -i 's/repository\.findAll()\.lean()/repository.findAll()/g' "$file" 2>/dev/null || \
     sed -i 's/Repository\.findById([^)]*))\.lean()/Repository.findById(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/repository\.findById([^)]*))\.lean()/repository.findById(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/Repository\.findBySessionId([^)]*))\.lean()/Repository.findBySessionId(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/repository\.findBySessionId([^)]*))\.lean()/repository.findBySessionId(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/Repository\.findByNationNum([^)]*))\.lean()/Repository.findByNationNum(\1))/g' "$file" 2>/dev/null || \
     sed -i 's/repository\.findByNationNum([^)]*))\.lean()/repository.findByNationNum(\1))/g' "$file" 2>/dev/null; then
    echo "  ✓ $(basename $file)"
  fi
done

echo "✅ 완료!"
