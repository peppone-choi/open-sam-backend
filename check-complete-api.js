const fs = require('fs');
const path = require('path');

// 백엔드 라우트 정보
const routesDir = path.join(__dirname, 'src/routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') && !f.startsWith('index'));

// 프론트엔드 API 클라이언트 읽기
const frontendApiFile = path.join(__dirname, '../open-sam-front/src/lib/api/apiClient.ts');
const frontendApiContent = fs.readFileSync(frontendApiFile, 'utf8');

// 프론트엔드 타입 파일 읽기
const frontendTypesFile = path.join(__dirname, '../open-sam-front/src/types/api.ts');
const frontendTypesContent = fs.existsSync(frontendTypesFile) 
  ? fs.readFileSync(frontendTypesFile, 'utf8')
  : '';

// 라우트 prefix 매핑 (파일명 -> URL prefix)
const routePrefixMap = {
  'general.routes.ts': '/api/general',
  'global.routes.ts': '/api/global',
  'game.routes.ts': '/api/game',
  'command.routes.ts': '/api/command',
  'nation.routes.ts': '/api/nation',
  'nationcommand.routes.ts': '/api/nationcommand',
  'message.routes.ts': '/api/message',
  'betting.routes.ts': '/api/betting',
  'auction.routes.ts': '/api/auction',
  'troop.routes.ts': '/api/troop',
  'vote.routes.ts': '/api/vote',
  'inheritance.routes.ts': '/api/inheritance',
  'inheritaction.routes.ts': '/api/inheritaction',
  'auth.routes.ts': '/api/auth',
  'battle.routes.ts': '/api/battle',
  'misc.routes.ts': '/api/misc'
};

// 백엔드 라우트 추출
const backendRoutes = new Map();

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const prefix = routePrefixMap[file] || '';
  
  // router.get, router.post 등 패턴 찾기
  const routeMatches = content.matchAll(/router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
  
  for (const match of routeMatches) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const fullPath = prefix + routePath;
    
    // 서비스 호출 찾기
    const routeHandlerStart = content.indexOf(`router.${match[1]}('${routePath}')`) || 
                             content.indexOf(`router.${match[1]}("${routePath}")`);
    let serviceName = 'Unknown';
    
    if (routeHandlerStart !== -1) {
      const handlerContent = content.substring(routeHandlerStart, routeHandlerStart + 1000);
      const serviceMatch = handlerContent.match(/await\s+(\w+Service)\.execute/);
      if (serviceMatch) {
        serviceName = serviceMatch[1];
      }
    }
    
    backendRoutes.set(`${method} ${fullPath}`, {
      method,
      path: routePath,
      fullPath,
      service: serviceName,
      file
    });
  }
});

// 프론트엔드 API 매핑 추출
const frontendApiMap = new Map();
const apiLines = frontendApiContent.match(/PhpToRest: Record<string, RouteDef> = ({[\s\S]*?}) as const/);
if (apiLines) {
  const phpToRestStr = apiLines[1];
  const apiEntries = phpToRestStr.matchAll(/(['"])([^'"]+)\1:\s*\{[^}]*method:\s*['"]([^'"]+)['"][^}]*path:\s*['"]([^'"]+)['"]/g);
  
  for (const match of apiEntries) {
    const apiKey = match[2];
    const method = match[3].toUpperCase();
    const path = match[4];
    
    frontendApiMap.set(apiKey, { method, path });
  }
}

console.log('=== 백엔드 라우트 (총 ' + backendRoutes.size + '개) ===\n');

const backendList = Array.from(backendRoutes.values())
  .sort((a, b) => a.fullPath.localeCompare(b.fullPath));

backendList.slice(0, 30).forEach(route => {
  console.log(`${route.method.padEnd(6)} ${route.fullPath.padEnd(50)} -> ${route.service}`);
});

if (backendList.length > 30) {
  console.log(`... 외 ${backendList.length - 30}개\n`);
}

console.log('\n=== 프론트엔드 API (총 ' + frontendApiMap.size + '개) ===\n');

const frontendList = Array.from(frontendApiMap.entries())
  .sort((a, b) => a[0].localeCompare(b[0]));

frontendList.slice(0, 30).forEach(([key, value]) => {
  console.log(`${key.padEnd(40)} ${value.method.padEnd(6)} ${value.path}`);
});

if (frontendList.length > 30) {
  console.log(`... 외 ${frontendList.length - 30}개\n`);
}

// 매칭 검증
console.log('\n=== 매칭 검증 ===\n');

const matched = [];
const missingBackend = [];
const missingFrontend = [];
const methodMismatches = [];

// 프론트엔드 -> 백엔드 검증
for (const [apiKey, frontendApi] of frontendApiMap.entries()) {
  const backendRoute = backendRoutes.get(`${frontendApi.method} ${frontendApi.path}`);
  
  if (backendRoute) {
    matched.push({ apiKey, frontend: frontendApi, backend: backendRoute });
  } else {
    // 경로 일부 매칭 시도
    const normalizedPath = frontendApi.path.replace(/^\/api\//, '');
    let found = false;
    
    for (const [backendKey, backendRoute] of backendRoutes.entries()) {
      if (backendRoute.fullPath === frontendApi.path) {
        if (backendRoute.method === frontendApi.method) {
          matched.push({ apiKey, frontend: frontendApi, backend: backendRoute });
          found = true;
          break;
        } else {
          methodMismatches.push({ apiKey, frontend: frontendApi, backend: backendRoute });
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      missingBackend.push({ apiKey, frontend: frontendApi });
    }
  }
}

// 백엔드 -> 프론트엔드 검증
for (const [backendKey, backendRoute] of backendRoutes.entries()) {
  let found = false;
  for (const [apiKey, frontendApi] of frontendApiMap.entries()) {
    if (backendRoute.fullPath === frontendApi.path && backendRoute.method === frontendApi.method) {
      found = true;
      break;
    }
  }
  
  if (!found && !backendRoute.fullPath.includes('/legacy/') && 
      !backendRoute.fullPath.includes('/admin/') &&
      !backendRoute.fullPath.includes('/battlemap/')) {
    missingFrontend.push(backendRoute);
  }
}

console.log(`✅ 매칭 성공: ${matched.length}개`);
console.log(`⚠️  백엔드 누락: ${missingBackend.length}개`);
console.log(`⚠️  프론트엔드 누락: ${missingFrontend.length}개`);
console.log(`⚠️  메서드 불일치: ${methodMismatches.length}개\n`);

if (missingBackend.length > 0) {
  console.log('백엔드에 없는 프론트엔드 API:');
  missingBackend.slice(0, 20).forEach(m => {
    console.log(`  ${m.apiKey}: ${m.frontend.method} ${m.frontend.path}`);
  });
  if (missingBackend.length > 20) {
    console.log(`  ... 외 ${missingBackend.length - 20}개`);
  }
  console.log('');
}

if (missingFrontend.length > 0) {
  console.log('프론트엔드에 없는 백엔드 라우트:');
  missingFrontend.slice(0, 20).forEach(route => {
    console.log(`  ${route.method} ${route.fullPath} (${route.file})`);
  });
  if (missingFrontend.length > 20) {
    console.log(`  ... 외 ${missingFrontend.length - 20}개`);
  }
  console.log('');
}

if (methodMismatches.length > 0) {
  console.log('메서드 불일치:');
  methodMismatches.forEach(m => {
    console.log(`  ${m.apiKey}: 프론트(${m.frontend.method}) vs 백엔드(${m.backend.method})`);
  });
  console.log('');
}

// 최종 요약
console.log('=== 최종 요약 ===');
console.log(`백엔드 라우트: ${backendRoutes.size}개`);
console.log(`프론트엔드 API: ${frontendApiMap.size}개`);
console.log(`매칭 성공: ${matched.length}개 (${((matched.length / frontendApiMap.size) * 100).toFixed(1)}%)`);
console.log(`매칭 실패: ${missingBackend.length}개 (${((missingBackend.length / frontendApiMap.size) * 100).toFixed(1)}%)`);
console.log(`백엔드 전용: ${missingFrontend.length}개`);






