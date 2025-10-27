import { CommentModel, ICommentDocument } from '../model/comment.model';
import { IComment } from '../@types/comment.types';

export class CommentRepository {
  async findById(id: string): Promise<IComment | null> {
    const comment = await CommentModel.findById(id).lean().exec();
    return comment as IComment | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IComment[]> {
    const comments = await CommentModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return comments as IComment[];
  }

  async findByBoardId(boardId: string, limit = 20, skip = 0): Promise<IComment[]> {
    const comments = await CommentModel.find({ documentNo: boardId })
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return comments as IComment[];
  }

  async create(data: Partial<IComment>): Promise<IComment> {
    const comment = new CommentModel(data);
    await comment.save();
    return comment.toObject() as IComment;
  }

  async update(id: string, data: Partial<IComment>): Promise<IComment | null> {
    const comment = await CommentModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return comment ? (comment.toObject() as IComment) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CommentModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
