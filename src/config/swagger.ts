import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OpenSAM API - 삼국지 게임',
      version: '1.0.0',
      description: `
# OpenSAM Backend API

완전 동적 턴제/리얼타임 삼국지 게임 시스템

## 주요 기능
- 🎮 동적 턴제 게임 시스템
- 👤 장수 및 국가 관리
- ⚔️ 전투 시스템
- 💰 경매 및 베팅
- 💬 메시지 및 투표 시스템

## 기술 스택
- Express.js + TypeScript
- MongoDB (Mongoose 8.19.2)
- Redis (Cache & Real-time)
- Socket.IO (WebSocket)
      `,
      contact: {
        name: 'OpenSAM Development Team',
        url: 'https://github.com/your-repo/open-sam'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: '로컬 개발 서버',
      },
      {
        url: 'http://localhost:8080',
        description: 'Docker 개발 서버',
      }
    ],
    tags: [
      {
        name: 'Health',
        description: '서버 상태 확인'
      },
      {
        name: 'Session',
        description: '게임 세션 관리'
      },
      {
        name: 'General',
        description: '장수 관리'
      },
      {
        name: 'Nation',
        description: '국가 관리'
      },
      {
        name: 'Command',
        description: '명령 시스템'
      },
      {
        name: 'Battle',
        description: '전투 시스템'
      },
      {
        name: 'City',
        description: '도시 관리'
      },
      {
        name: 'Auction',
        description: '경매 시스템'
      },
      {
        name: 'Betting',
        description: '베팅 시스템'
      },
      {
        name: 'Message',
        description: '메시지 시스템'
      },
      {
        name: 'Vote',
        description: '투표 시스템'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 토큰을 입력하세요 (Bearer 접두사 불필요)'
        }
      },
      schemas: {
        General: {
          type: 'object',
          properties: {
            no: { type: 'integer' },
            session_id: { type: 'string' },
            owner: { type: 'string' },
            name: { type: 'string' },
            data: {
              type: 'object',
              description: '완전 동적 데이터 (세션 설정에 따라 구조가 다름!)',
              additionalProperties: true
            }
          }
        },
        City: {
          type: 'object',
          properties: {
            city: { type: 'integer' },
            session_id: { type: 'string' },
            name: { type: 'string' },
            data: {
              type: 'object',
              description: '완전 동적 데이터',
              additionalProperties: true
            }
          }
        },
        Command: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            general_id: { type: 'integer' },
            action: { type: 'string' },
            arg: { type: 'object' },
            status: { type: 'string', enum: ['pending', 'executing', 'completed', 'failed'] },
            completion_time: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: [
    './src/routes/*.ts',
    './src/server.ts',
    './src/api/**/*.ts'
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
