export interface INgAuction {
  id: string;
  sessionId: string;
  type: 'buyRice' | 'sellRice' | 'uniqueItem';
  finished: boolean;
  target?: string;
  hostGeneralId: string;
  reqResource: 'gold' | 'rice' | 'inheritPoint';
  openDate: Date;
  closeDate: Date;
  detail: any;
  createdAt: Date;
  updatedAt: Date;
}
