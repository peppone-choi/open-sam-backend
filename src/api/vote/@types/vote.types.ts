export interface IVote {
  id: string;
  sessionId: string;
  voteId: number;
  generalId: string;
  nationId: string;
  selection: any;
  createdAt: Date;
  updatedAt: Date;
}
