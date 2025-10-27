export interface IVoteComment {
  id: string;
  sessionId: string;
  voteId: number;
  generalId: string;
  nationId: string;
  generalName: string;
  nationName: string;
  text: string;
  date?: Date;
  createdAt: Date;
  updatedAt: Date;
}
