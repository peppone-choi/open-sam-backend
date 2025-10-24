export interface ICommand {
  _id?: string;
  generalId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  scheduledAt: Date;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
