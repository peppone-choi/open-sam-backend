import { BaseSpecialWar } from './BaseSpecialWar';
import { NoneSpecialWar } from './impl/NoneSpecialWar';
import { ChePilsalSpecialWar } from './impl/ChePilsalSpecialWar';
import { CheDolGyeokSpecialWar } from './impl/CheDolGyeokSpecialWar';
import { CheGyeonGoSpecialWar } from './impl/CheGyeonGoSpecialWar';
import { CheGwibyeongSpecialWar } from './impl/CheGwibyeongSpecialWar';
import { CheGongseongSpecialWar } from './impl/CheGongseongSpecialWar';
import { CheGungbyeongSpecialWar } from './impl/CheGungbyeongSpecialWar';
import { CheGibyeongSpecialWar } from './impl/CheGibyeongSpecialWar';
import { CheBobyeongSpecialWar } from './impl/CheBobyeongSpecialWar';
import { CheMusangSpecialWar } from './impl/CheMusangSpecialWar';
import { CheBangyeSpecialWar } from './impl/CheBangyeSpecialWar';
import { CheJipjungSpecialWar } from './impl/CheJipjungSpecialWar';
import { CheJingbyeongSpecialWar } from './impl/CheJingbyeongSpecialWar';
import { CheSinsanSpecialWar } from './impl/CheSinsanSpecialWar';
import { CheSinjungSpecialWar } from './impl/CheSinjungSpecialWar';
import { CheWiapSpecialWar } from './impl/CheWiapSpecialWar';
import { CheUisoolSpecialWar } from './impl/CheUisoolSpecialWar';
import { CheJeogyeokSpecialWar } from './impl/CheJeogyeokSpecialWar';
import { CheChuksaSpecialWar } from './impl/CheChuksaSpecialWar';
import { CheHwansulSpecialWar } from './impl/CheHwansulSpecialWar';
import { CheGyuknoSpecialWar } from './impl/CheGyuknoSpecialWar';

const registry: Record<string, () => BaseSpecialWar> = {
  None: () => new NoneSpecialWar(),
  'che_필살': () => new ChePilsalSpecialWar(),
  'che_돌격': () => new CheDolGyeokSpecialWar(),
  'che_견고': () => new CheGyeonGoSpecialWar(),
  'che_귀병': () => new CheGwibyeongSpecialWar(),
  'che_공성': () => new CheGongseongSpecialWar(),
  'che_궁병': () => new CheGungbyeongSpecialWar(),
  'che_기병': () => new CheGibyeongSpecialWar(),
  'che_보병': () => new CheBobyeongSpecialWar(),
  'che_무쌍': () => new CheMusangSpecialWar(),
  'che_반계': () => new CheBangyeSpecialWar(),
  'che_집중': () => new CheJipjungSpecialWar(),
  'che_징병': () => new CheJingbyeongSpecialWar(),
  'che_신산': () => new CheSinsanSpecialWar(),
  'che_신중': () => new CheSinjungSpecialWar(),
  'che_위압': () => new CheWiapSpecialWar(),
  'che_의술': () => new CheUisoolSpecialWar(),
  'che_저격': () => new CheJeogyeokSpecialWar(),
  'che_척사': () => new CheChuksaSpecialWar(),
  'che_환술': () => new CheHwansulSpecialWar(),
  'che_격노': () => new CheGyuknoSpecialWar(),
};

const cache = new Map<string, BaseSpecialWar>();

export function getSpecialWarAction(key?: string | null): BaseSpecialWar {
  const normalized = key && registry[key] ? key : 'None';
  if (!cache.has(normalized)) {
    cache.set(normalized, registry[normalized]());
  }
  return cache.get(normalized)!;
}
