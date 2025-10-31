/**
 * GeneralCommand - PHP sammo\Command\GeneralCommand 직접 변환
 * 
 * 장수 커맨드의 기본 클래스
 */

import { BaseCommand } from './BaseCommand';
import { DB } from '../../config/db';

export abstract class GeneralCommand extends BaseCommand {
  
  public getNextExecuteKey(): string {
    const constructor = this.constructor as typeof BaseCommand;
    const turnKey = constructor.getName();
    const generalID = this.getGeneral().getID();
    const executeKey = `next_execute_${generalID}_${turnKey}`;
    return executeKey;
  }

  public async getNextAvailableTurn(): Promise<number | null> {
    const constructor = this.constructor as typeof BaseCommand;
    if (this.isArgValid && !this.getPostReqTurn()) {
      return null;
    }
    
    const db = DB.db();
    // TODO: Implement KVStorage
    // const lastExecuteStor = KVStorage.getStorage(db, 'next_execute');
    // return lastExecuteStor.getValue(this.getNextExecuteKey());
    return null;
  }

  public async setNextAvailable(yearMonth: number | null = null): Promise<void> {
    if (!this.getPostReqTurn()) {
      return;
    }
    
    if (yearMonth === null) {
      yearMonth = this.joinYearMonth(this.env.year, this.env.month) 
        + this.getPostReqTurn() - this.getPreReqTurn();
    }
    
    const db = DB.db();
    // TODO: Implement KVStorage
    // const lastExecuteStor = KVStorage.getStorage(db, 'next_execute');
    // lastExecuteStor.setValue(this.getNextExecuteKey(), yearMonth);
  }
}
