import { MessageRepository } from '../repository/message.repository';
import { IMessage } from '../@types/message.types';

/**
 * Message Service
 * 
 * Manages in-game messaging between players including sending and receiving messages
 */
export class MessageService {
  constructor(private repository: MessageRepository) {}

  async getById(id: string): Promise<IMessage | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IMessage[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByReceiverId(receiverId: string, limit = 20, skip = 0): Promise<IMessage[]> {
    return await this.repository.findByReceiverId(receiverId, limit, skip);
  }

  async create(data: Partial<IMessage>): Promise<IMessage> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IMessage>): Promise<IMessage | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }
}
