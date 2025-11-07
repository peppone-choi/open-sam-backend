#!/bin/bash

# 서비스 파일들을 Repository 패턴으로 자동 리팩토링하는 스크립트

SERVICE_DIR="/mnt/d/opensam/open-sam-backend/src/services"
LOG_FILE="/tmp/refactor-repository.log"

echo "Starting repository refactoring..." > "$LOG_FILE"

# 1. General 모델을 generalRepository로 변경
find "$SERVICE_DIR" -name "*.service.ts" -type f | while read file; do
    # General 모델 import가 있는지 확인
    if grep -q "import.*General.*from.*models/general.model" "$file"; then
        echo "Processing: $file" >> "$LOG_FILE"
        
        # import 변경
        sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
        sed -i "s|import { General } from '../models/general.model';|import { generalRepository } from '../repositories/general.repository';|g" "$file"
        
        # General as any 쿼리를 repository 호출로 변경
        # findOne with session_id and data.no
        sed -i "s|(General as any)\.findOne({[ ]*session_id: \([^,]*\),[ ]*'data\.no': \([^}]*\)})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
        
        # save() 호출을 repository.save()로
        sed -i "s|await general\.save()|await generalRepository.save(general)|g" "$file"
        
        echo "  - Refactored: $file" >> "$LOG_FILE"
    fi
done

# 2. Session 모델을 sessionRepository로 변경
find "$SERVICE_DIR" -name "*.service.ts" -type f | while read file; do
    if grep -q "import.*Session.*from.*models/session.model" "$file"; then
        echo "Processing: $file" >> "$LOG_FILE"
        
        sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$file"
        sed -i "s|import { Session } from '../models/session.model';|import { sessionRepository } from '../repositories/session.repository';|g" "$file"
        
        # Session 쿼리 변경
        sed -i "s|(Session as any)\.findOne({ session_id: \([^}]*\) })|sessionRepository.findBySessionId(\1)|g" "$file"
        
        echo "  - Refactored: $file" >> "$LOG_FILE"
    fi
done

# 3. City 모델을 cityRepository로 변경
find "$SERVICE_DIR" -name "*.service.ts" -type f | while read file; do
    if grep -q "import.*City.*from.*models/city.model" "$file"; then
        echo "Processing: $file" >> "$LOG_FILE"
        
        sed -i "s|import { City } from '../../models/city.model';|import { cityRepository } from '../../repositories/city.repository';|g" "$file"
        sed -i "s|import { City } from '../models/city.model';|import { cityRepository } from '../repositories/city.repository';|g" "$file"
        
        # City 쿼리 변경
        sed -i "s|(City as any)\.findOne({[ ]*session_id: \([^,]*\),[ ]*city: \([^}]*\)})|cityRepository.findByCityNum(\1, \2)|g" "$file"
        
        echo "  - Refactored: $file" >> "$LOG_FILE"
    fi
done

# 4. Nation 모델을 nationRepository로 변경  
find "$SERVICE_DIR" -name "*.service.ts" -type f | while read file; do
    if grep -q "import.*Nation.*from.*models/nation.model" "$file"; then
        echo "Processing: $file" >> "$LOG_FILE"
        
        sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$file"
        sed -i "s|import { Nation } from '../models/nation.model';|import { nationRepository } from '../repositories/nation.repository';|g" "$file"
        
        # Nation 쿼리 변경
        sed -i "s|(Nation as any)\.findOne({[ ]*session_id: \([^,]*\),[ ]*nation: \([^}]*\)})|nationRepository.findByNationNum(\1, \2)|g" "$file"
        
        echo "  - Refactored: $file" >> "$LOG_FILE"
    fi
done

echo "Refactoring complete. Check $LOG_FILE for details."
cat "$LOG_FILE"
