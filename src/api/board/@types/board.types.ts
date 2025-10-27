export interface IBoard {
  id: string;
  sessionId: string;
  nationNo: string;
  isSecret: boolean;
  date: Date;
  generalNo: string;
  author: string;
  authorIcon?: string;
  title: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
