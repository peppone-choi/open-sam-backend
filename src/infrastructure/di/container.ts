import 'reflect-metadata';
import { container } from 'tsyringe';

// Services
import { GeneralService } from '../../domain/general/general.service';
import { CityService } from '../../domain/city/city.service';
import { CommandService } from '../../domain/command/command.service';

// Repositories
import { GeneralRepository } from '../../domain/general/general.repository';
import { CityRepository } from '../../domain/city/city.repository';
import { CommandRepository } from '../../domain/command/command.repository';

// Infrastructure
import { CacheManager } from '../cache/cache-manager';
import { RedisService } from '../cache/redis.service';

/**
 * DI Container 초기화
 * Hint: tsyringe를 사용한 의존성 주입
 */
export function setupContainer() {
  // TODO: 필요한 경우 추가 바인딩
  
  // 자동으로 @injectable() 데코레이터가 처리
  container.register('CacheManager', { useClass: CacheManager });
  container.register('RedisService', { useClass: RedisService });
}
