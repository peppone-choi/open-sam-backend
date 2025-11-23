import { GalaxyFactionCode } from '../../models/logh/GalaxySession.model';

export type Gin7CommandGroup =
  | 'operation'
  | 'personal'
  | 'command'
  | 'logistics'
  | 'personnel'
  | 'political'
  | 'intelligence'
  | 'tactical';

export type CommandPointType = 'PCP' | 'MCP';

export interface Gin7CommandShortcut {
  key: string;
  label: string;
  description: string;
  context?: string;
  commandCode?: string;
}

export interface Gin7CommandMeta {
  code: string;
  label: string;
  group: Gin7CommandGroup;
  cpType?: CommandPointType;
  cpCost?: number | string;
  description?: string;
  executionDelay?: number | string;
  executionDuration?: number | string;
  manualRef?: string;
  shortcuts?: Gin7CommandShortcut[];
  notes?: string;
}

export type AuthorityCardCategory =
  | 'personal'
  | 'fleet'
  | 'logistics'
  | 'politics'
  | 'intel'
  | 'command'
  | 'personnel'
  | 'tactical';

export interface Gin7AuthorityCardTemplate {
  templateId: string;
  title: string;
  description: string;
  category: AuthorityCardCategory;
  factionScope: Array<GalaxyFactionCode | 'shared'>;
  commandGroups: Gin7CommandGroup[];
  commandCodes: string[];
  manualRef: string;
  organizationId?: string;
  positionId?: string;
  authorityTags?: string[];
  minRank?: string;
  maxRank?: string;
  maxHolders?: number;
  defaultMailAlias?: string;
  metadata?: Record<string, any>;
}

export interface Gin7CommandCatalog {
  version: string;
  source: string;
  generatedAt: string;
  commands: Record<string, Gin7CommandMeta>;
  authorityCards: Gin7AuthorityCardTemplate[];
  shortcuts: Gin7CommandShortcut[];
}
