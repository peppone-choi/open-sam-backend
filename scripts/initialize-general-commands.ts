/**
 * 기존 장수들의 명령을 14턴까지 휴식으로 초기화하는 스크립트
 * 
 * 사용법:
 *   pnpm run ts-node scripts/initialize-general-commands.ts [session_id]
 * 
 * 예시:
 *   pnpm run ts-node scripts/initialize-general-commands.ts sangokushi_default
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GeneralTurn } from '../src/models/general_turn.model';
import { General } from '../src/models/general.model';

dotenv.config();

const MAX_TURN = 30;
const FLIPPED_MAX_TURN = 14;

async function initializeGeneralCommands(sessionId: string = 'sangokushi_default') {
  console.log('='.repeat(60));
  console.log('장수 명령 초기화 스크립트 시작');
  console.log(`세션: ${sessionId}`);
  console.log('='.repeat(60));

  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';
    await mongoose.connect(mongoUri);
    console.log('✓ 데이터베이스 연결 완료\n');

    // 모든 장수 조회
    const generals = await (General as any).find({
      session_id: sessionId
    }).select('no');

    console.log(`총 ${generals.length}개의 장수 발견\n`);

    let totalInitialized = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const general of generals) {
      const generalId = general.no;
      if (!generalId) {
        console.warn(`⚠ 장수 ID가 없습니다: ${general._id}`);
        totalErrors++;
        continue;
      }

      try {
        // 현재 명령이 있는지 확인
        const existingTurns = await (GeneralTurn as any).find({
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $gte: 0, $lt: FLIPPED_MAX_TURN }
        });

        // 기존 턴 인덱스 추출
        const existingTurnIndices = new Set<number>(
          existingTurns.map((t: any) => {
            const turnIdx = t.data?.turn_idx;
            return turnIdx !== undefined && turnIdx !== null ? turnIdx : null;
          }).filter((idx: any): idx is number => idx !== null && typeof idx === 'number')
        );

        // 빈 턴 찾기 (0~13턴 중 없는 것)
        const emptyTurns: number[] = [];
        for (let turnIdx = 0; turnIdx < FLIPPED_MAX_TURN; turnIdx++) {
          if (!existingTurnIndices.has(turnIdx)) {
            emptyTurns.push(turnIdx);
          }
        }
        
        // 디버그: 첫 번째 장수만 로그 출력
        if (totalInitialized + totalSkipped === 0) {
          console.log(`  장수 ${generalId} 디버그:`);
          console.log(`    - 기존 턴: ${Array.from(existingTurnIndices).sort((a, b) => a - b).join(', ')}`);
          console.log(`    - 빈 턴: ${emptyTurns.join(', ')}`);
        }

        // 빈 턴이 있으면 채우기
        if (emptyTurns.length > 0) {
          const bulkOps = emptyTurns.map((turnIdx) => ({
            updateOne: {
              filter: {
                session_id: sessionId,
                'data.general_id': generalId,
                'data.turn_idx': turnIdx
              },
              update: {
                $set: {
                  session_id: sessionId,
                  'data.general_id': generalId,
                  'data.turn_idx': turnIdx,
                  'data.action': '휴식',
                  'data.brief': '휴식',
                  'data.arg': {}
                }
              },
              upsert: true
            }
          }));

          try {
            if (totalInitialized + totalSkipped === 0) {
              console.log(`    - ${bulkOps.length}개 턴을 채우는 중...`);
            }
            const result = await (GeneralTurn as any).bulkWrite(bulkOps, { ordered: false });
            if (totalInitialized + totalSkipped === 0) {
              console.log(`    - 업데이트 결과: ${result.modifiedCount}개 수정, ${result.upsertedCount}개 생성`);
            }
            totalInitialized++;
            if (totalInitialized % 100 === 0) {
              console.log(`  진행 중: ${totalInitialized}개 장수 초기화 완료...`);
            }
          } catch (error: any) {
            // 중복 키 오류는 무시 (이미 명령이 있는 경우)
            if (error.code === 11000) {
              if (totalInitialized + totalSkipped === 0) {
                console.log(`    - 중복 키 오류 (이미 존재하는 명령): 무시`);
              }
              totalSkipped++;
            } else {
              if (totalInitialized + totalSkipped === 0) {
                console.error(`    - 오류 발생:`, error.message);
              }
              throw error;
            }
          }
        } else {
          // 이미 모든 턴이 채워져 있음
          totalSkipped++;
        }
      } catch (error: any) {
        console.error(`✗ 장수 ${generalId} 초기화 실패:`, error.message);
        totalErrors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('초기화 완료');
    console.log(`✓ 초기화된 장수: ${totalInitialized}개`);
    console.log(`⊘ 건너뛴 장수: ${totalSkipped}개 (이미 명령이 있음)`);
    console.log(`✗ 오류 발생: ${totalErrors}개`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
const sessionId = process.argv[2] || 'sangokushi_default';
initializeGeneralCommands(sessionId);

