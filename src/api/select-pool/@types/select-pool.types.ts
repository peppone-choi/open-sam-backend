export interface ISelectPool {
  id: string;
  sessionId: string;
  uniqueName: string;
  owner?: string;
  generalId?: string;
  reservedUntil?: Date;
  info: any;
  createdAt: Date;
  updatedAt: Date;
}
