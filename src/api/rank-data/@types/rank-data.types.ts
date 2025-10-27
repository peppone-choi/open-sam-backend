export interface IRankData {
  id: string;
  nationId: string;
  generalId: string;
  type: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRankDataDto {
  nationId: string;
  generalId: string;
  type: string;
  value?: number;
}

export interface UpdateRankDataDto {
  nationId?: string;
  generalId?: string;
  type?: string;
  value?: number;
}
