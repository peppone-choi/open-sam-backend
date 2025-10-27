export interface IReservedOpen {
  id: string;
  options: Record<string, any>;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservedOpenDto {
  options: Record<string, any>;
  date: Date;
}

export interface UpdateReservedOpenDto {
  options?: Record<string, any>;
  date?: Date;
}
