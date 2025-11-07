#!/bin/bash
echo "=== 모든 (Model as any) 패턴 최종 수정 ==="

count=0

for file in $(find ./src/services -name "*.service.ts" -type f); do
  modified=0
  
  # (General as any).* 패턴들
  if sed -i 's/(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*owner:[[:space:]]*\([^}]*\)[[:space:]]*})/generalRepository.findBySessionAndOwner(\1, \2)/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*no:[[:space:]]*\([^}]*\)[[:space:]]*})/generalRepository.findBySessionAndNo(\1, \2)/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,}]*\)[[:space:]]*})/generalRepository.findOneByFilter({ session_id: \1 })/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(General as any)\.find({/generalRepository.findByFilter({/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(General as any)\.countDocuments({/generalRepository.count({/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(General as any)\.updateMany(/generalRepository.updateManyByFilter(/g' "$file"; then
    modified=1
  fi
  
  # (Nation as any).* 패턴들
  if sed -i 's/(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*nation:[[:space:]]*\([^}]*\)[[:space:]]*})/nationRepository.findByNationNum(\1, \2)/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Nation as any)\.find({/nationRepository.findByFilter({/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Nation as any)\.countDocuments({/nationRepository.count({/g' "$file"; then
    modified=1
  fi
  
  # (City as any).* 패턴들
  if sed -i 's/(City as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*city:[[:space:]]*\([^}]*\)[[:space:]]*})/cityRepository.findByCityNum(\1, \2)/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(City as any)\.find({/cityRepository.findByFilter({/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(City as any)\.countDocuments({/cityRepository.count({/g' "$file"; then
    modified=1
  fi
  
  # (Session as any).* 패턴들
  if sed -i 's/(Session as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})/sessionRepository.findBySessionId(\1)/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Session as any)\.find({})/sessionRepository.findAll()/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Session as any)\.find({/sessionRepository.findByFilter({/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Session as any)\.findById(\([^)]*\))/sessionRepository.findById(\1)/g' "$file"; then
    modified=1
  fi
  
  # (Troop as any).* 패턴들
  if sed -i 's/(Troop as any)\.find({/troopRepository.findBySession(/g' "$file"; then
    modified=1
  fi
  
  if sed -i 's/(Troop as any)\.findOne({/troopRepository.findOne({/g' "$file"; then
    modified=1
  fi
  
  if [ $modified -eq 1 ]; then
    count=$((count + 1))
    echo "  ✓ $(basename $file)"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ $count 개 파일 수정 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
