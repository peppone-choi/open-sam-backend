import { GalaxyCharacter, ICommandCard } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyAuthorityCard, AuthorityCardCategory, IGalaxyAuthorityCard, ICommandPermission } from '../../models/logh/GalaxyAuthorityCard.model';
import { GalaxyFactionCode } from '../../models/logh/GalaxySession.model';
import { logger } from '../../common/logger';
import { gin7CommandCatalog, getAuthorityCardTemplates, getCommandMeta } from '../../config/gin7/catalog';
import { Gin7AuthorityCardTemplate } from '../../config/gin7/types';

const CARD_LIMIT_PER_CHARACTER = 16; // gin7manual.txt:1076-1088
const STARTER_TEMPLATE_IDS = ['card.personal.basic', 'card.captain.basic'];
const ROLE_STARTER_MAP: Record<string, string[]> = {
  logistics: ['card.logistics.officer'],
};

const TEMPLATE_INDEX = new Map<string, Gin7AuthorityCardTemplate>(
  gin7CommandCatalog.authorityCards.map((template) => [template.templateId, template])
);

function buildCardId(template: Gin7AuthorityCardTemplate, faction: GalaxyFactionCode) {
  return `${template.templateId}:${faction}`;
}

function parseNumericCost(cost: number | string | undefined): number | undefined {
  if (typeof cost === 'number' && Number.isFinite(cost)) {
    return cost;
  }
  if (typeof cost === 'string') {
    const match = cost.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return Number(match[1]);
    }
  }
  return undefined;
}

function createCommandPermissions(commandCodes: string[]): ICommandPermission[] {
  return commandCodes
    .map((code) => {
      const meta = getCommandMeta(code);
      if (!meta) {
        return {
          code,
          label: code,
        } as ICommandPermission;
      }
      const numericCost = parseNumericCost(meta.cpCost);
      const cpCost: ICommandPermission['cpCost'] | undefined = meta.cpType && numericCost !== undefined
        ? meta.cpType === 'PCP'
          ? { pcp: numericCost }
          : { mcp: numericCost }
        : undefined;

      return {
        code,
        label: meta.label,
        cpCost,
      } satisfies ICommandPermission;
    })
    .filter(Boolean) as ICommandPermission[];
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function permissionsEqual(left: ICommandPermission[] = [], right: ICommandPermission[] = []): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((permission, index) => {
    const target = right[index];
    if (!target) {
      return false;
    }
    const sameCode = permission.code === target.code;
    const sameLabel = permission.label === target.label;
    const samePcp = (permission.cpCost?.pcp ?? 0) === (target.cpCost?.pcp ?? 0);
    const sameMcp = (permission.cpCost?.mcp ?? 0) === (target.cpCost?.mcp ?? 0);
    return sameCode && sameLabel && samePcp && sameMcp;
  });
}

function buildAuthorityPayload(template: Gin7AuthorityCardTemplate, faction: GalaxyFactionCode) {
  const metadata = {
    ...(template.metadata || {}),
    authorityTags: template.authorityTags || template.metadata?.authorityTags || [],
    minRank: template.minRank,
    maxRank: template.maxRank,
    catalogVersion: gin7CommandCatalog.version,
  };

  return {
    templateId: template.templateId,
    faction,
    title: template.title,
    category: template.category as AuthorityCardCategory,
    commandCodes: template.commandCodes,
    commandGroups: template.commandGroups,
    manualRef: template.manualRef,
    description: template.description,
    mailAlias: template.defaultMailAlias,
    organizationNodeId: template.organizationId || (template.metadata as any)?.organizationId,
    maxHolders: template.maxHolders ?? 1,
    permissions: createCommandPermissions(template.commandCodes),
    metadata,
  } satisfies Partial<IGalaxyAuthorityCard>;
}

function shouldUpdateAuthorityCard(document: IGalaxyAuthorityCard, payload: Partial<IGalaxyAuthorityCard>): boolean {
  if (document.templateId !== payload.templateId) return true;
  if (document.title !== payload.title) return true;
  if (document.category !== payload.category) return true;
  if (!arraysEqual(document.commandCodes || [], payload.commandCodes || [])) return true;
  if (!arraysEqual(document.commandGroups || [], payload.commandGroups || [])) return true;
  if (document.manualRef !== payload.manualRef) return true;
  if (document.description !== payload.description) return true;
  if (document.mailAlias !== payload.mailAlias) return true;
  if ((document.maxHolders ?? 1) !== (payload.maxHolders ?? 1)) return true;
  if (!permissionsEqual(document.permissions || [], payload.permissions || [])) return true;
  const currentVersion = document.metadata?.catalogVersion;
  const nextVersion = (payload.metadata as any)?.catalogVersion;
  if (currentVersion !== nextVersion) return true;
  return false;
}

export class GalaxyAuthorityCardService {
  static getTemplatesForFaction(faction: GalaxyFactionCode): Gin7AuthorityCardTemplate[] {
    return getAuthorityCardTemplates(faction);
  }

  static getStarterCardPayloads(preferredRole?: string): ICommandCard[] {
    const templateIds = new Set<string>(STARTER_TEMPLATE_IDS);
    (ROLE_STARTER_MAP[preferredRole || ''] || []).forEach((id) => templateIds.add(id));

    return Array.from(templateIds)
      .map((templateId) => TEMPLATE_INDEX.get(templateId))
      .filter((template): template is Gin7AuthorityCardTemplate => Boolean(template))
      .map((template) => this.buildCharacterCardView(template));
  }

  static buildCharacterCardView(template: Gin7AuthorityCardTemplate): ICommandCard {
    return {
      cardId: template.templateId,
      name: template.title,
      category: template.category,
      commands: template.commandCodes,
    };
  }

  static async ensureAuthorityCards(sessionId: string, faction: GalaxyFactionCode): Promise<IGalaxyAuthorityCard[]> {
    const templates = this.getTemplatesForFaction(faction);
    const results: IGalaxyAuthorityCard[] = [];

    for (const template of templates) {
      const cardId = buildCardId(template, faction);
      const payload = buildAuthorityPayload(template, faction);
      let document = await GalaxyAuthorityCard.findOne({ session_id: sessionId, cardId });

      if (!document) {
        document = await GalaxyAuthorityCard.create({
          session_id: sessionId,
          cardId,
          status: 'available',
          ...payload,
        });
        logger.info('GIN7 authority card provisioned', { sessionId, cardId, template: template.templateId });
      } else if (shouldUpdateAuthorityCard(document, payload)) {
        Object.assign(document, payload);
        await document.save();
        logger.info('GIN7 authority card refreshed from catalog', { sessionId, cardId });
      }

      results.push(document);
    }

    return results;
  }

  static async listAuthorityCards(sessionId: string, status?: IGalaxyAuthorityCard['status']) {
    const filter: Record<string, any> = { session_id: sessionId };
    if (status) {
      filter.status = status;
    }
    return GalaxyAuthorityCard.find(filter).lean();
  }

  static async assignCard(
    sessionId: string,
    cardId: string,
    targetCharacterId: string,
    actorCharacterId?: string
  ) {
    const card = await GalaxyAuthorityCard.findOne({ session_id: sessionId, cardId });
    if (!card) {
      throw new Error(`Authority card ${cardId} not found in session ${sessionId}`);
    }

    if (card.status === 'assigned' && card.holderCharacterId !== targetCharacterId) {
      throw new Error('Card already assigned to another character. gin7manual.txt:1076-1088');
    }

    const character = await GalaxyCharacter.findOne({ session_id: sessionId, characterId: targetCharacterId });
    if (!character) {
      throw new Error('Target character not found.');
    }

    if (character.commandCards.length >= CARD_LIMIT_PER_CHARACTER) {
      throw new Error('Command card limit exceeded (max 16 per gin7manual.txt:1086).');
    }

    const alreadyHasCard = character.commandCards.some((entry) => entry.cardId === card.templateId);
    if (alreadyHasCard) {
      throw new Error('Character already holds this authority card template.');
    }

    character.commandCards.push({
      cardId: card.templateId,
      name: card.title,
      category: card.category,
      commands: card.commandCodes,
    });

    await character.save();

    card.status = 'assigned';
    card.holderCharacterId = character.characterId;
    card.holderUserId = (character as any).userId;
    card.lastIssuedAt = new Date();
    if (actorCharacterId) {
      card.metadata = {
        ...(card.metadata || {}),
        lastAssignedBy: actorCharacterId,
      };
    }
    await card.save();

    return { card, character };
  }

  static async releaseCard(sessionId: string, cardId: string, actorCharacterId?: string) {
    const card = await GalaxyAuthorityCard.findOne({ session_id: sessionId, cardId });
    if (!card) {
      throw new Error('Authority card not found.');
    }

    if (card.holderCharacterId) {
      const character = await GalaxyCharacter.findOne({ session_id: sessionId, characterId: card.holderCharacterId });
      if (character) {
        character.commandCards = (character.commandCards || []).filter((entry) => entry.cardId !== card.templateId);
        await character.save();
      }
    }

    card.status = 'available';
    card.holderCharacterId = undefined;
    card.holderUserId = undefined;
    card.lastRevokedAt = new Date();
    if (actorCharacterId) {
      card.metadata = {
        ...(card.metadata || {}),
        lastRevokedBy: actorCharacterId,
      };
    }

    await card.save();
    return card;
  }
}
