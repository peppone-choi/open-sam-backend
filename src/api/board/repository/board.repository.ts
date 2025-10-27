import { BoardModel, IBoardDocument } from '../model/board.model';
import { IBoard } from '../@types/board.types';

export class BoardRepository {
  async findById(id: string): Promise<IBoard | null> {
    const board = await BoardModel.findById(id).lean().exec();
    return board as IBoard | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IBoard[]> {
    const boards = await BoardModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return boards as IBoard[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<IBoard[]> {
    const boards = await BoardModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return boards as IBoard[];
  }

  async create(data: Partial<IBoard>): Promise<IBoard> {
    const board = new BoardModel(data);
    await board.save();
    return board.toObject() as IBoard;
  }

  async update(id: string, data: Partial<IBoard>): Promise<IBoard | null> {
    const board = await BoardModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return board ? (board.toObject() as IBoard) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await BoardModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
