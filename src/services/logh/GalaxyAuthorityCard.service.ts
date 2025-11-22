import { GalaxyAuthorityCard, AuthorityCardCategory, IGalaxyAuthorityCard } from '../../models/logh/GalaxyAuthorityCard.model';
import { GalaxyCharacter, ICommandCard } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyFactionCode } from '../../models/logh/GalaxySession.model';
import { logger } from '../../common/logger';

export interface AuthorityCardTemplate {
  templateId: string;
  title: string;
  description: string;
  category: AuthorityCardCategory;
  commandCodes: string[];
  commandGroups: string[];
  manualRef: string;
  factionScope: Array<GalaxyFactionCode | 'shared'>;
  defaultMailAlias?: string;
}

export const AUTHORITY_CARD_TEMPLATES: AuthorityCardTemplate[] = [
  {
    templateId: 'card.personal.basic',
    title: '개인 카드',
    description:
      '모든 캐릭터가 보유하는 개인 행동 카드. 이동과 통신 등 개인 명령군을 담당 (gin7manual Chapter3).',
    category: 'personal',
    commandCodes: ['move', 'travel', 'chat', 'mail:personal'],
    commandGroups: ['개인'],
    manualRef: 'gin7manual.txt:1076-1118',
    factionScope: ['shared'],
    defaultMailAlias: 'personal.card@galaxy',
  },
  {
    templateId: 'card.captain.basic',
    title: '함장 카드',
    description:
      '기함/함대 조종과 보급을 맡는 작전 명령군. 모든 캐릭터가 초기 보유 (Chapter3 직무 권한 카드).',
    category: 'fleet',
    commandCodes: ['warp', 'dock', 'supply', 'formation:set'],
    commandGroups: ['작전', '병참'],
    manualRef: 'gin7manual.txt:1076-1156',
    factionScope: ['shared'],
    defaultMailAlias: 'captain.card@galaxy',
  },
  {
    templateId: 'card.logistics.officer',
    title: '병참 참모 카드',
    description:
      '통솔본부 작전과가 다루는 보급·배정·재편성 명령. 병참 카드는 300 유닛 제한을 준수 (Chapter3 병참).',
    category: 'logistics',
    commandCodes: ['allocate', 'resupply', 'reorganize', 'warehouse:audit'],
    commandGroups: ['병참'],
    manualRef: 'gin7manual.txt:1153-1195,1953-1990',
    factionScope: ['empire', 'alliance'],
    defaultMailAlias: 'logistics@ops.galaxy',
  },
  {
    templateId: 'card.politics.chief',
    title: '국가 정책 카드',
    description:
      '내각·국방위 카드로 세율과 명령 발령을 다루는 정치 명령군 (Chapter3 정치 명령군).',
    category: 'politics',
    commandCodes: ['set-tax', 'appoint-governor', 'declare-plan', 'withdraw-plan'],
    commandGroups: ['정치', '인사'],

    manualRef: 'gin7manual.txt:1158-1188,2334-2350',
    factionScope: ['empire', 'alliance'],
    defaultMailAlias: 'chancellery@galaxy',
  },
];

const CARD_LIMIT_PER_CHARACTER = 16; // gin7manual.txt:1076-1088

function buildCardId(template: AuthorityCardTemplate, faction: GalaxyFactionCode) {
  return `${template.templateId}:${faction}`;
}

export class GalaxyAuthorityCardService {
  static getTemplatesForFaction(faction: GalaxyFactionCode): AuthorityCardTemplate[] {
    return AUTHORITY_CARD_TEMPLATES.filter((template) =>
      template.factionScope.includes('shared') || template.factionScope.includes(faction)
    );
  }

  static getStarterCardPayloads(preferredRole?: string): ICommandCard[] {
    const baseTemplateIds = ['card.personal.basic', 'card.captain.basic'];
    if (preferredRole === 'logistics') {
      baseTemplateIds.push('card.logistics.officer');
    }

    return baseTemplateIds
      .map((id) => AUTHORITY_CARD_TEMPLATES.find((template) => template.templateId === id))
      .filter((template): template is AuthorityCardTemplate => Boolean(template))
      .map((template) => this.buildCharacterCardView(template));
  }

  static buildCharacterCardView(template: AuthorityCardTemplate): ICommandCard {
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
      let document = await GalaxyAuthorityCard.findOne({ session_id: sessionId, cardId });
      if (!document) {
        document = await GalaxyAuthorityCard.create({
          session_id: sessionId,
          cardId,
          templateId: template.templateId,
          faction,
          title: template.title,
          category: template.category,
          commandCodes: template.commandCodes,
          commandGroups: template.commandGroups,
          manualRef: template.manualRef,
          description: template.description,
          mailAlias: template.defaultMailAlias,
          metadata: { source: 'gin7manual', version: '1.0.0' },
        });
        logger.info('GIN7 authority card provisioned', { sessionId, cardId });
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
