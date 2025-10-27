export interface ISelectNpcToken {
  id: string;
  sessionId: string;
  owner: string;
  validUntil: Date;
  pickMoreFrom: Date;
  pickResult: any;
  nonce: number;
  createdAt: Date;
  updatedAt: Date;
}
