# Swagger API 문서 설정 완료

## ✅ 설정 완료 사항

### 1. Swagger 패키지 설치
- ✅ swagger-jsdoc@6.2.8
- ✅ swagger-ui-express@5.0.1
- ✅ @types/swagger-jsdoc@6.0.4
- ✅ @types/swagger-ui-express@4.1.8

### 2. Swagger 설정 파일
- ✅ `src/config/swagger.ts` - Swagger 설정 및 스키마 정의
- ✅ `src/server.ts` - Swagger UI 및 JSON 엔드포인트 추가

### 3. API 문서화
**총 108개 엔드포인트 문서화 완료**

| Route File | 엔드포인트 수 | 태그 |
|-----------|------------|------|
| auth.routes.ts | 3 | Auth |
| session.routes.ts | 8 | Session |
| general.routes.ts | 8 | General |
| nation.routes.ts | 11 | Nation |
| command.routes.ts | 5 | Command |
| game.routes.ts | 6 | Game |
| global.routes.ts | 12 | Global |
| troop.routes.ts | 5 | Troop |
| battle.routes.ts | 6 | Battle |
| battlemap-editor.routes.ts | 6 | Battlemap |
| auction.routes.ts | 9 | Auction |
| betting.routes.ts | 3 | Betting |
| message.routes.ts | 7 | Message |
| vote.routes.ts | 5 | Vote |
| inheritance.routes.ts | 1 | Inheritance |
| inheritaction.routes.ts | 8 | Inheritaction |
| nationcommand.routes.ts | 5 | NationCommand |
| misc.routes.ts | 1 | Misc |

## 🌐 Swagger UI 접근

### 개발 서버 시작
```bash
npm run dev
# 또는
pnpm dev
```

### Swagger UI URL
```
http://localhost:3000/api-docs
```

### Swagger JSON (OpenAPI Spec)
```
http://localhost:3000/api-docs.json
```

## 📚 사용 방법

### 1. Swagger UI에서 API 테스트

1. 브라우저에서 `http://localhost:3000/api-docs` 접속
2. 원하는 엔드포인트 클릭
3. "Try it out" 버튼 클릭
4. 파라미터 입력
5. "Execute" 버튼 클릭
6. 응답 확인

### 2. JWT 인증이 필요한 API 테스트

1. 먼저 `/api/auth/login` 또는 `/api/auth/register`로 로그인
2. 응답에서 `token` 복사
3. Swagger UI 우측 상단의 "Authorize" 버튼 클릭
4. JWT 토큰 입력 (Bearer 접두사 불필요)
5. "Authorize" 클릭
6. 이제 인증이 필요한 API 호출 가능

### 3. 새 엔드포인트에 Swagger 추가

#### 수동 추가
```typescript
/**
 * @swagger
 * /api/example/{id}:
 *   get:
 *     summary: 예제 조회
 *     tags: [Example]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 예제 ID
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *       404:
 *         description: 찾을 수 없음
 */
router.get('/example/:id', async (req, res) => {
  // ...
});
```

#### 자동 추가 (기본 템플릿)
```bash
node scripts/add-swagger-docs.js
```

## 🎨 Swagger 커스터마이징

### 태그 추가
`src/config/swagger.ts`에서 새 태그 추가:

```typescript
tags: [
  {
    name: 'NewTag',
    description: '새 태그 설명'
  }
]
```

### 스키마 정의
`src/config/swagger.ts`의 `components.schemas`에 추가:

```typescript
schemas: {
  NewModel: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    }
  }
}
```

### 서버 URL 변경
`src/config/swagger.ts`의 `servers` 배열 수정:

```typescript
servers: [
  {
    url: 'http://localhost:3000',
    description: '로컬 개발'
  },
  {
    url: 'https://api.example.com',
    description: '프로덕션'
  }
]
```

## 📊 Swagger 설정 상세

### 현재 설정
- **OpenAPI 버전**: 3.0.0
- **제목**: OpenSAM API - 삼국지 게임
- **버전**: 1.0.0
- **인증 방식**: JWT Bearer Token
- **문서화된 파일**: 
  - `src/routes/*.ts`
  - `src/server.ts`
  - `src/api/**/*.ts`

### 보안 스킴
```yaml
securitySchemes:
  bearerAuth:
    type: http
    scheme: bearer
    bearerFormat: JWT
```

### 기본 스키마
- General (장수)
- City (도시)
- Command (명령)

## 🔧 문제 해결

### Swagger UI가 로드되지 않을 때
1. 서버가 실행 중인지 확인
2. `http://localhost:3000/api-docs.json` 접속하여 JSON이 생성되는지 확인
3. 브라우저 콘솔에서 에러 확인

### 엔드포인트가 표시되지 않을 때
1. route 파일에 `@swagger` 주석이 있는지 확인
2. `src/config/swagger.ts`의 `apis` 배열에 파일 경로가 포함되어 있는지 확인
3. 서버 재시작

### 타입 에러가 발생할 때
```bash
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express
npm run build
```

## 📝 체크리스트

- [x] Swagger 패키지 설치
- [x] swagger.ts 설정 파일 생성
- [x] server.ts에 Swagger UI 추가
- [x] Health check API 문서화
- [x] Auth API 문서화 (login, register, me)
- [x] 모든 route 파일에 기본 Swagger 문서 추가 (108개 엔드포인트)
- [x] JWT 인증 스킴 추가
- [x] 자동 문서 생성 스크립트 작성
- [x] 빌드 성공 확인

## 🚀 다음 단계

1. **각 엔드포인트 상세 문서화**
   - Request body 스키마 정의
   - Response 예제 추가
   - 에러 케이스 문서화

2. **스키마 정의 추가**
   - General, Nation, City, Command 등 주요 모델
   - Request/Response DTO

3. **예제 데이터 추가**
   - 각 엔드포인트에 실제 사용 예제

4. **프로덕션 배포 설정**
   - 프로덕션 서버 URL 추가
   - API 버전 관리

## 📖 참고 자료

- [Swagger/OpenAPI 공식 문서](https://swagger.io/docs/specification/about/)
- [swagger-jsdoc GitHub](https://github.com/Surnet/swagger-jsdoc)
- [swagger-ui-express GitHub](https://github.com/scottie1984/swagger-ui-express)

---

**총 문서화 완료**: 108개 엔드포인트 ✅
**빌드 상태**: 성공 ✅
**Swagger UI**: `http://localhost:3000/api-docs` ✅
