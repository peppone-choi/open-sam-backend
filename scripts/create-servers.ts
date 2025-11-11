import mongoose from 'mongoose';
import { AdminServerManagementService } from '../src/services/admin/AdminServerManagement.service';

/**
 * 7개 서버 생성 스크립트
 * 
 * 서버 구성:
 * 1. sangokushi_default - OpenSAM (기본 서버, 이미 존재)
 * 2. server_184 - 삼국지 184년 황건적의 난
 * 3. server_190 - 삼국지 190년 반동탁연합
 * 4. server_200 - 삼국지 200년 관도대전
 * 5. server_208 - 삼국지 208년 적벽대전
 * 6. server_219 - 삼국지 219년 삼국정립
 * 7. server_unite - 천하통일 서버
 * 8. server_test - 테스트 서버
 */

const servers = [
  {
    sessionId: 'server_184',
    name: '삼국지 184년 황건적의 난',
    scenario: '황건적의 난',
    startyear: 184,
    turnterm: 30,
    maxgeneral: 500,
    maxnation: 20,
  },
  {
    sessionId: 'server_190',
    name: '삼국지 190년 반동탁연합',
    scenario: '반동탁연합',
    startyear: 190,
    turnterm: 45,
    maxgeneral: 400,
    maxnation: 16,
  },
  {
    sessionId: 'server_200',
    name: '삼국지 200년 관도대전',
    scenario: '관도대전',
    startyear: 200,
    turnterm: 60,
    maxgeneral: 350,
    maxnation: 12,
  },
  {
    sessionId: 'server_208',
    name: '삼국지 208년 적벽대전',
    scenario: '적벽대전',
    startyear: 208,
    turnterm: 60,
    maxgeneral: 300,
    maxnation: 12,
  },
  {
    sessionId: 'server_219',
    name: '삼국지 219년 삼국정립',
    scenario: '삼국정립',
    startyear: 219,
    turnterm: 90,
    maxgeneral: 250,
    maxnation: 8,
  },
  {
    sessionId: 'server_unite',
    name: '천하통일 서버',
    scenario: '천하통일',
    startyear: 220,
    turnterm: 120,
    maxgeneral: 200,
    maxnation: 6,
  },
  {
    sessionId: 'server_test',
    name: '테스트 서버',
    scenario: '테스트',
    startyear: 220,
    turnterm: 10,
    maxgeneral: 100,
    maxnation: 6,
  },
];

async function createServers() {
  try {
    require('dotenv').config();
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/sangokushi';
    console.log('🔌 MongoDB 연결 중:', mongoUrl);
    console.log('ENV:', {
      MONGODB_URI: process.env.MONGODB_URI,
      MONGODB_URL: process.env.MONGODB_URL
    });
    await mongoose.connect(mongoUrl);
    console.log('✅ MongoDB 연결 성공');
    
    console.log('🚀 서버 생성 시작...\n');
    
    for (const serverConfig of servers) {
      console.log(`📦 서버 생성 중: ${serverConfig.name} (${serverConfig.sessionId})`);
      
      const result = await AdminServerManagementService.createServer(serverConfig);
      
      if (result.success) {
        console.log(`   ✅ ${result.message}`);
      } else {
        console.log(`   ⚠️  ${result.message}`);
      }
      console.log('');
    }
    
    console.log('🎉 서버 생성 완료!');
    console.log(`📊 총 ${servers.length}개의 서버가 생성되었습니다\n`);
    
    // 서버 목록 출력
    console.log('📋 생성된 서버 목록:');
    const serverList = await AdminServerManagementService.getServerList();
    if (serverList.success) {
      serverList.servers.forEach((server: any) => {
        console.log(`   - ${server.name} (${server.sessionId}): ${server.statusText}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB 연결 종료');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createServers();
