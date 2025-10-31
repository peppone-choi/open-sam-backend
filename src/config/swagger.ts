import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '삼국지 게임 API',
      version: '1.0.0',
      description: '완전 동적 턴제/리얼타임 게임 시스템',
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: '개발 서버',
      },
    ],
    components: {
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
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
