export interface IUserRecord {
  id: string;
  userId: string;
  serverId: string;
  logType: string;
  year: number;
  month: number;
  date?: Date;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
