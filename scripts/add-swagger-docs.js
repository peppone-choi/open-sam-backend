#!/usr/bin/env node

/**
 * 자동으로 route 파일에 기본 Swagger 문서를 추가하는 스크립트
 * 
 * 사용법: node scripts/add-swagger-docs.js
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

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

// HTTP 메서드별 설명
const methodDescriptions = {
  'get': '조회',
  'post': '생성',
  'put': '전체 수정',
  'patch': '부분 수정',
  'delete': '삭제'
};

function generateSwaggerDoc(method, path, tag, description) {
  const methodUpper = method.toUpperCase();
  const methodDesc = methodDescriptions[method] || '실행';
  
  return `/**
 * @swagger
 * ${path}:
 *   ${method}:
 *     summary: ${description || `${tag} ${methodDesc}`}
 *     tags: [${tag}]
 *     responses:
 *       200:
 *         description: 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 에러
 */`;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.ts');
  const baseName = fileName.replace('.routes', '');
  const tag = tagMapping[baseName] || baseName.charAt(0).toUpperCase() + baseName.slice(1);
  
  // 이미 @swagger가 있는지 확인
  if (content.includes('@swagger')) {
    console.log(`⏭️  ${fileName} - Already has Swagger docs, skipping`);
    return;
  }
  
  // router.method 패턴 찾기
  const routePattern = /router\.(get|post|put|patch|delete)\('([^']+)',/g;
  let match;
  const routes = [];
  
  while ((match = routePattern.exec(content)) !== null) {
    routes.push({
      method: match[1],
      path: match[2],
      index: match.index
    });
  }
  
  if (routes.length === 0) {
    console.log(`⏭️  ${fileName} - No routes found, skipping`);
    return;
  }
  
  console.log(`📝 ${fileName} - Found ${routes.length} routes`);
  
  // 뒤에서부터 추가 (인덱스가 안 깨지게)
  let newContent = content;
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i];
    const apiPath = `/api/${baseName}${route.path}`;
    const swagger = generateSwaggerDoc(route.method, apiPath, tag, null);
    
    // router.method 앞에 swagger 주석 추가
    newContent = newContent.slice(0, route.index) + swagger + '\n' + newContent.slice(route.index);
  }
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`✅ ${fileName} - Added ${routes.length} Swagger docs`);
}

// 모든 route 파일 처리
const files = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.routes.ts'))
  .map(f => path.join(routesDir, f));

console.log(`\n🚀 Processing ${files.length} route files...\n`);

files.forEach(processFile);

console.log(`\n✅ Done! Please review the changes and customize as needed.\n`);
