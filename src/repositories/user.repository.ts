// @ts-nocheck - Type issues need investigation
import { User } from '../models/user.model';
import { DeleteResult } from 'mongodb';

/**
 * 유저 리포지토리
 * 
 * RootDB의 member 테이블에 접근합니다.
 */
class UserRepository {
  /**
   * ID로 유저 조회 (MongoDB _id)
   * @param userId - 유저 ID
   * @returns 유저 문서 또는 null
   */
  async findById(userId: string) {
    return await User.findById(userId).select('-password').exec();
  }

  /**
   * 모든 유저 조회
   * @returns 유저 목록
   */
  async findAll() {
    return await User.find({}).select('-password').exec();
  }

  /**
   * 조건으로 유저 조회
   * @param filter - 검색 조건
   * @returns 유저 목록
   */
  async findByFilter(filter: any) {
    return await User.find(filter).select('-password').exec();
  }

  /**
   * 유저 생성
   * @param data - 유저 데이터
   * @returns 생성된 유저
   */
  async create(data: any) {
    const user = new User(data);
    return await user.save();
  }

  /**
   * 유저 업데이트
   * @param userId - 유저 ID
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateById(userId: string, update: any) {
    return await User.updateOne({ _id: userId }, { $set: update }).exec();
  }

  /**
   * 조건으로 여러 개 업데이트
   * @param filter - 검색 조건
   * @param update - 업데이트할 데이터
   * @returns 업데이트 결과
   */
  async updateManyByFilter(filter: any, update: any) {
    return await User.updateMany(filter, { $set: update }).exec();
  }

  /**
   * 유저 삭제
   * @param userId - 유저 ID
   * @returns 삭제 결과
   */
  async deleteById(userId: string): Promise<DeleteResult> {
    return await User.deleteOne({ _id: userId }).exec() as DeleteResult;
  }

  /**
   * 조건으로 여러 개 삭제
   * @param filter - 검색 조건
   * @returns 삭제 결과
   */
  async deleteManyByFilter(filter: any): Promise<DeleteResult> {
    return await User.deleteMany(filter).exec() as DeleteResult;
  }

  /**
   * 조건에 맞는 유저 수 조회
   * @param filter - 검색 조건
   * @returns 유저 수
   */
  async countByFilter(filter: any): Promise<number> {
    return await User.countDocuments(filter).exec();
  }

  /**
   * 유저 존재 여부 확인
   * @param userId - 유저 ID
   * @returns 존재 여부
   */
  async exists(userId: string): Promise<boolean> {
    const count = await User.countDocuments({ _id: userId }).exec();
    return count > 0;
  }
}

/**
 * 유저 리포지토리 싱글톤 인스턴스
 */
export const userRepository = new UserRepository();
