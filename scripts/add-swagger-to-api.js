#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const routerFiles = [
  'src/api/game-session/router/game-session.router.ts',
  'src/api/unified/router/entity-unified.router.ts'
];

function addSwaggerToFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.ts');
  
  console.log(`Processing ${filePath}...`);
  
  // router.get/post/put/delete 패턴 찾기
  const patterns = [
    { regex: /router\.get\('\/'/g, tag: 'GameSession', method: 'get' },
    { regex: /router\.post\('\/'/g, tag: 'GameSession', method: 'post' },
    { regex: /router\.get\('\/status/g, tag: 'GameSession', method: 'get' },
    { regex: /router\.get\('\/scenario/g, tag: 'GameSession', method: 'get' },
    { regex: /router\.get\('\/:id'/g, tag: 'GameSession', method: 'get' },
    { regex: /router\.put\('\/:id'/g, tag: 'GameSession', method: 'put' },
    { regex: /router\.patch\('\/:id'/g, tag: 'GameSession', method: 'patch' },
    { regex: /router\.delete\('\/:id'/g, tag: 'GameSession', method: 'delete' }
  ];
  
  if (content.includes('@swagger')) {
    console.log('  Already has Swagger, skipping');
    return;
  }
  
  // 기본 주석을 Swagger로 변환
  content = content.replace(/\/\*\*\n \* (GET|POST|PUT|PATCH|DELETE) (\/api\/[^\n]+)\n \* ([^\n]+)\n \*\//g, 
    (match, method, path, description) => {
      return `/**
 * @swagger
 * ${path}:
 *   ${method.toLowerCase()}:
 *     summary: ${description}
 *     tags: [GameSession]
 *     responses:
 *       200:
 *         description: 성공
 */`;
    }
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ Updated`);
}

routerFiles.forEach(addSwaggerToFile);
console.log('Done!');
