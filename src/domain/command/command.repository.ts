import { injectable } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../infrastructure/database/prisma-client';

@injectable()
export class CommandRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async findById(id: string) {
    return await this.prisma.command.findUnique({
      where: { id },
      include: {
        general: true,
        city: true,
      },
    });
  }

  async findByGeneral(generalId: string, status?: string) {
    // TODO: 장수의 커맨드 조회 (상태 필터)
    throw new Error('Method not implemented');
  }

  async save(command: any) {
    // TODO: 커맨드 저장/업데이트
    throw new Error('Method not implemented');
  }
}
