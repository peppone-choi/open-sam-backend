export interface IGeneral {
  _id?: string;
  name: string;
  nationId: string;
  cityId: string | null;
  
  level: number;
  exp: number;
  
  command: number;
  strength: number;
  intelligence: number;
  leadership: number;
  
  pcp: number;
  pcpMax: number;
  mcp: number;
  mcpMax: number;
  
  hp: number;
  maxHp: number;
  
  positionId: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateGeneralDto {
  name: string;
  nationId: string;
  command: number;
  strength: number;
  intelligence: number;
  leadership: number;
}
