export interface INation {
  _id?: string;
  name: string;
  color: string;
  rulerId: string | null;
  
  gold: number;
  food: number;
  
  createdAt: Date;
  updatedAt: Date;
}
