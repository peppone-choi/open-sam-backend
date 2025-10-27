export interface INgAuctionBid {
  id: string;
  sessionId: string;
  auctionId: string;
  owner?: string;
  generalId: string;
  amount: number;
  date: Date;
  aux: any;
  createdAt: Date;
  updatedAt: Date;
}
