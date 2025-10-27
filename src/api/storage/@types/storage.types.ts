export interface IStorage {
  id: string;
  namespace: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}
