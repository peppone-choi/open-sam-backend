import { logger } from '../../common/logger';
import { GalaxyAuthorityCard } from '../../models/logh/GalaxyAuthorityCard.model';
import { GalaxyCharacter, IGalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyFactionCode } from '../../models/logh/GalaxySession.model';
import { getCommandMeta, gin7CommandCatalog } from '../../config/gin7/catalog';
import { CommandPointType, Gin7AuthorityCardTemplate, Gin7CommandMeta } from '../../config/gin7/types';
import { CommandRegistry } from '../../core/command/CommandRegistry';
import { ILoghCommandContext, ILoghCommandExecutor } from '../../commands/logh/BaseLoghCommand';
import { AirCombatTacticalCommand } from '../../commands/logh/tactical/AirCombat';
import { AttackTacticalCommand } from '../../commands/logh/tactical/Attack';
import { FireTacticalCommand } from '../../commands/logh/tactical/Fire';
import { FormationTacticalCommand } from '../../commands/logh/tactical/Formation';
import { GroundDeployTacticalCommand } from '../../commands/logh/tactical/GroundDeploy';
import { GroundWithdrawTacticalCommand } from '../../commands/logh/tactical/GroundWithdraw';
import { MoveTacticalCommand } from '../../commands/logh/tactical/Move';
import { ParallelMoveTacticalCommand } from '../../commands/logh/tactical/ParallelMove';
import { RetreatTacticalCommand } from '../../commands/logh/tactical/Retreat';
import { ReverseTacticalCommand } from '../../commands/logh/tactical/Reverse';
import { SortieTacticalCommand } from '../../commands/logh/tactical/Sortie';
import { StanceChangeTacticalCommand } from '../../commands/logh/tactical/StanceChange';
import { StopTacticalCommand } from '../../commands/logh/tactical/Stop';
import { TurnTacticalCommand } from '../../commands/logh/tactical/Turn';

const TEMPLATE_INDEX = new Map<string, Gin7AuthorityCardTemplate>(
  gin7CommandCatalog.authorityCards.map((template) => [template.templateId, template])
);

const RANK_ORDER = [
  '소위',
  '중위',
  '대위',
  '소좌',
  '중좌',
  '대좌',
  '준장',
  '소장',
  '중장',
  '대장',
  '상급대장',
  '원수',
];

const TACTICAL_COMMAND_MAP: Record<string, new () => { executeTactical: (fleetId: string, params: any) => Promise<{ success: boolean; message: string }> }> = {
  move: MoveTacticalCommand,
  parallel_move: ParallelMoveTacticalCommand,
  turn: TurnTacticalCommand,
  reverse: ReverseTacticalCommand,
  retreat: RetreatTacticalCommand,
  formation: FormationTacticalCommand,
  attack: AttackTacticalCommand,
  fire: FireTacticalCommand,
  air_combat: AirCombatTacticalCommand,
  ground_deploy: GroundDeployTacticalCommand,
  ground_withdraw: GroundWithdrawTacticalCommand,
  stance_change: StanceChangeTacticalCommand,
  sortie: SortieTacticalCommand,
  stop: StopTacticalCommand,
};

let loghRegistryReady = false;
let loghRegistryPromise: Promise<void> | null = null;

export interface Gin7CommandExecutionRequest {
  sessionId: string;
  cardId: string;
  commandCode: string;
  characterId: string;
  args?: Record<string, any>;
}

export interface Gin7CommandExecutionResult {
  success: boolean;
  message: string;
  cardId: string;
  commandCode: string;
  cpSpent?: { pcp?: number; mcp?: number };
}

function rankValue(rank?: string) {
  if (!rank) return 0;
  const index = RANK_ORDER.indexOf(rank);
  return index === -1 ? 0 : index;
}

function ensureRankAccess(template: Gin7AuthorityCardTemplate | undefined, characterRank: string) {
  if (!template?.minRank) {
    return;
  }
  const required = rankValue(template.minRank);
  const held = rankValue(characterRank);
  if (held < required) {
    throw new Error(`해당 직무는 ${template.minRank} 이상만 실행할 수 있습니다.`);
  }
}

function ensureOrganizationAccess(template: Gin7AuthorityCardTemplate | undefined, organizationNodeId?: string) {
  if (!template?.organizationId || !organizationNodeId) {
    return;
  }
  if (template.organizationId !== organizationNodeId) {
    const orgName = (template.metadata as any)?.organizationName || template.organizationId;
    throw new Error(`${orgName} 소속만 사용할 수 있는 직무입니다.`);
  }
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

async function deductCommandPoints(meta: Gin7CommandMeta, character: IGalaxyCharacter) {
  if (!meta.cpType) {
    return undefined;
  }
  const numericCost = parseNumericCost(meta.cpCost);
  if (numericCost === undefined) {
    return undefined;
  }

  if (!character.commandPoints) {
    character.commandPoints = { pcp: 0, mcp: 0, lastRecoveredAt: new Date() } as any;
  }

  if (meta.cpType === 'PCP') {
    if ((character.commandPoints.pcp ?? 0) < numericCost) {
      throw new Error(`정략 CP 가 부족합니다. (필요: ${numericCost})`);
    }
    character.commandPoints.pcp -= numericCost;
    await character.save();
    return { pcp: numericCost };
  }

  if ((character.commandPoints.mcp ?? 0) < numericCost) {
    throw new Error(`군사 CP 가 부족합니다. (필요: ${numericCost})`);
  }
  character.commandPoints.mcp -= numericCost;
  await character.save();
  return { mcp: numericCost };
}

async function resolveTemplate(cardId: string, faction: GalaxyFactionCode, sessionId: string) {
  const dbCard = await GalaxyAuthorityCard.findOne({ session_id: sessionId, cardId, faction });
  if (dbCard) {
    return { authorityCard: dbCard, template: TEMPLATE_INDEX.get(dbCard.templateId) };
  }
  return { authorityCard: null, template: TEMPLATE_INDEX.get(cardId) };
}

async function ensureLoghRegistryLoaded() {
  if (loghRegistryReady && CommandRegistry.getAllLoghTypes().length > 0) {
    return;
  }
  if (!loghRegistryPromise) {
    loghRegistryPromise = CommandRegistry.loadAll()
      .then(() => {
        loghRegistryReady = true;
        loghRegistryPromise = null;
      })
      .catch((error) => {
        loghRegistryReady = false;
        loghRegistryPromise = null;
        throw error;
      });
  }
  await loghRegistryPromise;
}

export class Gin7CommandExecutionService {
  /**
   * LOGH 커맨드를 Redis 큐로 발행 (데몬 실행용)
   * - 기존 동기 실행 경로와 병행 사용 가능
   */
  static async enqueue(request: Gin7CommandExecutionRequest): Promise<{ success: boolean; commandId: string }> {
    const { sessionId, commandCode, characterId, args = {} } = request;
    const character = await GalaxyCharacter.findOne({ session_id: sessionId, characterId });
    if (!character) {
      throw new Error('캐릭터 정보를 찾을 수 없습니다.');
    }

    // 큐 메시지 발행 (LOGH용 필드 포함)
    const { CommandQueue } = await import('../../infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    const commandId = `${sessionId}:${characterId}:${commandCode}:${Date.now()}`;

    await queue.init();

    // LOGH 커맨드 실행을 위해 숫자형 commanderNo 파생
    const commanderAdapter = new GalaxyCommanderAdapter(character);
    const commanderNo = commanderAdapter.no;

    await queue.publish({
      commandId,
      category: 'logh',
      type: commandCode,
      generalId: String(characterId),
      sessionId,
      arg: args,
      gameMode: 'logh',
      commanderNo: String(commanderNo),
    });

    logger.info('[GIN7] LOGH command enqueued', {
      sessionId,
      commandCode,
      characterId,
      commandId,
    });

    return { success: true, commandId };
  }

  static async execute(request: Gin7CommandExecutionRequest): Promise<Gin7CommandExecutionResult> {
    const { sessionId, cardId, commandCode, characterId, args = {} } = request;
    const character = await GalaxyCharacter.findOne({ session_id: sessionId, characterId });
    if (!character) {
      throw new Error('캐릭터 정보를 찾을 수 없습니다.');
    }

    const { authorityCard, template } = await resolveTemplate(cardId, character.faction as GalaxyFactionCode, sessionId);
    if (!template) {
      throw new Error('카탈로그에서 직무 정보를 찾을 수 없습니다.');
    }

    if (authorityCard) {
      if (authorityCard.holderCharacterId !== characterId) {
        throw new Error('해당 직무 권한 카드를 보유하고 있지 않습니다.');
      }
    } else {
      const ownsIntrinsicCard = (character.commandCards || []).some((entry) => entry.cardId === cardId && entry.commands?.includes(commandCode));
      if (!ownsIntrinsicCard) {
        throw new Error('해당 직무 권한을 가지고 있지 않습니다.');
      }
    }

    const allowedCommands = authorityCard?.commandCodes || template.commandCodes || [];
    if (!allowedCommands.includes(commandCode)) {
      throw new Error('이 카드에서는 선택한 커맨드를 실행할 수 없습니다.');
    }

    const meta = getCommandMeta(commandCode);
    if (!meta) {
      throw new Error('커맨드 메타데이터를 찾을 수 없습니다.');
    }

    ensureRankAccess(template, character.rank);
    ensureOrganizationAccess(template, character.organizationNodeId);

    if (meta.group === 'tactical') {
      const cpSpent = await deductCommandPoints(meta, character);
      const result = await this.executeTacticalCommand(commandCode, sessionId, args);
      logger.info('[GIN7] Tactical command executed', {
        type: 'tactical',
        sessionId,
        cardId,
        commandCode,
        characterId,
        success: result.success,
      });
      return {
        success: result.success,
        message: result.message,
        cardId,
        commandCode,
        cpSpent,
      };
    }

    return this.executeLoghCommand({ sessionId, cardId, commandCode, character, args, meta, characterId });
  }

  private static async executeLoghCommand(params: {
    sessionId: string;
    cardId: string;
    commandCode: string;
    character: IGalaxyCharacter;
    args: Record<string, any>;
    meta: Gin7CommandMeta;
    characterId: string;
  }): Promise<Gin7CommandExecutionResult> {
    const { sessionId, cardId, commandCode, character, args, meta, characterId } = params;
    await ensureLoghRegistryLoaded();
    const CommandClass = CommandRegistry.getLogh(commandCode);
    if (!CommandClass) {
      throw new Error(`커맨드 '${commandCode}' 를 처리할 수 없습니다.`);
    }

    const commandInstance = new CommandClass();
    const commander = new GalaxyCommanderAdapter(character);
    commander.setCommandPointType(meta.cpType);

    const context: ILoghCommandContext = {
      commander,
      env: { ...args, sessionId },
      session: { id: sessionId },
    };

    const checkResult = await commandInstance.checkConditionExecutable(context);
    if (checkResult !== null) {
      throw new Error(checkResult);
    }

    const cpBefore = commander.getCommandPoints();
    const execution = await commandInstance.execute(context);
    await commander.save();
    const cpAfter = commander.getCommandPoints();
    const spentAmount = Math.max(0, cpBefore - cpAfter);
    const cpSpent = spentAmount > 0
      ? meta.cpType === 'PCP'
        ? { pcp: spentAmount }
        : { mcp: spentAmount }
      : undefined;

    logger.info('[GIN7] Strategic command executed', {
      type: meta.group,
      sessionId,
      cardId,
      commandCode,
      characterId,
      success: execution.success,
    });

    return {
      success: execution.success,
      message: execution.message,
      cardId,
      commandCode,
      cpSpent,
    };
  }

  private static async executeTacticalCommand(commandCode: string, sessionId: string, args: Record<string, any>) {
    const TacticalClass = TACTICAL_COMMAND_MAP[commandCode];
    if (!TacticalClass) {
      throw new Error(`전술 커맨드 '${commandCode}' 는 아직 지원되지 않습니다.`);
    }
    const fleetId = args.fleetId || args.targetFleetId;
    if (!fleetId) {
      throw new Error('전술 커맨드는 fleetId 가 필요합니다.');
    }

    const executor = new TacticalClass();
    const payload = { ...args, sessionId };
    return executor.executeTactical(fleetId, payload);
  }
}

class GalaxyCommanderAdapter implements ILoghCommandExecutor {
  private cpType: CommandPointType = 'MCP';
  private stateStore: Record<string, any> = {};
  private readonly numericId: number;

  constructor(private readonly character: IGalaxyCharacter) {
    const digits = character.characterId?.match(/\d+/g)?.join('');
    this.numericId = digits ? Number(digits) : 0;
  }

  setCommandPointType(type?: CommandPointType) {
    this.cpType = type === 'PCP' ? 'PCP' : 'MCP';
  }

  get no(): number {
    return this.numericId;
  }

  get session_id(): string {
    return this.character.session_id;
  }

  get data(): any {
    return this.character;
  }

  set data(value: any) {
    // 객체인 경우 속성 병합
    if (value && typeof value === 'object') {
      Object.assign(this.character, value);
      if (typeof (this.character as any).markModified === 'function') {
        (this.character as any).markModified('customData');
      }
    }
  }

  getVar(key: string): any {
    return this.stateStore[key];
  }

  setVar(key: string, value: any): void {
    this.stateStore[key] = value;
  }

  increaseVar(key: string, value: number): void {
    const current = this.getVar(key) || 0;
    this.setVar(key, current + value);
  }

  decreaseVar(key: string, value: number): void {
    const current = this.getVar(key) || 0;
    this.setVar(key, current - value);
  }

  getNationID(): number {
    return this.character.faction === 'empire' ? 1 : 2;
  }

  getFactionType(): 'empire' | 'alliance' {
    return this.character.faction === 'empire' ? 'empire' : 'alliance';
  }

  getRank(): number {
    // 계급 문자열을 숫자로 변환 (예: 'lieutenant' -> 3)
    const rankMap: Record<string, number> = {
      'private': 1,
      'corporal': 2,
      'sergeant': 3,
      'lieutenant': 4,
      'captain': 5,
      'major': 6,
      'lieutenant_colonel': 7,
      'colonel': 8,
      'brigadier': 9,
      'major_general': 10,
      'lieutenant_general': 11,
      'general': 12,
      'admiral': 13,
      'marshal': 14
    };
    return rankMap[this.character.rank] || 1;
  }

  getRankName(): string {
    return this.character.rank;
  }

  getCommandPoints(): number {
    const points = this.character.commandPoints || { pcp: 0, mcp: 0 };
    return this.cpType === 'PCP' ? points.pcp ?? 0 : points.mcp ?? 0;
  }

  consumeCommandPoints(amount: number): void {
    if (!this.character.commandPoints) {
      this.character.commandPoints = { pcp: 0, mcp: 0, lastRecoveredAt: new Date() } as any;
    }
    const bucket = this.cpType === 'PCP' ? 'pcp' : 'mcp';
    const next = Math.max(0, (this.character.commandPoints[bucket] ?? 0) - amount);
    this.character.commandPoints[bucket] = next;
  }

  getFleetId(): string | null {
    return this.character.flagshipId || null;
  }

  getPosition(): { x: number; y: number; z: number } {
    return { x: 0, y: 0, z: 0 };
  }

  startCommand(): void {
    // Placeholder: GalaxyCharacter는 아직 activeCommands 컬렉션을 사용하지 않음
  }

  async save(): Promise<any> {
    return this.character.save();
  }
}
