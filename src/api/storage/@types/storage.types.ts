export interface IStorage {
  id: string;
  namespace: string;
  key: string;
  value: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStorageDto {
  namespace: string;
  key: string;
  value: Record<string, any>;
}

export interface UpdateStorageDto {
  namespace?: string;
  key?: string;
  value?: Record<string, any>;
}
