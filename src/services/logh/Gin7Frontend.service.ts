import { randomUUID } from 'crypto';
import { logger } from '../../common/logger';
import { GalaxyCharacter, IGalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyAuthorityCard, IGalaxyAuthorityCard } from '../../models/logh/GalaxyAuthorityCard.model';
import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { GalaxyOperation, IGalaxyOperation } from '../../models/logh/GalaxyOperation.model';
import { Gin7PlanningDraft, IGin7PlanningDraft } from '../../models/logh/Gin7PlanningDraft.model';
import { Gin7TacticalPreference, Gin7EnergyProfile, IGin7TacticalPreference } from '../../models/logh/Gin7TacticalPreference.model';
import { Gin7TelemetrySample, IGin7TelemetrySample } from '../../models/logh/Gin7TelemetrySample.model';
import { listCommMessages } from './GalaxyComm.service';
import navigationGrid from '../../../config/scenarios/legend-of-galactic-heroes/data/map-navigation-grid.json';
import planetCatalog from '../../../config/scenarios/legend-of-galactic-heroes/data/planets-and-systems-with-stats.json';

export function tupleAll<T extends readonly Promise<unknown>[]>(promises: T) {
  return Promise.all(promises) as Promise<{ [K in keyof T]: Awaited<T[K]> }>;
}

export type Gin7Faction = 'empire' | 'alliance' | 'phezzan' | 'neutral';
export type Gin7CommandType = 'warp' | 'move' | 'attack' | 'supply' | 'personnel' | 'tactics';

export interface Gin7StrategicCell {
  x: number;
  y: number;
  type: 'space' | 'star_system' | 'impassable';
  label?: string;
  navigable: boolean;
  density?: number;
}

export interface Gin7FleetMarker {
  id: string;
  name: string;
  faction: Gin7Faction;
  x: number;
  y: number;
  status: 'idle' | 'moving' | 'engaging' | 'retreating';
  cpLoad: { pcp: number; mcp: number };
  isFlagship: boolean;
}

export interface Gin7StrategicState {
  gridWidth: number;
  gridHeight: number;
  cells: Gin7StrategicCell[];
  fleets: Gin7FleetMarker[];
  viewport: { x: number; y: number };
}

export interface Gin7AuthorityCard {
  id: string;
  title: string;
  rank: string;
  faction: Gin7Faction;
  commands: Gin7CommandType[];
  shortcuts: Array<{ key: string; label: string; description: string; type: Gin7CommandType }>;
}

export interface Gin7CommandPlan {
  id: string;
  objective: 'occupy' | 'defend' | 'sweep';
  target: string;
  plannedStart: string;
  participants: string[];
  status: 'draft' | 'issued' | 'active' | 'completed';
  notes?: string;
}

export interface Gin7TacticalUnit {
  id: string;
  name: string;
  type: 'flagship' | 'capital' | 'escort' | 'fortress';
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  position: { row: number; col: number };
  heading: number;
  faction: Gin7Faction;
}

export interface Gin7TacticalState {
  units: Gin7TacticalUnit[];
  energy: Gin7EnergyProfile;
  radarHeat: number;
}

export interface Gin7ChatMessage {
  id: string;
  channel: 'global' | 'fleet' | 'faction';
  author: string;
  text: string;
  timestamp: string;
}

export interface Gin7SessionOverview {
  profile: {
    id: string;
    name: string;
    rank: string;
    faction: Gin7Faction;
    pcp: number;
    mcp: number;
    maxPcp: number;
    maxMcp: number;
    jobCards: Array<{ id: string; title: string; rankReq: string; commands: Gin7CommandType[] }>;
    sessionId?: string;
  };
  cpRegenSeconds: number;
  cards: Gin7AuthorityCard[];
}

export interface Gin7ApiBundle {
  session: Gin7SessionOverview;
  strategic: Gin7StrategicState;
  plans: Gin7CommandPlan[];
  tactical: Gin7TacticalState;
  chat: Gin7ChatMessage[];
}

export interface Gin7TelemetryPayload {
  scene: string;
  avgFps: number;
  cpuPct: number;
  memoryMb: number;
  sampleCount: number;
  durationMs: number;
}

interface StarSystemMeta {
  x: number;
  y: number;
  label: string;
  faction: Gin7Faction;
  density: number;
}

interface NavigationGridPayload {
  metadata: { gridSize: { width: number; height: number } };
  grid: number[][];
}

interface PlanetCatalogPayload {
  starSystems?: Array<{
    systemName?: string;
    faction?: string;
    gridCoordinates?: { x: number; y: number };
    strategicValue?: string;
    planets?: Array<{ stats?: { population?: number } }>;
  }>;
}

const navGrid = navigationGrid as NavigationGridPayload;
const planetData = planetCatalog as PlanetCatalogPayload;
const GRID_WIDTH = navGrid.metadata?.gridSize?.width ?? 100;
const GRID_HEIGHT = navGrid.metadata?.gridSize?.height ?? 50;

const NAV_MATRIX: number[][] = Array.isArray(navGrid.grid) ? navGrid.grid : [];
const STAR_SYSTEM_BY_COORD = new Map<string, StarSystemMeta>();

(planetData.starSystems || []).forEach((system) => {
  if (!system.gridCoordinates || typeof system.gridCoordinates.x !== 'number' || typeof system.gridCoordinates.y !== 'number') {
    return;
  }
  const key = `${system.gridCoordinates.x},${system.gridCoordinates.y}`;
  const totalPopulation = (system.planets || []).reduce((sum, planet) => sum + (planet.stats?.population ?? 0), 0);
  const density = clamp(totalPopulation / 6000, 0.1, 1);
  STAR_SYSTEM_BY_COORD.set(key, {
    x: system.gridCoordinates.x,
    y: system.gridCoordinates.y,
    label: system.systemName || `SYS-${key}`,
    faction: mapFaction(system.faction as any),
    density,
  });
});

const BASE_CELLS: Gin7StrategicCell[] = buildBaseCells();

const COMMAND_SHORTCUT_PRESET: Record<Gin7CommandType, { key: string; label: string; description: string }> = {
  warp: { key: 'w', label: '워프', description: '워프 / 고속 이동' },
  move: { key: 'f', label: '이동', description: '그리드 이동' },
  attack: { key: 'r', label: '공격', description: '포격 / 함포전' },
  supply: { key: 's', label: '보급', description: '연료·탄약 보급' },
  personnel: { key: 'p', label: '인사', description: '통신 / 메신저' },
  tactics: { key: 't', label: '전술', description: '진형 / 작전 변경' },
};

const COMMAND_CODE_MAP: Record<string, Gin7CommandType> = {
  warp: 'warp',
  move: 'move',
  travel: 'move',
  attack: 'attack',
  tactics: 'tactics',
  supply: 'supply',
  dock: 'supply',
  resupply: 'supply',
  allocate: 'supply',
  reorganize: 'tactics',
  'formation:set': 'tactics',
  chat: 'personnel',
  'mail:personal': 'personnel',
  'set-tax': 'personnel',
  'appoint-governor': 'personnel',
  'declare-plan': 'tactics',
  'withdraw-plan': 'tactics',
};

export class Gin7FrontendService {
  static async resolveCharacter(sessionId: string, userId?: string, characterId?: string) {
    if (!sessionId) {
      throw new Error('gin7 컨텍스트에는 sessionId가 필요합니다.');
    }

    const query: Record<string, any> = { session_id: sessionId };
    if (characterId) {
      query.characterId = characterId;
    } else if (userId) {
      query.userId = userId;
    }

    let character = await GalaxyCharacter.findOne(query).lean<IGalaxyCharacter>().exec();
    if (!character && !characterId) {
      character = await GalaxyCharacter.findOne({ session_id: sessionId }).lean<IGalaxyCharacter>().exec();
    }
    return character;
  }

  static async getSessionOverview(sessionId: string, character: IGalaxyCharacter | null): Promise<Gin7SessionOverview> {
    if (!character) {
      throw new Error('캐릭터 정보를 찾을 수 없습니다');
    }

    const authorityCards = await GalaxyAuthorityCard.find({
      session_id: sessionId,
      holderCharacterId: character.characterId,
    })
      .lean<IGalaxyAuthorityCard[]>();

    const cards = authorityCards.length
      ? authorityCards.map((card) => mapAuthorityCard(card, character.rank))
      : (character.commandCards || []).map((card) => buildCardFromCommandEntry(card, character.rank, character.faction as any));

    const normalizedCards = cards.filter(Boolean) as Gin7AuthorityCard[];

    const jobCards = (character.commandCards || []).map((entry) => ({
      id: entry.cardId,
      title: entry.name,
      rankReq: entry.category,
      commands: dedupe(entry.commands || []).map((code) => COMMAND_CODE_MAP[code] || 'personnel') as Gin7CommandType[],
    }));

    return {
      profile: {
        id: character.characterId,
        name: character.displayName,
        rank: character.rank,
        faction: mapFaction(character.faction as any),
        pcp: character.commandPoints?.pcp ?? 0,
        mcp: character.commandPoints?.mcp ?? 0,
        maxPcp: Math.max(120, character.commandPoints?.pcp ?? 0),
        maxMcp: Math.max(160, character.commandPoints?.mcp ?? 0),
        jobCards,
        sessionId,
      },
      cpRegenSeconds: computeCpCountdown(character.commandPoints?.lastRecoveredAt),
      cards: normalizedCards,
    };
  }

  static async getStrategicState(sessionId: string, factionHint?: Gin7Faction): Promise<Gin7StrategicState> {
    const fleets = await Fleet.find({ session_id: sessionId }).lean<IFleet[]>();
    const markers = fleets.map(mapFleetMarker);
    const viewport = pickViewport(markers, factionHint);

    return {
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      cells: cloneCells(),
      fleets: markers,
      viewport,
    };
  }

  static async getCommandPlans(sessionId: string, characterId?: string): Promise<Gin7CommandPlan[]> {
    const [operations, drafts] = await tupleAll([
      GalaxyOperation.find({ session_id: sessionId }).sort({ updatedAt: -1 }).limit(25).lean<IGalaxyOperation[]>(),
      characterId
        ? Gin7PlanningDraft.find({ session_id: sessionId, characterId }).sort({ updatedAt: -1 }).limit(15).lean<IGin7PlanningDraft[]>()
        : Promise.resolve([] as IGin7PlanningDraft[]),
    ] satisfies readonly [
      Promise<IGalaxyOperation[]>,
      Promise<IGin7PlanningDraft[]>
    ]);

    const participantIds = new Set<string>();
    operations.forEach((operation) => {
      (operation.participants || []).forEach((participant) => participantIds.add(participant.characterId));
      participantIds.add(operation.authorCharacterId);
    });

    const participantNames = participantIds.size
      ? await fetchCharacterNames(sessionId, Array.from(participantIds))
      : new Map<string, string>();

    const mappedOperations = operations.map((operation) => mapOperationPlan(operation, participantNames));
    const mappedDrafts = drafts.map(mapDraftPlan);

    return [...mappedDrafts, ...mappedOperations].sort((a, b) => (a.plannedStart > b.plannedStart ? -1 : 1));
  }

  static async getTacticalState(sessionId: string, character: IGalaxyCharacter | null): Promise<Gin7TacticalState> {
    const [fleets, preference] = await tupleAll([
      Fleet.find({ session_id: sessionId }).lean<IFleet[]>(),
      character
        ? Gin7TacticalPreference.findOne({ session_id: sessionId, characterId: character.characterId }).lean<IGin7TacticalPreference>()
        : Promise.resolve(null as IGin7TacticalPreference | null),
    ] satisfies readonly [
      Promise<IFleet[]>,
      Promise<IGin7TacticalPreference | null>
    ]);
    const units = fleets.map(mapTacticalUnit);

    const energy = preference?.energy ?? {
      beam: 24,
      gun: 18,
      shield: 20,
      engine: 14,
      warp: 12,
      sensor: 12,
    };

    const radarHeat = units.length ? units.filter((unit) => unit.type === 'flagship').length / units.length : 0;

    return { units, energy, radarHeat };
  }

  static async getChatLog(sessionId: string, limit = 20): Promise<Gin7ChatMessage[]> {
    const messages = await listCommMessages(sessionId, { channelType: 'global', limit });
    return messages.map((message) => ({
      id: message._id?.toString() || randomUUID(),
      channel: 'global',
      author: message.senderName || 'Unknown',
      text: message.message,
      timestamp: (message.createdAt ?? new Date()).toISOString(),
    }));
  }

  static async updateEnergyProfile(sessionId: string, characterId: string, energy: Gin7EnergyProfile): Promise<Gin7EnergyProfile> {
    const payload = {
      session_id: sessionId,
      characterId,
      energy,
    };

    const record = await Gin7TacticalPreference.findOneAndUpdate(
      { session_id: sessionId, characterId },
      payload,
      { upsert: true, new: true }
    ).lean<IGin7TacticalPreference>();

    return record?.energy ?? energy;
  }

  static async saveOperationDraft(sessionId: string, characterId: string, draft: Partial<Gin7CommandPlan>): Promise<Gin7CommandPlan> {
    const planId = draft.id || randomUUID();
    const document = await Gin7PlanningDraft.findOneAndUpdate(
      { session_id: sessionId, characterId, planId },
      {
        session_id: sessionId,
        characterId,
        planId,
        objective: draft.objective || 'occupy',
        target: draft.target || '미설정',
        plannedStart: draft.plannedStart || new Date().toISOString(),
        participants: draft.participants || [],
        status: draft.status || 'draft',
        notes: draft.notes,
      },
      { upsert: true, new: true }
    ).lean<IGin7PlanningDraft>();

    return mapDraftPlan(document);
  }

  static async recordTelemetry(sessionId: string, characterId: string | undefined, payload: Gin7TelemetryPayload) {
    if (!payload.scene) {
      throw new Error('텔레메트리 전송에는 scene 값이 필요합니다.');
    }

    const sample: Partial<IGin7TelemetrySample> = {
      session_id: sessionId,
      characterId,
      scene: payload.scene,
      avgFps: payload.avgFps,
      cpuPct: payload.cpuPct,
      memoryMb: payload.memoryMb,
      sampleCount: payload.sampleCount,
      durationMs: payload.durationMs,
      collectedAt: new Date(),
    };

    await Gin7TelemetrySample.create(sample);
    logger.info('[gin7] telemetry sample recorded', {
      sessionId,
      characterId,
      scene: payload.scene,
      avgFps: payload.avgFps,
      cpuPct: payload.cpuPct,
    });

    if (characterId) {
      await Gin7TacticalPreference.findOneAndUpdate(
        { session_id: sessionId, characterId },
        {
          $set: {
            telemetry: {
              avgFps: payload.avgFps,
              cpuPct: payload.cpuPct,
              memoryMb: payload.memoryMb,
              sampleCount: payload.sampleCount,
              collectedAt: new Date(),
            },
          },
        },
        { upsert: true }
      );
    }
  }

  static async listTelemetrySamples(sessionId: string, limit = 10) {
    // TODO(GIN7-DASHBOARD): replace this simple find() with an aggregation
    // pipeline that groups by scene, computes avg/min/max FPS & CPU, and feeds
    // a dashboard-ready response for QA.
    return Gin7TelemetrySample.find({ session_id: sessionId })
      .sort({ collectedAt: -1 })
      .limit(limit)
      .lean<IGin7TelemetrySample[]>();
  }
}

function buildBaseCells(): Gin7StrategicCell[] {
  const cells: Gin7StrategicCell[] = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const navValue = NAV_MATRIX[y]?.[x] ?? 1;
      const key = `${x},${y}`;
      const system = STAR_SYSTEM_BY_COORD.get(key);
      const type: Gin7StrategicCell['type'] = system ? 'star_system' : navValue === 0 ? 'impassable' : 'space';
      cells.push({
        x,
        y,
        type,
        label: system?.label,
        navigable: navValue === 1,
        density: system?.density,
      });
    }
  }
  return cells;
}

function cloneCells() {
  return BASE_CELLS.map((cell) => ({ ...cell }));
}

function computeCpCountdown(lastRecoveredAt?: Date) {
  if (!lastRecoveredAt) return 300;
  const cycleSeconds = 300;
  const elapsed = Math.floor((Date.now() - new Date(lastRecoveredAt).getTime()) / 1000);
  const remaining = cycleSeconds - (elapsed % cycleSeconds);
  return clamp(remaining, 0, cycleSeconds);
}

function mapAuthorityCard(card: IGalaxyAuthorityCard, rank: string): Gin7AuthorityCard {
  const commands = dedupe(card.commandCodes || []).map((code) => COMMAND_CODE_MAP[code] || 'personnel');
  return {
    id: card.cardId,
    title: card.title,
    rank,
    faction: mapFaction(card.faction as any),
    commands,
    shortcuts: buildShortcuts(commands),
  };
}

function buildCardFromCommandEntry(entry: IGalaxyCharacter['commandCards'][number], rank: string, faction: string): Gin7AuthorityCard {
  const commands = dedupe(entry.commands || []).map((code) => COMMAND_CODE_MAP[code] || 'personnel');
  return {
    id: entry.cardId,
    title: entry.name,
    rank,
    faction: mapFaction(faction as any),
    commands,
    shortcuts: buildShortcuts(commands),
  };
}

function buildShortcuts(commands: Gin7CommandType[]) {
  const seen = new Set<string>();
  return commands
    .map((command) => {
      const preset = COMMAND_SHORTCUT_PRESET[command];
      if (!preset || seen.has(preset.key)) {
        return null;
      }
      seen.add(preset.key);
      return { key: preset.key, label: preset.label, description: preset.description, type: command };
    })
    .filter(Boolean) as Array<{ key: string; label: string; description: string; type: Gin7CommandType }>;
}

function mapFleetMarker(fleet: IFleet): Gin7FleetMarker {
  const status: Gin7FleetMarker['status'] = fleet.isInCombat
    ? 'engaging'
    : fleet.isMoving
    ? 'moving'
    : fleet.status === 'retreating'
    ? 'retreating'
    : 'idle';

  return {
    id: fleet.fleetId,
    name: fleet.name,
    faction: mapFaction(fleet.faction as any),
    x: clamp(fleet.strategicPosition?.x ?? 0, 0, GRID_WIDTH - 1),
    y: clamp(fleet.strategicPosition?.y ?? 0, 0, GRID_HEIGHT - 1),
    status,
    cpLoad: {
      pcp: Math.max(0, Math.round((fleet.totalStrength || 0) / 100)),
      mcp: Math.max(0, Math.round((fleet.totalShips || 0) / 5)),
    },
    isFlagship: fleet.fleetType === 'single_ship',
  };
}

function pickViewport(fleets: Gin7FleetMarker[], factionHint?: Gin7Faction) {
  const focusFleet = factionHint ? fleets.find((fleet) => fleet.faction === factionHint) : fleets[0];
  if (!focusFleet) {
    return { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) };
  }
  return { x: clamp(focusFleet.x - 4, 0, GRID_WIDTH - 8), y: clamp(focusFleet.y - 3, 0, GRID_HEIGHT - 6) };
}

function mapOperationPlan(operation: IGalaxyOperation, names: Map<string, string>): Gin7CommandPlan {
  const objective = mapObjective(operation.objectiveType);
  const key = `${operation.targetGrid?.x},${operation.targetGrid?.y}`;
  const system = STAR_SYSTEM_BY_COORD.get(key);
  const plannedStart = operation.timeline?.issuedAt?.toISOString() || new Date().toISOString();

  return {
    id: operation.operationId,
    objective,
    target: system?.label || `(${operation.targetGrid?.x}, ${operation.targetGrid?.y})`,
    plannedStart,
    participants: operation.participants?.map((participant) => names.get(participant.characterId) || participant.characterId) || [],
    status: mapPlanStatus(operation.status),
    notes: operation.auditTrail?.at(-1)?.note,
  };
}

function mapDraftPlan(draft: IGin7PlanningDraft): Gin7CommandPlan {
  return {
    id: draft.planId,
    objective: draft.objective,
    target: draft.target,
    plannedStart: draft.plannedStart || new Date(draft.updatedAt || draft.createdAt || new Date()).toISOString(),
    participants: draft.participants,
    status: draft.status,
    notes: draft.notes,
  };
}

function mapTacticalUnit(fleet: IFleet): Gin7TacticalUnit {
  const strength = Math.max(1, fleet.totalStrength || 1);
  const hp = Math.min(strength * 120, strength * 200);
  return {
    id: fleet.fleetId,
    name: fleet.name,
    type: fleet.fleetType === 'single_ship' ? 'flagship' : fleet.fleetType === 'ground_force' ? 'fortress' : 'capital',
    hp,
    maxHp: strength * 200,
    energy: clamp(Math.round((fleet.morale ?? 70) * 0.9), 10, 100),
    maxEnergy: 100,
    position: {
      row: clamp(fleet.tacticalPosition?.y ?? fleet.strategicPosition?.y ?? 0, 0, GRID_HEIGHT - 1),
      col: clamp(fleet.tacticalPosition?.x ?? fleet.strategicPosition?.x ?? 0, 0, GRID_WIDTH - 1),
    },
    heading: fleet.tacticalPosition?.heading ?? 0,
    faction: mapFaction(fleet.faction as any),
  };
}

function mapObjective(objective?: IGalaxyOperation['objectiveType']): Gin7CommandPlan['objective'] {
  switch (objective) {
    case 'defense':
      return 'defend';
    case 'sweep':
    case 'escort':
      return 'sweep';
    default:
      return 'occupy';
  }
}

function mapPlanStatus(status?: IGalaxyOperation['status']): Gin7CommandPlan['status'] {
  switch (status) {
    case 'issued':
    case 'approved':
      return 'issued';
    case 'executing':
      return 'active';
    case 'completed':
      return 'completed';
    default:
      return 'draft';
  }
}

async function fetchCharacterNames(sessionId: string, ids: string[]) {
  const characters = await GalaxyCharacter.find({ session_id: sessionId, characterId: { $in: ids } })
    .select(['characterId', 'displayName'])
    .lean<Pick<IGalaxyCharacter, 'characterId' | 'displayName'>[]>();
  const mapEntries = new Map<string, string>();
  characters.forEach((character) => mapEntries.set(character.characterId, character.displayName));
  return mapEntries;
}

function mapFaction(faction?: string): Gin7Faction {
  switch ((faction || '').toLowerCase()) {
    case 'empire':
      return 'empire';
    case 'alliance':
      return 'alliance';
    case 'phezzan':
      return 'phezzan';
    default:
      return 'neutral';
  }
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
