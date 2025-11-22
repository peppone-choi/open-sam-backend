import { getCommand, getNationCommand } from '../../commands';
import * as generalCommands from '../../commands/general';
import * as nationCommands from '../../commands/nation';

describe('CommandRegistry normalization', () => {
  it('resolves legacy che_ prefixes for general commands', () => {
    expect(getCommand('che_상업투자')).toBe(generalCommands.InvestCommerceCommand);
    expect(getCommand('che_사기진작')).toBe(generalCommands.BoostMoraleCommand);
    expect(getCommand('che_치안강화')).toBe(generalCommands.ReinforceSecurityCommand);
  });

  it('resolves cr_ commands without losing the special class', () => {
    expect(getCommand('cr_건국')).toBe(generalCommands.CrFoundNationCommand);
    expect(getCommand('cr_맹훈련')).toBe(generalCommands.IntensiveTrainingCommand);
  });

  it('resolves spaced legacy names and english identifiers', () => {
    expect(getCommand('주민 선정')).toBe(generalCommands.GoodGovernanceCommand);
    expect(getCommand('무작위 도시 건국')).toBe(generalCommands.RandomFoundNationCommand);
    expect(getCommand('RESET_ADMIN_SKILL')).toBe(generalCommands.ResetAdminSkillCommand);
  });
});

describe('NationCommandRegistry normalization', () => {
  it('handles che_ and event_ prefixes', () => {
    expect(getNationCommand('che_국기변경')).toBe(nationCommands.che_국기변경);
    expect(getNationCommand('event_화시병연구')).toBe(nationCommands.event_화시병연구);
    expect(getNationCommand('cr_인구이동')).toBe(nationCommands.CrPopulationMoveCommand);
  });

  it('resolves english identifiers for nation commands', () => {
    expect(getNationCommand('RANDOM_CAPITAL_MOVE')).toBe(nationCommands.RandomCapitalMoveCommand);
  });
});
