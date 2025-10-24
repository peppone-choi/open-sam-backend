import { injectable } from 'tsyringe';
import { CommandRepository } from './command.repository';

@injectable()
export class CommandService {
  constructor(private repository: CommandRepository) {}

  async findById(id: string) {
    return await this.repository.findById(id);
  }

  async findByGeneral(generalId: string) {
    // TODO: 특정 장수의 실행 중인 커맨드 조회
    throw new Error('Method not implemented');
  }

  async cancel(id: string) {
    // TODO: 커맨드 취소 처리
    // TODO: 상태를 CANCELLED로 변경
    throw new Error('Method not implemented');
  }

  async createCommand(generalId: string, type: string, data: any) {
    // TODO: 커맨드 생성
    // TODO: completionTime 계산
    // TODO: Redis Streams에 발행
    throw new Error('Method not implemented');
  }
}
