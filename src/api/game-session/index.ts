/**
 * GameSession Module
 * 
 * Entity 시스템 기반 게임 세션 관리
 * - scenarioId를 통해 Entity와 연결
 * - CQRS 패턴 지원 (turnBased/realtime)
 * - 시나리오 템플릿 기반 Entity 초기화
 */

export * from './@types/game-session.types';
export { CreateGameSessionDto } from './dto/create-game-session.dto';
export { UpdateGameSessionDto } from './dto/update-game-session.dto';
export * from './model/game-session.model';
export * from './repository/game-session.repository';
export * from './service/game-session.service';
export * from './controller/game-session.controller';
export { default as gameSessionRouter } from './router/game-session.router';
