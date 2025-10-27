import { MessageModel, IMessageDocument } from '../model/message.model';
import { IMessage } from '../@types/message.types';

export class MessageRepository {
  async findById(id: string): Promise<IMessage | null> {
    const message = await MessageModel.findById(id).lean().exec();
    return message as IMessage | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IMessage[]> {
    const messages = await MessageModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return messages as IMessage[];
  }

  async findByReceiverId(receiverId: string, limit = 20, skip = 0): Promise<IMessage[]> {
    const messages = await MessageModel.find({ dest: receiverId })
      .limit(limit)
      .skip(skip)
      .sort({ time: -1 })
      .lean()
      .exec();
    
    return messages as IMessage[];
  }

  async create(data: Partial<IMessage>): Promise<IMessage> {
    const message = new MessageModel(data);
    await message.save();
    return message.toObject() as IMessage;
  }

  async update(id: string, data: Partial<IMessage>): Promise<IMessage | null> {
    const message = await MessageModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return message ? (message.toObject() as IMessage) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await MessageModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
