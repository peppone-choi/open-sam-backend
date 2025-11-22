import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../../models/user.model';
import { ApiError } from '../../errors/ApiError';

const UserModel = User as any;

export class AccountSecurityService {
  static async changePassword(userId: string, currentPassword: string, newPassword: string, globalSalt?: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(400, '새 비밀번호는 최소 8자 이상이어야 합니다');
    }

    if (newPassword === currentPassword) {
      throw new ApiError(400, '새 비밀번호가 기존 비밀번호와 동일합니다');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, '사용자를 찾을 수 없습니다');
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new ApiError(401, '현재 비밀번호가 올바르지 않습니다');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.global_salt = globalSalt || crypto.randomBytes(12).toString('hex');
    user.token_valid_until = new Date();
    await user.save();
  }

  static async scheduleDeletion(userId: string, password: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, '사용자를 찾을 수 없습니다');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new ApiError(401, '비밀번호가 올바르지 않습니다');
    }

    const deleteAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.delete_after = deleteAfter;
    user.deleted = true;
    user.token_valid_until = new Date();
    await user.save();

    return deleteAfter;
  }
}
