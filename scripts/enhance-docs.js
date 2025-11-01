#!/usr/bin/env node

/**
 * OpenSAM Backend - 포괄적인 문서 생성 스크립트
 * 
 * 모든 route 파일에 상세한 JSDoc과 Swagger 문서를 추가합니다.
 * 
 * 사용법: node scripts/enhance-docs.js
 */

const fs = require('fs');
const path = require('path');

// 라우트별 상세 설명
const routeDescriptions = {
  // Auth
  '/api/auth/register': {
    description: '새로운 사용자 계정을 생성합니다',
    details: '사용자명과 비밀번호를 받아 bcrypt로 해시화하여 저장합니다. JWT 토큰을 발급하지 않으므로 로그인을 별도로 해야 합니다.'
  },
  '/api/auth/login': {
    description: '사용자 인증 후 JWT 토큰을 발급합니다',
    details: '발급된 토큰은 7일간 유효하며, Authorization: Bearer {token} 헤더로 사용합니다.'
  },
  '/api/auth/me': {
    description: '현재 인증된 사용자의 정보를 조회합니다',
    details: 'JWT 토큰이 필요합니다. 사용자 프로필, 보유 장수, 국가 정보 등을 반환합니다.'
  },
  
  // Session
  '/api/session/templates': {
    description: '사용 가능한 게임 세션 템플릿 목록을 조회합니다',
    details: '삼국지 정사, 연의, 커스텀 시나리오 등 다양한 템플릿을 제공합니다.'
  },
  '/api/session/list': {
    description: '모든 게임 세션 목록을 조회합니다',
    details: '진행 중, 대기 중, 종료된 세션을 포함합니다. 페이지네이션을 지원합니다.'
  },
  '/api/session/create': {
    description: '새로운 게임 세션을 생성합니다',
    details: '템플릿을 선택하고 세션 설정(턴 시간, 최대 인원 등)을 지정하여 생성합니다.'
  },
  
  // General
  '/api/general/build-nation-candidate': {
    description: '장수가 국가 설립 후보자로 등록합니다',
    details: '재야 장수가 자신의 국가를 설립하기 위한 절차입니다. 일정 조건(통솔력, 병력 등)을 만족해야 합니다.'
  },
  '/api/general/die-on-prestart': {
    description: '게임 시작 전 장수가 사망 처리됩니다',
    details: '시나리오 시작 시점 이전에 이미 사망한 장수를 설정합니다.'
  },
  '/api/general/drop-item': {
    description: '장수가 보유한 아이템을 버립니다',
    details: '무기, 방어구, 서적 등을 버릴 수 있습니다. 버린 아이템은 도시에 남겨집니다.'
  },
  
  // Nation
  '/api/nation/create': {
    description: '새로운 국가를 설립합니다',
    details: '군주, 국가명, 수도, 국가 색상 등을 설정합니다.'
  },
  '/api/nation/list': {
    description: '모든 국가 목록을 조회합니다',
    details: '세력, 인구, 병력, 외교 관계 등의 정보를 포함합니다.'
  },
  
  // Command
  '/api/command/submit': {
    description: '장수 명령을 제출합니다',
    details: '내정, 군사, 외교, 인사 등 다양한 명령을 제출할 수 있습니다. 명령은 턴 처리 시 실행됩니다.'
  },
  '/api/command/list': {
    description: '제출된 명령 목록을 조회합니다',
    details: '대기 중, 실행 중, 완료된 명령을 확인할 수 있습니다.'
  },
  '/api/command/cancel': {
    description: '제출한 명령을 취소합니다',
    details: '아직 실행되지 않은 명령만 취소 가능합니다.'
  },
  
  // Battle
  '/api/battle/start': {
    description: '전투를 시작합니다',
    details: '공격군과 수비군의 병력, 장수, 전술을 설정하고 전투를 개시합니다.'
  },
  '/api/battle/list': {
    description: '진행 중인 전투 목록을 조회합니다',
    details: '공성전, 야전, 수전 등 다양한 전투 유형을 확인할 수 있습니다.'
  },
  
  // Auction
  '/api/auction/create': {
    description: '경매를 생성합니다',
    details: '아이템, 병력, 장수 등을 경매에 등록할 수 있습니다.'
  },
  '/api/auction/bid': {
    description: '경매에 입찰합니다',
    details: '현재 최고가보다 높은 금액으로만 입찰 가능합니다.'
  },
  
  // Message
  '/api/message/send': {
    description: '메시지를 전송합니다',
    details: '장수 간 1:1 메시지, 국가 공지, 전체 공지 등을 보낼 수 있습니다.'
  },
  '/api/message/inbox': {
    description: '받은 메시지함을 조회합니다',
    details: '읽음/안읽음 상태, 발신자, 시간 순으로 정렬됩니다.'
  }
};

// HTTP 메서드별 설명
const methodDescriptions = {
  'get': { action: '조회', verb: 'retrieve' },
  'post': { action: '생성', verb: 'create' },
  'put': { action: '전체 수정', verb: 'update' },
  'patch': { action: '부분 수정', verb: 'modify' },
  'delete': { action: '삭제', verb: 'delete' }
};

/**
 * 상세한 Swagger 문서 생성
 */
function generateDetailedSwagger(method, routePath, tag, routeInfo) {
  const methodInfo = methodDescriptions[method];
  const pathInfo = routeDescriptions[routePath] || {};
  
  const description = pathInfo.description || `${tag} ${methodInfo.action}`;
  const details = pathInfo.details || '';
  
  let swagger = `/**
 * @swagger
 * ${routePath}:
 *   ${method}:
 *     summary: ${description}
 *     description: |
 *       ${details || description}
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [${tag}]`;

  // 인증이 필요한 경로 판단
  const requiresAuth = !routePath.includes('/auth/') || routePath.includes('/me');
  
  if (requiresAuth && method !== 'get') {
    swagger += `
 *     security:
 *       - bearerAuth: []`;
  }

  // 파라미터 (경로 파라미터)
  const pathParams = routePath.match(/:(\w+)/g);
  if (pathParams) {
    swagger += `
 *     parameters:`;
    pathParams.forEach(param => {
      const paramName = param.substring(1);
      swagger += `
 *       - in: path
 *         name: ${paramName}
 *         required: true
 *         schema:
 *           type: string
 *         description: ${paramName} 식별자`;
    });
  }

  // Request Body (POST, PUT, PATCH)
  if (['post', 'put', 'patch'].includes(method)) {
    swagger += `
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요`;
  }

  // Responses
  swagger += `
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}`;

  if (requiresAuth) {
    swagger += `
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token`;
  }

  swagger += `
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */`;

  return swagger;
}

/**
 * 라우트 파일의 기존 Swagger를 상세 버전으로 교체
 */
function enhanceRouteFile(filePath, baseName, tag) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 기존의 간단한 Swagger 주석 찾기
  const simpleSwaggerPattern = /\/\*\*\n \* @swagger\n \* (\/api\/[^\n]+):\n \*   (\w+):\n \*     summary: ([^\n]+)\n \*     tags: \[[^\]]+\]\n \*     responses:\n \*       200:\n \*         description: 성공\n[\s\S]*?\*\//g;
  
  let match;
  const replacements = [];
  
  while ((match = simpleSwaggerPattern.exec(content)) !== null) {
    const routePath = match[1];
    const method = match[2];
    const oldSwagger = match[0];
    
    const newSwagger = generateDetailedSwagger(method, routePath, tag);
    
    replacements.push({
      old: oldSwagger,
      new: newSwagger
    });
  }
  
  // 역순으로 교체 (인덱스 꼬임 방지)
  replacements.reverse().forEach(r => {
    content = content.replace(r.old, r.new);
  });
  
  if (replacements.length > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}: ${replacements.length}개 엔드포인트 문서 향상`);
  } else {
    console.log(`⏭️  ${path.basename(filePath)}: 교체할 내용 없음`);
  }
}

// 태그 매핑
const tagMapping = {
  'auth': 'Auth',
  'general': 'General',
  'nation': 'Nation',
  'command': 'Command',
  'game': 'Game',
  'global': 'Global',
  'session': 'Session',
  'troop': 'Troop',
  'battle': 'Battle',
  'battlemap-editor': 'Battlemap',
  'auction': 'Auction',
  'betting': 'Betting',
  'message': 'Message',
  'vote': 'Vote',
  'inheritance': 'Inheritance',
  'inheritaction': 'Inheritaction',
  'nationcommand': 'NationCommand',
  'misc': 'Misc'
};

// 실행
const routesDir = path.join(__dirname, '../src/routes');
const files = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.routes.ts'));

console.log(`\n🚀 ${files.length}개 라우트 파일의 문서를 향상시킵니다...\n`);

files.forEach(file => {
  const baseName = file.replace('.routes.ts', '');
  const tag = tagMapping[baseName] || baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const filePath = path.join(routesDir, file);
  
  enhanceRouteFile(filePath, baseName, tag);
});

console.log(`\n✅ 완료! 모든 엔드포인트에 상세한 문서가 추가되었습니다.\n`);
