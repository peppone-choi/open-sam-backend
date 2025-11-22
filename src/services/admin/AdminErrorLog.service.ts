import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { ApiError } from '../../errors/ApiError';

interface ErrorLogEntry {
  id: number;
  date: string;
  err: string;
  errstr: string;
  errpath: string;
  trace: string;
  webuser?: string;
}

export class AdminErrorLogService {
  private static sql: SqlJsStatic | null = null;

  static async getLogs(options: { offset?: number; limit?: number }) {
    const { offset = 0, limit = 100 } = options;
    const db = await this.loadDatabase();

    try {
      const rows = this.runSelect(db, 'SELECT id, date, err, errstr, errpath, trace, webuser FROM err_log ORDER BY id DESC LIMIT $limit OFFSET $offset', {
        $limit: limit,
        $offset: offset
      });

      const totalRows = this.runSelect(db, 'SELECT COUNT(*) as cnt FROM err_log');
      const total = totalRows[0]?.cnt ?? rows.length;

      return {
        result: true,
        total,
        errorLogs: rows.map(row => ({
          ...row,
          date: this.formatDate(row.date),
          trace: this.formatTrace(row.trace)
        }))
      };
    } catch (error: any) {
      throw new ApiError(500, '에러 로그를 불러오는데 실패했습니다', { reason: error.message });
    } finally {
      db.close();
    }
  }

  private static async loadDatabase(): Promise<Database> {
    const SQL = await this.getSqlInstance();
    const dbPath = this.resolveDbPath();

    try {
      const fileBuffer = fs.readFileSync(dbPath);
      return new SQL.Database(new Uint8Array(fileBuffer));
    } catch (error: any) {
      throw new ApiError(500, '에러 로그 저장소를 열 수 없습니다', { reason: error.message, path: dbPath });
    }
  }

  private static async getSqlInstance() {
    if (!this.sql) {
      this.sql = await initSqlJs();
    }
    return this.sql;
  }

  private static runSelect(db: Database, query: string, params: Record<string, number> = {}) {
    const stmt = db.prepare(query);
    stmt.bind(params);

    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as ErrorLogEntry);
    }

    stmt.free();
    return rows;
  }

  private static resolveDbPath() {
    const customPath = process.env.ERROR_LOG_DB;
    const candidates = [
      customPath,
      path.resolve(process.cwd(), 'd_log', 'err_log.sqlite3'),
      path.resolve(process.cwd(), '..', 'd_log', 'err_log.sqlite3')
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new ApiError(404, '에러 로그 저장소를 찾을 수 없습니다');
  }

  private static formatDate(dateStr: string) {
    if (typeof dateStr !== 'string') {
      return dateStr;
    }

    if (/^\d{8}_\d{6}$/.test(dateStr)) {
      const [ymd, hms] = dateStr.split('_');
      const year = ymd.slice(0, 4);
      const month = ymd.slice(4, 6);
      const day = ymd.slice(6, 8);
      const hour = hms.slice(0, 2);
      const minute = hms.slice(2, 4);
      const second = hms.slice(4, 6);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    return dateStr;
  }

  private static formatTrace(trace: string) {
    if (!trace) {
      return '';
    }

    try {
      const parsed = JSON.parse(trace);
      if (Array.isArray(parsed)) {
        return parsed.join('\n');
      }
      if (typeof parsed === 'string') {
        return parsed;
      }
    } catch (error) {
      // ignore
    }

    return trace;
  }
}
