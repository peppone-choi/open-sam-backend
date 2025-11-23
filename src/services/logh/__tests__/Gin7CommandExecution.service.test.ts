import { Gin7CommandExecutionService } from '../Gin7CommandExecution.service';
import { gin7CommandCatalog } from '../../../config/gin7/catalog';

const mockMoveExecute = jest.fn();

jest.mock('../../../commands/logh/tactical/Move', () => {
  return {
    MoveTacticalCommand: class {
      execute = mockMoveExecute;
    },
  };
});

jest.mock('../../../models/logh/GalaxyCharacter.model', () => {
  return {
    GalaxyCharacter: {
      findOne: jest.fn(),
    },
  };
});

jest.mock('../../../models/logh/GalaxyAuthorityCard.model', () => {
  return {
    GalaxyAuthorityCard: {
      findOne: jest.fn(),
    },
  };
});

jest.mock('../../../core/command/CommandRegistry', () => ({
  CommandRegistry: {
    getLogh: jest.fn(),
    getAllLoghTypes: jest.fn().mockReturnValue([]),
    loadAll: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../common/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { GalaxyCharacter } = jest.requireMock('../../../models/logh/GalaxyCharacter.model');
const { GalaxyAuthorityCard } = jest.requireMock('../../../models/logh/GalaxyAuthorityCard.model');
const { CommandRegistry } = jest.requireMock('../../../core/command/CommandRegistry');

describe('Gin7CommandExecutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMoveExecute.mockResolvedValue({ success: true, message: 'ok' });
  });

  it('deducts CP and routes tactical commands', async () => {
    const characterDoc = buildCharacterDoc({ commandCodes: ['move'] });
    GalaxyCharacter.findOne.mockResolvedValue(characterDoc);
    GalaxyAuthorityCard.findOne.mockResolvedValue(null);

    const result = await Gin7CommandExecutionService.execute({
      sessionId: 'session-1',
      cardId: 'card.personal.basic',
      commandCode: 'move',
      characterId: 'gal-char-01',
      args: { fleetId: 'fleet-1' },
    });

    expect(result.success).toBe(true);
    expect(result.cpSpent?.mcp).toBeGreaterThan(0);
    expect(characterDoc.save).toHaveBeenCalled();
    expect(mockMoveExecute).toHaveBeenCalledWith('fleet-1', expect.objectContaining({ sessionId: 'session-1' }));
  });

  it('routes strategic commands through CommandRegistry', async () => {
    const characterDoc = buildCharacterDoc({ commandCodes: ['warp'] });
    GalaxyCharacter.findOne.mockResolvedValue(characterDoc);
    GalaxyAuthorityCard.findOne.mockResolvedValue(null);

    class MockStrategicCommand {
      checkConditionExecutable = jest.fn().mockResolvedValue(null);
      execute = jest.fn().mockResolvedValue({ success: true, message: 'warp ok' });
      getName() {
        return 'warp';
      }
      getDisplayName() {
        return '워프';
      }
      getDescription() {
        return '워프 설명';
      }
      getCategory() {
        return 'strategic';
      }
      getRequiredCommandPoints() {
        return 10;
      }
      getRequiredTurns() {
        return 0;
      }
    }

    CommandRegistry.getLogh.mockReturnValue(MockStrategicCommand);

    const result = await Gin7CommandExecutionService.execute({
      sessionId: 'session-1',
      cardId: 'card.personal.basic',
      commandCode: 'warp',
      characterId: 'gal-char-01',
      args: { targetX: 1, targetY: 2 },
    });

    expect(CommandRegistry.loadAll).toHaveBeenCalled();
    expect(CommandRegistry.getLogh).toHaveBeenCalledWith('warp');
    expect(result.success).toBe(true);
    expect(characterDoc.save).toHaveBeenCalled();
  });

  it('rejects commands when card does not include code', async () => {
    const characterDoc = buildCharacterDoc({ commandCodes: [] });
    GalaxyCharacter.findOne.mockResolvedValue(characterDoc);
    GalaxyAuthorityCard.findOne.mockResolvedValue(null);

    await expect(
      Gin7CommandExecutionService.execute({
        sessionId: 'session-1',
        cardId: 'card.personal.basic',
        commandCode: 'move',
        characterId: 'gal-char-01',
        args: { fleetId: 'fleet-1' },
      })
    ).rejects.toThrow('이 카드에서는 선택한 커맨드를 실행할 수 없습니다.');
  });
});

function buildCharacterDoc(options: { commandCodes: string[] }) {
  const doc: any = {
    session_id: 'session-1',
    characterId: 'gal-char-01',
    displayName: '테스트',
    faction: 'empire',
    rank: '대장',
    organizationNodeId: 'palace',
    commandCards: [
      {
        cardId: 'card.personal.basic',
        name: '개인 카드',
        category: 'personal',
        commands: options.commandCodes,
      },
    ],
    commandPoints: {
      pcp: 50,
      mcp: 80,
      lastRecoveredAt: new Date(),
    },
    save: jest.fn().mockResolvedValue(null),
  };
  return doc;
}
