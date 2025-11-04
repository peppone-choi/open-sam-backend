/**
 * Jest 테스트 설정 파일
 * 테스트 전/후 실행할 공통 설정
 */

// MongoDB 연결 모킹 또는 테스트 DB 설정
// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/sangokushi_test';

// 테스트 전후 처리
beforeAll(async () => {
  // 테스트 전 초기화 작업
});

afterAll(async () => {
  // 테스트 후 정리 작업
});

// 각 테스트 후 정리
afterEach(async () => {
  // 각 테스트 후 정리 작업
});


