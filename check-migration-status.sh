#!/bin/bash
echo "=== 디렉토리별 마이그레이션 상태 ==="
echo ""

for dir in $(find /mnt/d/opensam/open-sam-backend/src/services -mindepth 1 -maxdepth 1 -type d | sort); do
  dirname=$(basename $dir)
  total=$(find $dir -name "*.service.ts" 2>/dev/null | wc -l)
  
  if [ $total -eq 0 ]; then
    continue
  fi
  
  migrated=$(grep -l "Repository\|repository\." $dir/*.service.ts 2>/dev/null | wc -l)
  
  if [ $migrated -eq $total ]; then
    echo "✅ $dirname: $migrated/$total (100%)"
  elif [ $migrated -gt 0 ]; then
    pct=$((migrated * 100 / total))
    echo "🟡 $dirname: $migrated/$total ($pct%)"
  else
    echo "❌ $dirname: $migrated/$total (0%)"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
