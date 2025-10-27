export interface IGeneralRecord {
  id: string;
  sessionId: string;
  generalId: string;
  logType: 'action' | 'battle_brief' | 'battle' | 'history';
  year: number;
  month: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
