import { Router } from 'express';
import { CommandController } from '../controller/command.controller';
import { CommandService } from '../../../core/command/CommandService';
import { CommandRepository } from '../repository/command.repository';
import { GameSessionRepository } from '../../game-session/repository/game-session.repository';
import { getCommandQueue } from '../../../container';

const router = Router();

// 의존성 주입
const repository = new CommandRepository();
const sessionRepository = new GameSessionRepository();
const service = new CommandService(repository, getCommandQueue(), sessionRepository);
const controller = new CommandController(service);

/**
 * 명령 라우터
 * 
 * Entity 기반 Controller 연결
 * 기존 API 경로 유지
 */

// 목록 조회
router.get('/', controller.list);

// 상세 조회
router.get('/:id', controller.getById);

// 지휘관별 조회
router.get('/commander/:commanderId', controller.getByCommanderId);

// 명령 제출
router.post('/', controller.create);
router.post('/submit', controller.submit);

// 명령 업데이트 (비활성화)
router.put('/:id', controller.update);

// 명령 취소
router.delete('/:id', controller.remove);

export default router;
