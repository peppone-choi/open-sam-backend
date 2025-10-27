export interface IComment {
  id: string;
  sessionId: string;
  nationNo: string;
  isSecret: boolean;
  date: Date;
  documentNo: string;
  generalNo: string;
  author: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
