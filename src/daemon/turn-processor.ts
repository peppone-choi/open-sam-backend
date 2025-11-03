import * as cron from 'node-cron';
import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { Session } from '../models/session.model';
import { connectDB } from '../config/db';

const CRON_EXPRESSION = '* * * * *';

async function processTurns() {
  try {
    const sessions = await (Session as any).find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        const result = await ExecuteEngineService.execute({ session_id: sessionId });
        
        if (result.updated) {
          console.log(`[${new Date().toISOString()}] Session ${sessionId}: Turn processed, next turntime=${result.turntime}`);
        } else if (result.locked) {
          console.log(`[${new Date().toISOString()}] Session ${sessionId}: Locked (another instance processing)`);
        }
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Session ${sessionId}: Error -`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[Turn Processor] Fatal error:', error);
  }
}

export async function startTurnProcessor() {
  await connectDB();
  
  console.log(`[Turn Processor] Starting with schedule: ${CRON_EXPRESSION}`);
  
  cron.schedule(CRON_EXPRESSION, () => {
    processTurns().catch(err => {
      console.error('[Turn Processor] Unexpected error in cron job:', err);
    });
  });
  
  console.log('[Turn Processor] Daemon started successfully');
}

if (require.main === module) {
  startTurnProcessor().catch(err => {
    console.error('[Turn Processor] Failed to start:', err);
    process.exit(1);
  });
}
