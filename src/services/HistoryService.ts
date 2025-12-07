import { History, IHistoryGeneralSnapshot } from '../models/History';
import { HallOfFame } from '../models/HallOfFame';
import { Session } from '../models/session.model';
import { Nation, INation } from '../models/nation.model';
import { City } from '../models/city.model';
import { General } from '../models/general.model';
import { logger } from '../common/logger';

type NumberLike = number | null | undefined;

interface SnapshotContext {
  sessionId: string;
  season: number;
  scenario?: string | number | null;
  year?: number;
  month?: number;
  winnerNationId: number;
  winnerNationName: string;
  nationMap: Map<number, INation>;
}

interface SnapshotCandidate {
  doc: any;
  snapshot: IHistoryGeneralSnapshot;
}

export class HistoryService {
  /**
   * 게임 종료(천하통일) 시점의 데이터를 스냅샷으로 저장
   */
  static async saveGameResult(gameId: string, winnerNationId: number): Promise<void> {
    const sessionId = gameId;

    try {
      const session = await Session.findOne({ session_id: sessionId }).lean();
      if (!session) {
        logger.warn('[HistoryService] 세션을 찾을 수 없습니다.', { sessionId });
        return;
      }

      const sessionData = session.data || {};
      const season = sessionData.season ?? 1;
      const scenario =
        sessionData.scenario ??
        session.scenario_id ??
        session.scenarioId ??
        session.scenarioID ??
        session.scenario_name ??
        null;
      const year = sessionData.year ?? session.year;
      const month = sessionData.month ?? session.month;

      const nations = await Nation.find({ session_id: sessionId })
        .select('nation name data color capital level')
        .lean();
      const nationMap = new Map<number, INation>();
      nations.forEach((n) => nationMap.set(n.nation, n));

      const winnerNation = nationMap.get(winnerNationId);
      const winnerNationName = winnerNation?.data?.name || winnerNation?.name || 'Unknown';

      const rulerDoc = await General.findOne({
        session_id: sessionId,
        $or: [
          { 'data.nation': winnerNationId },
          { nation: winnerNationId }
        ],
        'data.officer_level': 12
      })
        .select('no name owner data nation city picture')
        .lean();

      const generalDocs = await General.find({
        session_id: sessionId,
        $or: [
          { 'data.npc': { $ne: 1 } },
          { npc: { $ne: 1 } }
        ]
      })
        .select('no name owner data nation city picture')
        .lean();

      const rulerSnapshot = rulerDoc
        ? this.toGeneralSnapshot(rulerDoc, nationMap)
        : undefined;
      const topGenerals = this.pickTopGenerals(generalDocs, nationMap, 10);

      const territories = await City.find({ session_id: sessionId })
        .select('city name nation')
        .lean();

      await History.findOneAndUpdate(
        {
          session_id: sessionId,
          season,
          winner_nation_id: winnerNationId
        },
        {
          session_id: sessionId,
          season,
          scenario,
          winner_nation_id: winnerNationId,
          winner_nation_name: winnerNationName,
          year,
          month,
          unified_at: new Date(),
          ruler: rulerSnapshot,
          generals: topGenerals,
          territories: territories.map((c) => ({
            city_id: c.city,
            name: c.name,
            nation_id: c.nation
          })),
          meta: {
            scenario_name: session.scenario_name,
            finished_at: session.finished_at ?? new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await this.saveHallOfFameSnapshot({
        sessionId,
        season,
        scenario,
        year,
        month,
        winnerNationId,
        winnerNationName,
        nationMap
      }, generalDocs, rulerSnapshot);

      logger.info('[HistoryService] 게임 결과 스냅샷 저장 완료', {
        sessionId,
        winnerNationId,
        season,
        year,
        month
      });
    } catch (error: any) {
      logger.error('[HistoryService] 게임 결과 저장 실패', {
        sessionId,
        winnerNationId,
        error: error.message
      });
    }
  }

  private static toNumber(...values: NumberLike[]): number {
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
    }
    return 0;
  }

  private static toGeneralSnapshot(doc: any, nationMap: Map<number, INation>): IHistoryGeneralSnapshot {
    const data = doc.data || {};
    const nationId = data.nation ?? doc.nation;
    const nationName = nationId ? (nationMap.get(nationId)?.data?.name || nationMap.get(nationId)?.name) : undefined;

    return {
      general_no: data.no ?? doc.no ?? 0,
      name: data.name ?? doc.name ?? '무명',
      owner: doc.owner ?? data.owner ?? null,
      nation_id: nationId,
      nation_name: nationName,
      city_id: data.city ?? doc.city,
      officer_level: data.officer_level ?? data.rank ?? undefined,
      picture: data.picture ?? doc.picture,
      stats: {
        leadership: this.toNumber(data.leadership, doc.leadership),
        strength: this.toNumber(data.strength, doc.strength),
        intelligence: this.toNumber(data.intel, doc.intel),
        politics: this.toNumber(data.politics, doc.politics),
        charm: this.toNumber(data.charm, doc.charm)
      },
      records: {
        merit: this.toNumber(data.dedLevel, data.dedication, data.ded),
        experience: this.toNumber(data.experience),
        battles: this.toNumber(data.warnum, data.battle_count),
        wins: this.toNumber(data.win, data.winNum, data.win_count),
        losses: this.toNumber(data.lose, data.loseNum, data.lose_count),
        kills: this.toNumber(data.killnum, data.killNum),
        deaths: this.toNumber(data.deathnum, data.deathNum)
      }
    };
  }

  private static pickTopGenerals(
    generalDocs: any[],
    nationMap: Map<number, INation>,
    limit: number
  ): IHistoryGeneralSnapshot[] {
    const snapshots = generalDocs
      .map((doc) => this.toGeneralSnapshot(doc, nationMap))
      .filter((g) => g.general_no);

    snapshots.sort((a, b) => {
      const meritDiff = (b.records?.merit ?? 0) - (a.records?.merit ?? 0);
      if (meritDiff !== 0) return meritDiff;
      const killDiff = (b.records?.kills ?? 0) - (a.records?.kills ?? 0);
      if (killDiff !== 0) return killDiff;
      return (b.records?.experience ?? 0) - (a.records?.experience ?? 0);
    });

    return snapshots.slice(0, limit);
  }

  private static async saveHallOfFameSnapshot(
    context: SnapshotContext,
    generalDocs: any[],
    rulerSnapshot?: IHistoryGeneralSnapshot
  ): Promise<void> {
    const candidates: SnapshotCandidate[] = generalDocs
      .map((doc) => ({
        doc,
        snapshot: this.toGeneralSnapshot(doc, context.nationMap)
      }))
      .filter(({ snapshot }) => snapshot.general_no);

    const categories: Array<{
      key: string;
      getter: (doc: any, snap: IHistoryGeneralSnapshot) => number;
    }> = [
      { key: 'merit', getter: (doc, snap) => snap.records?.merit ?? 0 },
      { key: 'experience', getter: (doc, snap) => snap.records?.experience ?? 0 },
      { key: 'kill', getter: (doc, snap) => snap.records?.kills ?? 0 },
      { key: 'battle', getter: (doc, snap) => snap.records?.battles ?? 0 }
    ];

    const entries: any[] = [];
    const now = new Date();

    for (const category of categories) {
      const ranked = candidates
        .map(({ doc, snapshot }) => ({
          snapshot,
          value: category.getter(doc, snapshot)
        }))
        .filter((item) => item.value && item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 50);

      ranked.forEach((item, idx) => {
        entries.push({
          session_id: context.sessionId,
          season: context.season,
          scenario: context.scenario ?? null,
          category: category.key,
          rank: idx + 1,
          general_no: item.snapshot.general_no,
          general_name: item.snapshot.name,
          nation_id: item.snapshot.nation_id,
          nation_name: item.snapshot.nation_name,
          value: item.value,
          recorded_at: now,
          meta: {
            year: context.year,
            month: context.month
          }
        });
      });
    }

    if (rulerSnapshot) {
      entries.push({
        session_id: context.sessionId,
        season: context.season,
        scenario: context.scenario ?? null,
        category: 'unifier',
        rank: 1,
        general_no: rulerSnapshot.general_no,
        general_name: rulerSnapshot.name,
        nation_id: context.winnerNationId,
        nation_name: context.winnerNationName,
        value: (context.year ?? 0) * 100 + (context.month ?? 0),
        recorded_at: now,
        meta: {
          title: 'emperor',
          year: context.year,
          month: context.month
        }
      });
    }

    if (entries.length === 0) {
      return;
    }

    await HallOfFame.deleteMany({
      session_id: context.sessionId,
      season: context.season
    });
    await HallOfFame.insertMany(entries);
  }
}


