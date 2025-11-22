import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import gin7Routes from '../src/routes/gin7';
import { autoExtractToken } from '../src/middleware/auth';
import { mongoConnection } from '../src/db/connection';

const SESSION_ID = process.env.GIN7_SESSION_ID || 'gin7-session-01';
const CHARACTER_ID = process.env.GIN7_CHARACTER_ID || 'gin7-char-01';
const JWT_SECRET = process.env.JWT_SECRET || 'qa-demo-secret';

async function bootstrapApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(autoExtractToken);
  app.use('/api/gin7', gin7Routes);
  return app;
}

async function main() {
  process.env.JWT_SECRET = JWT_SECRET;
  await mongoConnection.connect();
  const app = await bootstrapApp();
  const token = jwt.sign({ userId: 'qa-user', sessionId: SESSION_ID }, JWT_SECRET);

  const authHeader = { Authorization: `Bearer ${token}` };

  const sessionRes = await request(app)
    .get('/api/gin7/session')
    .set(authHeader)
    .query({ sessionId: SESSION_ID, characterId: CHARACTER_ID });
  console.log('[auth] /session ->', sessionRes.status, sessionRes.body?.data?.profile?.name);

  const strategyRes = await request(app)
    .get('/api/gin7/strategy')
    .query({ sessionId: SESSION_ID, characterId: CHARACTER_ID });
  console.log('[qa] /strategy ->', strategyRes.status, strategyRes.body?.data?.fleets?.length);

  const plansRes = await request(app)
    .get('/api/gin7/operations')
    .query({ sessionId: SESSION_ID, characterId: CHARACTER_ID });
  console.log('[qa] /operations ->', plansRes.status, plansRes.body?.data?.length);

  const planPostRes = await request(app)
    .post('/api/gin7/operations')
    .set(authHeader)
    .send({ sessionId: SESSION_ID, characterId: CHARACTER_ID, objective: 'occupy', target: 'QA Bridgehead' });
  console.log('[auth] POST /operations ->', planPostRes.status, planPostRes.body?.data?.id);

  const tacticalRes = await request(app)
    .get('/api/gin7/tactical')
    .query({ sessionId: SESSION_ID, characterId: CHARACTER_ID });
  console.log('[qa] /tactical ->', tacticalRes.status, tacticalRes.body?.data?.units?.length);

  const energyRes = await request(app)
    .post('/api/gin7/tactical/energy')
    .set(authHeader)
    .send({ sessionId: SESSION_ID, characterId: CHARACTER_ID, energy: { beam: 34, gun: 20, shield: 18, engine: 15, warp: 7, sensor: 6 } });
  console.log('[auth] /tactical/energy ->', energyRes.status, energyRes.body?.data);

  const chatRes = await request(app)
    .get('/api/gin7/chat')
    .query({ sessionId: SESSION_ID });
  console.log('[qa] /chat ->', chatRes.status, Array.isArray(chatRes.body?.data));

  const telemetryRes = await request(app)
    .post('/api/gin7/telemetry')
    .send({ sessionId: SESSION_ID, scene: 'strategy', avgFps: 57.1, cpuPct: 61.2, memoryMb: 18.4, sampleCount: 200, durationMs: 5000 });
  console.log('[qa] POST /telemetry ->', telemetryRes.status, telemetryRes.body);

  const telemetryList = await request(app)
    .get('/api/gin7/telemetry')
    .query({ sessionId: SESSION_ID });
  console.log('[qa] GET /telemetry ->', telemetryList.status, telemetryList.body?.data?.length);

  await mongoConnection.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
