#!/bin/bash
echo "=== 전체 서비스 Repository 마이그레이션 시작 ==="
echo ""

# 모든 서비스 디렉토리
DIRS=(
  "general"
  "command" 
  "nationcommand"
  "auction"
  "game"
  "world"
  "global"
  "chief"
  "troop"
  "vote"
  "inheritaction"
  "misc"
  "npc"
  "processing"
  "battlemap"
)

TOTAL=0
SUCCESS=0

for dir in "${DIRS[@]}"; do
  SERVICE_DIR="./src/services/$dir"
  
  if [ ! -d "$SERVICE_DIR" ]; then
    echo "⏭️  디렉토리 없음: $dir"
    continue
  fi
  
  echo "📁 처리 중: $dir/"
  
  for file in "$SERVICE_DIR"/*.service.ts; do
    [ ! -f "$file" ] && continue
    
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$file")
    
    # General 관련
    sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
    sed -i "s|import { General } from '../models/general.model';|import { generalRepository } from '../repositories/general.repository';|g" "$file"
    
    # Nation 관련
    sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$file"
    sed -i "s|import { Nation } from '../models/nation.model';|import { nationRepository } from '../repositories/nation.repository';|g" "$file"
    
    # City 관련
    sed -i "s|import { City } from '../../models/city.model';|import { cityRepository } from '../../repositories/city.repository';|g" "$file"
    sed -i "s|import { City } from '../models/city.model';|import { cityRepository } from '../repositories/city.repository';|g" "$file"
    
    # Session 관련
    sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$file"
    sed -i "s|import { Session } from '../models/session.model';|import { sessionRepository } from '../repositories/session.repository';|g" "$file"
    
    # Troop 관련
    sed -i "s|import { Troop } from '../../models/troop.model';|import { troopRepository } from '../../repositories/troop.repository';|g" "$file"
    sed -i "s|import { Troop } from '../models/troop.model';|import { troopRepository } from '../repositories/troop.repository';|g" "$file"
    
    # Message 관련
    sed -i "s|import { Message } from '../../models/message.model';|import { messageRepository } from '../../repositories/message.repository';|g" "$file"
    sed -i "s|import { Message } from '../models/message.model';|import { messageRepository } from '../repositories/message.repository';|g" "$file"
    
    # GeneralRecord 관련
    sed -i "s|import { GeneralRecord } from '../../models/general_record.model';|import { generalRecordRepository } from '../../repositories/general-record.repository';|g" "$file"
    sed -i "s|import { GeneralRecord } from '../models/general_record.model';|import { generalRecordRepository } from '../repositories/general-record.repository';|g" "$file"
    
    # WorldHistory 관련
    sed -i "s|import { WorldHistory } from '../../models/world_history.model';|import { worldHistoryRepository } from '../../repositories/world-history.repository';|g" "$file"
    sed -i "s|import { WorldHistory } from '../models/world_history.model';|import { worldHistoryRepository } from '../repositories/world-history.repository';|g" "$file"
    
    # GeneralTurn 관련
    sed -i "s|import { GeneralTurn } from '../../models/general_turn.model';|import { generalTurnRepository } from '../../repositories/general-turn.repository';|g" "$file"
    sed -i "s|import { GeneralTurn } from '../models/general_turn.model';|import { generalTurnRepository } from '../repositories/general-turn.repository';|g" "$file"
    
    # NationTurn 관련
    sed -i "s|import { NationTurn } from '../../models/nation_turn.model';|import { nationTurnRepository } from '../../repositories/nation-turn.repository';|g" "$file"
    sed -i "s|import { NationTurn } from '../models/nation_turn.model';|import { nationTurnRepository } from '../../repositories/nation-turn.repository';|g" "$file"
    
    # 쿼리 패턴 변경 - General
    sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
    
    # 쿼리 패턴 변경 - Nation
    sed -i "s|(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.nation':[[:space:]]*\([^}]*\)[[:space:]]*})|nationRepository.findByNationNum(\1, \2)|g" "$file"
    
    # 쿼리 패턴 변경 - City
    sed -i "s|(City as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*city:[[:space:]]*\([^}]*\)[[:space:]]*})|cityRepository.findByCityNum(\1, \2)|g" "$file"
    
    # 쿼리 패턴 변경 - Session
    sed -i "s|(Session as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})|sessionRepository.findBySessionId(\1)|g" "$file"
    
    SUCCESS=$((SUCCESS + 1))
    echo "  ✓ $filename"
  done
  
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 마이그레이션 완료!"
echo "📊 처리된 파일: $SUCCESS / $TOTAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
