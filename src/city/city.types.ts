export interface ICity {
  _id?: string;
  name: string;
  nationId: string;
  x: number;
  y: number;
  
  population: number;
  agriculture: number;
  commerce: number;
  security: number;
  defense: number;
  
  soldiers: number;
  gold: number;
  food: number;
  
  createdAt: Date;
  updatedAt: Date;
}
