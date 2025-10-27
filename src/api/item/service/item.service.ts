import { ItemRepository } from '../repository/item.repository';

export class ItemService {
  constructor(private repository: ItemRepository) {}
  
  // TODO: 아이템 시스템 구현
  // - getByOwnerId: 소유자의 아이템 조회
  // - equipItem: 아이템 장착 (Command 발행)
  // - unequipItem: 아이템 해제
  // - transferItem: 아이템 이전
}
