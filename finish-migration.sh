#!/bin/bash
for dir in chief troop vote inheritaction misc npc processing battlemap; do
  echo "📁 $dir"
  for f in ./src/services/$dir/*.service.ts; do
    [ ! -f "$f" ] && continue
    sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$f"
    sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$f"
    sed -i "s|import { City } from '../../models/city.model';|import { cityRepository } from '../../repositories/city.repository';|g" "$f"
    sed -i "s|import { Session } from '../../models/session.model';|import { sessionRepository } from '../../repositories/session.repository';|g" "$f"
    sed -i "s|import { Troop } from '../../models/troop.model';|import { troopRepository } from '../../repositories/troop.repository';|g" "$f"
    echo "  ✓ $(basename $f)"
  done
done
echo "완료!"
