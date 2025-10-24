import { injectable } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../infrastructure/database/prisma-client';

@injectable()
export class CityRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async findById(id: string) {
    return await this.prisma.city.findUnique({
      where: { id },
      include: {
        nation: true,
        generals: true,
      },
    });
  }

  async findAll(filters?: any) {
    // TODO: 필터링 구현
    throw new Error('Method not implemented');
  }

  async save(city: any) {
    // TODO: upsert 구현
    throw new Error('Method not implemented');
  }
}
