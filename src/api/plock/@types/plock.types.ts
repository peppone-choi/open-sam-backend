export interface IPlock {
  id: string;
  type: 'GAME' | 'ETC' | 'TOURNAMENT';
  plock: number;
  locktime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlockDto {
  type: 'GAME' | 'ETC' | 'TOURNAMENT';
  plock?: number;
  locktime?: Date;
}

export interface UpdatePlockDto {
  type?: 'GAME' | 'ETC' | 'TOURNAMENT';
  plock?: number;
  locktime?: Date;
}
