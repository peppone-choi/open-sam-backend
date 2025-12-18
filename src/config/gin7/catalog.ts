import { AuthorityCardCategory, CommandPointType, Gin7AuthorityCardTemplate, Gin7CommandCatalog, Gin7CommandGroup, Gin7CommandMeta, Gin7CommandShortcut } from './types';
import { GalaxyFactionCode } from '../../models/logh/GalaxySession.model';

// Optional imports - gin7 시나리오가 없으면 빈 객체 사용
let completeCommandTable: any = { commandCategories: {}, source: '' };
let tacticalCommandTable: any = { tacticalCommands: [] };
let empireOrganizations: any = { organizations: {} };
let allianceOrganizations: any = { organizations: {} };

try {
  completeCommandTable = require('../../../config/scenarios/legend-of-galactic-heroes/data/complete-commands-table.json');
} catch { /* gin7 시나리오 없음 */ }

try {
  tacticalCommandTable = require('../../../config/scenarios/legend-of-galactic-heroes/data/tactical-commands.json');
} catch { /* gin7 시나리오 없음 */ }

try {
  empireOrganizations = require('../../../config/scenarios/legend-of-galactic-heroes/data/organizations-empire.json');
} catch { /* gin7 시나리오 없음 */ }

try {
  allianceOrganizations = require('../../../config/scenarios/legend-of-galactic-heroes/data/organizations-alliance.json');
} catch { /* gin7 시나리오 없음 */ }

const GENERATED_AT = new Date().toISOString();
const MANUAL_REF = `${completeCommandTable.source} · Chapter3-4`;
const TACTICAL_ROOT: any = (tacticalCommandTable as any).tacticalCommands || tacticalCommandTable;

type CommandCategoryKey = keyof typeof completeCommandTable.commandCategories;

type OrganizationPayload = {
  source?: string;
  organizations: Record<
    string,
    {
      id: string;
      name: string;
      nameJa?: string;
      positions?: Array<{
        id: string;
        name: string;
        nameJa?: string;
        description?: string;
        authority?: string[];
        minRank?: string;
        maxRank?: string;
        count?: number;
      }>;
    }
  >;
};

interface CardBlueprint {
  templateId: string;
  title: string;
  description: string;
  category: AuthorityCardCategory;
  factionScope: Array<GalaxyFactionCode | 'shared'>;
  commandGroups: Gin7CommandGroup[];
  manualRef: string;
  maxHolders?: number;
  defaultMailAlias?: string;
  metadata?: Record<string, any>;
  organizationId?: string;
  positionId?: string;
}

const BASE_CARD_BLUEPRINTS: CardBlueprint[] = [
  {
    templateId: 'card.personal.basic',
    title: '개인 카드',
    description: '모든 캐릭터가 공통 보유하는 개인 행동 카드',
    category: 'personal',
    factionScope: ['shared'],
    commandGroups: ['personal'],
    manualRef: 'gin7manual Chapter3 pp26-33',
    maxHolders: 4000,
    defaultMailAlias: 'personal.card@gin7',
  },
  {
    templateId: 'card.captain.basic',
    title: '함장 카드',
    description: '기함 조종 및 보급을 담당하는 기본 함장 카드',
    category: 'fleet',
    factionScope: ['shared'],
    commandGroups: ['operation'],
    manualRef: 'gin7manual Chapter3 pp26-33',
    maxHolders: 4000,
    defaultMailAlias: 'captain.card@gin7',
  },
  {
    templateId: 'card.logistics.officer',
    title: '병참 참모 카드',
    description: '병참·재편성을 담당하는 참모 카드',
    category: 'logistics',
    factionScope: ['empire', 'alliance'],
    commandGroups: ['logistics'],
    manualRef: 'gin7manual Chapter3 §병참',
    maxHolders: 200,
    defaultMailAlias: 'logistics@ops.gin7',
  },
];

const AUTHORITY_TAG_MAP: Record<string, Gin7CommandGroup[]> = {
  '내각 조직': ['political'],
  '지사 임명/파면': ['political', 'personnel'],
  '행성 총독 임명/파면': ['political', 'personnel'],
  '과세율 변경': ['political'],
  '납입률 변경': ['political'],
  '관세율 변경': ['political'],
  '국가 목표': ['political'],
  '정치가 체포/처단': ['intelligence'],
  '대좌 이하 군인 체포/처단': ['intelligence'],
  '전 군인 체포/구속': ['intelligence'],
  '원수 외 군인 체포/구속': ['intelligence'],
  '통합정찰국 관리': ['intelligence'],
  '전략작전국 관리': ['intelligence', 'command'],
  '국방 총괄': ['command', 'personnel'],
  '전군 인사권': ['personnel'],
  '통합작전본부장 임명': ['personnel'],
  '원수~준장 승진/강등/임명/파면': ['personnel'],
  '함대사령관 임명': ['personnel', 'command'],
  '우주함대사령장관 임명': ['personnel', 'command'],
  '대좌 이하 승진/강등': ['personnel'],
  '지상부대 지휘': ['command'],
  '함대 작전계획 입안': ['command'],
  '함대 작전계획': ['command'],
  '함대 발령': ['command'],
  '수송함대/순찰대/지상부대 작전계획': ['logistics', 'command'],
  '수송함대/순찰대 작전계획': ['logistics'],
  '지상부대 작전계획': ['command', 'logistics'],
  '독행함 작전계획': ['command', 'operation'],
  '독행함 운용': ['operation'],
  '우주함대 참모 임명': ['personnel'],
  '작전과 과장 임명': ['personnel', 'command'],
  '사관학교장 임명': ['personnel'],
  '함대/수송함대/순찰대 부대결성': ['command'],
  '각 함대 참모장 임명/파면': ['personnel'],
  '행성 수비대 지휘관 임명': ['personnel', 'command'],
  '중좌 이하 서훈': ['personnel'],
  '할당': ['logistics'],
  '지상군 지휘': ['command'],
  '요새 방어 지휘': ['command'],
};

const commandMap = buildCommandMap();
const authorityCards = buildAuthorityCards();
const shortcuts = buildShortcutIndex();

export const gin7CommandCatalog: Gin7CommandCatalog = {
  version: 'gin7.manual.v1',
  source: MANUAL_REF,
  generatedAt: GENERATED_AT,
  commands: Object.fromEntries(commandMap.entries()),
  authorityCards,
  shortcuts,
};

export function getCommandMeta(code: string): Gin7CommandMeta | undefined {
  return commandMap.get(code);
}

export function getAuthorityCardTemplates(faction?: GalaxyFactionCode): Gin7AuthorityCardTemplate[] {
  if (!faction) {
    return authorityCards;
  }
  return authorityCards.filter((template) => template.factionScope.includes('shared') || template.factionScope.includes(faction));
}

export function getShortcutCatalog(): Gin7CommandShortcut[] {
  return shortcuts;
}

function buildCommandMap(): Map<string, Gin7CommandMeta> {
  const map = new Map<string, Gin7CommandMeta>();

  (Object.keys(completeCommandTable.commandCategories) as CommandCategoryKey[]).forEach((groupKey) => {
    const groupPayload = completeCommandTable.commandCategories[groupKey];
    groupPayload.commands.forEach((command) => {
      map.set(command.id, {
        code: command.id,
        label: command.name,
        group: groupKey as Gin7CommandGroup,
        cpType: command.cpType as CommandPointType | undefined,
        cpCost: command.cpCost,
        description: command.description,
        executionDelay: command.executionDelay,
        executionDuration: command.executionDuration,
        manualRef: MANUAL_REF,
      });
    });
  });

  const tacticalSections = [
    ...(TACTICAL_ROOT?.vesselCommands || []),
    ...(TACTICAL_ROOT?.fortressCommands || []),
  ];
  tacticalSections.forEach((rawEntry: any) => {
    const entry = rawEntry || {};
    const shortcuts: Gin7CommandShortcut[] = [];
    if (entry.shortcut) {
      shortcuts.push({ key: entry.shortcut, label: entry.name, description: entry.description || '', commandCode: entry.id });
    }
    if (Array.isArray(entry.submodes)) {
      entry.submodes.forEach((sub: any) => {
        if (sub?.shortcut) {
          shortcuts.push({
            key: sub.shortcut,
            label: `${entry.name} · ${sub.name}`,
            description: sub.description || entry.description || '',
            context: `${entry.id}.${sub.id}`,
            commandCode: entry.id,
          });
        }
      });
    }
    if (Array.isArray(entry.formations)) {
      entry.formations.forEach((formation: any) => {
        if (formation?.shortcut) {
          shortcuts.push({
            key: formation.shortcut,
            label: `${entry.name} · ${formation.name}`,
            description: entry.description || '',
            context: `${entry.id}.${formation.id}`,
            commandCode: entry.id,
          });
        }
      });
    }
    if (Array.isArray(entry.weapons)) {
      entry.weapons.forEach((weapon: any) => {
        if (weapon?.shortcut) {
          shortcuts.push({
            key: weapon.shortcut,
            label: `${entry.name} · ${weapon.name}`,
            description: weapon.description || entry.description || '',
            context: `${entry.id}.${weapon.id}`,
            commandCode: entry.id,
          });
        }
      });
    }

    map.set(entry.id, {
      code: entry.id,
      label: entry.name,
      group: 'tactical',
      description: entry.description,
      executionDelay: entry.executionDelay,
      executionDuration: entry.executionDuration,
      manualRef: TACTICAL_ROOT?.description || 'gin7manual Chapter4 戦術ゲーム',
      shortcuts,
      notes: entry.note || entry.warning,
    });
  });

  return map;
}

function buildAuthorityCards(): Gin7AuthorityCardTemplate[] {
  const templates: Gin7AuthorityCardTemplate[] = [];

  BASE_CARD_BLUEPRINTS.forEach((blueprint) => {
    templates.push(realizeBlueprint(blueprint));
  });

  const empireCards = buildOrganizationalCards(empireOrganizations as OrganizationPayload, 'empire');
  const allianceCards = buildOrganizationalCards(allianceOrganizations as OrganizationPayload, 'alliance');

  templates.push(...empireCards, ...allianceCards);
  return templates;
}

function buildOrganizationalCards(payload: OrganizationPayload, faction: GalaxyFactionCode): Gin7AuthorityCardTemplate[] {
  const cards: Gin7AuthorityCardTemplate[] = [];
  Object.values(payload.organizations || {}).forEach((organization) => {
    (organization.positions || []).forEach((position) => {
      const tags = dedupe(position.authority || []);
      if (!tags.length) {
        return;
      }
      const commandGroups = dedupe(tags.flatMap((tag) => AUTHORITY_TAG_MAP[tag] || []));
      if (!commandGroups.length) {
        throw new Error(`GIN7 authority tag not mapped: ${tags.join(', ')} (${faction}/${organization.id}/${position.id})`);
      }
      const templateId = `card.${faction}.${organization.id}.${position.id}`;
      cards.push(
        realizeBlueprint({
          templateId,
          title: position.name,
          description: position.description || `${organization.name} 직무권한`,
          category: inferCardCategory(commandGroups),
          factionScope: [faction],
          commandGroups,
          manualRef: payload.source || MANUAL_REF,
          defaultMailAlias: `${position.id}@${organization.id}.${faction}.gin7`,
          maxHolders: position.count || 1,
          organizationId: organization.id,
          positionId: position.id,
          metadata: {
            organizationId: organization.id,
            organizationName: organization.name,
            positionId: position.id,
            positionNameJa: position.nameJa,
            minRank: position.minRank,
            maxRank: position.maxRank,
            authorityTags: tags,
          },
        }, position)
      );
    });
  });
  return cards;
}

function realizeBlueprint(blueprint: CardBlueprint, position?: { minRank?: string; maxRank?: string; authority?: string[] }): Gin7AuthorityCardTemplate {
  const commandCodes = collectCommandCodes(blueprint.commandGroups);
  return {
    templateId: blueprint.templateId,
    title: blueprint.title,
    description: blueprint.description,
    category: blueprint.category,
    factionScope: blueprint.factionScope,
    commandGroups: blueprint.commandGroups,
    commandCodes,
    manualRef: blueprint.manualRef,
    maxHolders: blueprint.maxHolders || 1,
    defaultMailAlias: blueprint.defaultMailAlias,
    organizationId: blueprint.organizationId,
    positionId: blueprint.positionId,
    metadata: {
      ...(blueprint.metadata || {}),
      authorityTags: position?.authority || blueprint.metadata?.authorityTags || [],
    },
    minRank: position?.minRank,
    maxRank: position?.maxRank,
    authorityTags: position?.authority || blueprint.metadata?.authorityTags,
  };
}

function inferCardCategory(groups: Gin7CommandGroup[]): AuthorityCardCategory {
  if (groups.includes('political')) return 'politics';
  if (groups.includes('logistics')) return 'logistics';
  if (groups.includes('command')) return 'command';
  if (groups.includes('personnel')) return 'personnel';
  if (groups.includes('intelligence')) return 'intel';
  if (groups.includes('operation') || groups.includes('tactical')) return 'fleet';
  if (groups.includes('personal')) return 'personal';
  return 'fleet';
}

function collectCommandCodes(groups: Gin7CommandGroup[]): string[] {
  const codes: string[] = [];
  groups.forEach((group) => {
    if (group === 'tactical') {
      TACTICAL_ROOT?.vesselCommands?.forEach((command: any) => codes.push(command.id));
      TACTICAL_ROOT?.fortressCommands?.forEach((command: any) => codes.push(command.id));
      return;
    }
    const category = completeCommandTable.commandCategories[group as CommandCategoryKey];
    if (category) {
      category.commands.forEach((command) => codes.push(command.id));
    }
  });
  return dedupe(codes);
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function buildShortcutIndex(): Gin7CommandShortcut[] {
  const shortcuts: Gin7CommandShortcut[] = [];
  commandMap.forEach((meta, code) => {
    (meta.shortcuts || []).forEach((shortcut) => {
      shortcuts.push({ ...shortcut, commandCode: shortcut.commandCode || code });
    });
  });
  return shortcuts;
}
