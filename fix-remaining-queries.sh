#!/bin/bash
echo "=== 남은 raw query 수정 ==="

# 모든 서비스 파일에서 raw query 패턴을 repository 호출로 변경
for file in $(find ./src/services -name "*.service.ts" -type f); do
  # 파일에 raw query가 있는지 확인
  if grep -q "(General as any)\|(Nation as any)\|(City as any)\|(Session as any)" "$file"; then
    echo "🔧 $(basename $file)"
    
    # General.findOne 패턴들
    sed -i 's|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*owner:[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndOwner(\1, \2)|g' "$file"
    sed -i 's|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*no:[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g' "$file"
    sed -i 's|(General as any)\.find({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySession(\1)|g' "$file"
    
    # City 패턴들
    sed -i 's|(City as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'"'"'data\.id'"'"':[[:space:]]*\([^}]*\)[[:space:]]*})|cityRepository.findByCityNum(\1, \2)|g' "$file"
    sed -i 's|(City as any)\.countDocuments({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})|cityRepository.count({ session_id: \1 })|g' "$file"
    
    # Nation 패턴들  
    sed -i 's|(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*nation:[[:space:]]*\([^}]*\)[[:space:]]*})|nationRepository.findByNationNum(\1, \2)|g' "$file"
    
    # Session 패턴들
    sed -i 's|(Session as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})|sessionRepository.findBySessionId(\1)|g' "$file"
    sed -i 's|(Session as any)\.find({})|sessionRepository.findAll()|g' "$file"
    sed -i 's|(Session as any)\.findById(\([^)]*\))|sessionRepository.findById(\1)|g' "$file"
  fi
done

echo "✅ 완료!"
