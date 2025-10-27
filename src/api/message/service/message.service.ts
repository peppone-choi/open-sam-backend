import { MessageRepository } from '../repository/message.repository';
import { IMessage } from '../@types/message.types';

export class MessageService {
  constructor(private repository: MessageRepository) {}

  async getById(id: string): Promise<IMessage | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async list(limit: number, skip: number): Promise<IMessage[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IMessage>): Promise<IMessage> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IMessage>): Promise<IMessage | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async remove(id: string): Promise<boolean> {
    return null as any;
    // TODO: 구현
    return false;
  }
}
