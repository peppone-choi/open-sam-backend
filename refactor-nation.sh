#!/bin/bash
SERVICES_DIR="./src/services/nation"
FILES=(SetBlockScout SetBlockWar SetChiefAttr SetNationAttr SetNotice SetRate SetScoutMsg SetSecretLimit SetTroopName ModifyDiplomacy TransferNationOwner WithdrawNation)
for file in "${FILES[@]}"; do
  filepath="$SERVICES_DIR/${file}.service.ts"
  [ ! -f "$filepath" ] && continue
  echo "처리: $file"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$filepath"
  sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$filepath"
  sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$filepath"
  sed -i "s|import { Troop } from '../../models/troop.model';|import { troopRepository } from '../../repositories/troop.repository';|g" "$filepath"
  sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$filepath"
  sed -i "s|(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.nation':[[:space:]]*\([^}]*\)[[:space:]]*})|nationRepository.findByNationNum(\1, \2)|g" "$filepath"
  sed -i "s|(Session as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^}]*\)[[:space:]]*})|sessionRepository.findBySessionId(\1)|g" "$filepath"
  echo "  ✓"
done
echo "완료!"
