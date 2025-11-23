import Ajv from 'ajv';
import schema from '../../../../config/gin7/catalog.schema.json';
import { gin7CommandCatalog, getAuthorityCardTemplates, getCommandMeta } from '../catalog';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

describe('gin7CommandCatalog structure', () => {
  it('conforms to the published schema', () => {
    const valid = validate(gin7CommandCatalog);
    if (!valid && validate.errors) {
      console.error(validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('contains short metadata for known commands', () => {
    const warp = getCommandMeta('warp');
    expect(warp).toBeDefined();
    expect(warp?.group).toBe('operation');
    expect(warp?.cpType).toBeDefined();
  });

  it('filters authority card templates by faction', () => {
    const empire = getAuthorityCardTemplates('empire');
    const alliance = getAuthorityCardTemplates('alliance');
    expect(empire.length).toBeGreaterThan(0);
    expect(alliance.length).toBeGreaterThan(0);
    empire.forEach((card) => {
      expect(card.factionScope).toEqual(expect.arrayContaining(['empire', 'shared']));
    });
  });
});
