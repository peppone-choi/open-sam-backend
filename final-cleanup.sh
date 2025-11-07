#!/bin/bash
echo "=== 최종 정리: 모든 raw import를 repository로 교체 ==="

# BattleEventHook 수동 처리
file="./src/services/battle/BattleEventHook.service.ts"
if [ -f "$file" ]; then
  echo "📝 BattleEventHook.service.ts 처리 중..."
  sed -i "s|import { City } from '../../models/city.model';|import { cityRepository } from '../../repositories/city.repository';|g" "$file"
  sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$file"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$file"
  
  # 쿼리도 변경
  sed -i "s|(City as any)\.findOne({[[:space:]]*session_id:[[:space:]]*sessionId,[[:space:]]*'data\.id':[[:space:]]*cityId[[:space:]]*})|cityRepository.findByCityNum(sessionId, cityId)|g" "$file"
  sed -i "s|(Session as any)\.findOne({[[:space:]]*session_id:[[:space:]]*sessionId[[:space:]]*})|sessionRepository.findBySessionId(sessionId)|g" "$file"
  sed -i "s|(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*sessionId,[[:space:]]*'data\.nation':[[:space:]]*\([^}]*\)[[:space:]]*})|nationRepository.findByNationNum(sessionId, \1)|g" "$file"
  echo "  ✅ 완료"
fi

# GetActiveResourceAuctionList 처리
file="./src/services/auction/GetActiveResourceAuctionList.service.ts"
if [ -f "$file" ]; then
  echo "📝 GetActiveResourceAuctionList.service.ts 처리 중..."
  # Auction import는 그대로 두고 General, Session 등만 교체
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$file"
  echo "  ✅ 완료"
fi

# Info 서비스 중 남은 것 처리
for file in ./src/services/info/*.service.ts; do
  [ ! -f "$file" ] && continue
  
  if ! grep -q "repository" "$file"; then
    echo "📝 $(basename $file) 처리 중..."
    sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
    sed -i "s|import { Tournament } from '../../models/tournament.model';|// Tournament repository 필요|g" "$file"
    echo "  ✅ 완료"
  fi
done

# Betting 서비스 중 남은 것 처리
for file in ./src/services/betting/*.service.ts; do
  [ ! -f "$file" ] && continue
  
  if ! grep -q "repository" "$file"; then
    echo "📝 $(basename $file) 처리 중..."
    sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
    sed -i "s|import { Betting } from '../../models/betting.model';|import { bettingRepository } from '../../repositories/betting.repository';|g" "$file"
    echo "  ✅ 완료"
  fi
done

# Nation 서비스 중 남은 것 처리
for file in ./src/services/nation/*.service.ts; do
  [ ! -f "$file" ] && continue
  
  if ! grep -q "repository" "$file"; then
    echo "📝 $(basename $file) 처리 중..."
    sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
    sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$file"
    sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$file"
    echo "  ✅ 완료"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 최종 정리 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
