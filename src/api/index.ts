import websocketRouter from './websocket/websocket.router';

export const mountRoutes = (app: any) => {
  // WebSocket API
  app.use('/api/websocket', websocketRouter);
};
