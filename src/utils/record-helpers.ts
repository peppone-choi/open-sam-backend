// @ts-nocheck - Type issues need investigation
import { GeneralRecord } from '../models/general_record.model';

/**
 * 다음 GeneralRecord ID 생성
 * 원본 SQL의 AUTO_INCREMENT를 모방
 */
export async function getNextRecordId(sessionId: string): Promise<number> {
  const lastRecord = await GeneralRecord.findOne({ session_id: sessionId })
    .sort({ 'data.id': -1 })
    .select('data.id')
    .lean();
  
  return (lastRecord?.data?.id || 0) + 1;
}





