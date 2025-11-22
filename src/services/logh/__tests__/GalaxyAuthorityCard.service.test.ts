import { GalaxyAuthorityCardService } from '../GalaxyAuthorityCard.service';

describe('GalaxyAuthorityCardService templates', () => {
  it('returns shared + logistics starter cards for logistics preference', () => {
    const cards = GalaxyAuthorityCardService.getStarterCardPayloads('logistics');
    expect(cards).toHaveLength(3);
    expect(cards.find((card) => card.cardId === 'card.logistics.officer')).toBeDefined();
  });

  it('filters faction-specific templates', () => {
    const empireTemplates = GalaxyAuthorityCardService.getTemplatesForFaction('empire');
    const rebelTemplates = GalaxyAuthorityCardService.getTemplatesForFaction('rebel');

    expect(empireTemplates.some((tpl) => tpl.templateId === 'card.logistics.officer')).toBe(true);
    expect(rebelTemplates.some((tpl) => tpl.templateId === 'card.logistics.officer')).toBe(false);
    expect(rebelTemplates.every((tpl) => tpl.templateId.startsWith('card.personal') || tpl.templateId.startsWith('card.captain'))).toBe(true);
  });
});
