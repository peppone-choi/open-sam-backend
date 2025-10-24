import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { mongoConnection } from './infrastructure/db/connection';
import generalRouter from './general/router/general.router';
import cityRouter from './city/router/city.router';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/generals', generalRouter);
app.use('/api/cities', cityRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    // TODO: MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);
    
    app.listen(PORT, () => {
      console.log(`✅ API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
