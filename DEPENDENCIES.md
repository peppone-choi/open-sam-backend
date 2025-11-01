# OpenSAM Backend - Dependencies

> 최종 업데이트: 2025-11-01
> Node.js: >=20.0.0
> 총 패키지: 375개 (취약점: 0개)

## 📦 Core Dependencies (Production)

### Framework & Runtime
- **express**: ^4.21.2 - Web framework
- **typescript**: ^5.9.3 - TypeScript compiler
- **dotenv**: ^16.6.1 - Environment variables

### Database & Cache
- **mongoose**: ^8.19.2 - MongoDB ODM (최신 버전)
- **redis**: ^5.9.0 - Redis client
- **ioredis**: ^5.8.2 - Redis client (alternative)
- **node-cache**: ^5.1.2 - In-memory cache

### Security & Authentication
- **bcrypt**: ^5.1.1 - Password hashing
- **helmet**: ^8.1.0 - Security headers
- **cors**: ^2.8.5 - CORS middleware
- **jsonwebtoken**: ^9.0.2 - JWT authentication

### Real-time & Scheduling
- **socket.io**: ^4.8.1 - WebSocket server
- **node-cron**: ^3.0.3 - Task scheduling

### API & Documentation
- **swagger-jsdoc**: ^6.2.8 - OpenAPI/Swagger generator
- **swagger-ui-express**: ^5.0.1 - Swagger UI
- **@types/swagger-jsdoc**: ^6.0.4
- **@types/swagger-ui-express**: ^4.1.8

### Utilities
- **compression**: ^1.8.1 - Response compression
- **winston**: ^3.18.3 - Logging
- **yup**: ^1.7.1 - Schema validation
- **nanoid**: ^3.3.11 - ID generation
- **uuid**: ^13.0.0 - UUID generation
- **glob**: ^11.0.3 - File pattern matching

## 🛠️ Dev Dependencies

### TypeScript
- **@types/node**: ^22.18.13
- **@types/express**: ^5.0.5
- **@types/bcrypt**: ^5.0.2
- **@types/compression**: ^1.8.1
- **@types/cors**: ^2.8.19
- **@types/jsonwebtoken**: ^9.0.10
- **@types/node-cron**: ^3.0.11
- **@types/uuid**: ^10.0.0

### Development Tools
- **ts-node**: ^10.9.2 - TypeScript execution
- **ts-node-dev**: ^2.0.0 - TypeScript dev server with auto-reload

## 🚀 Scripts

```bash
# Development
npm run dev              # Start dev server with auto-reload
npm run dev:daemon       # Start daemon process

# Build
npm run build            # Compile TypeScript to JavaScript
npm run typecheck        # Type checking without emit

# Production
npm start                # Start production server
npm run start:daemon     # Start daemon in production

# Utilities
npm run clean            # Clean build artifacts and dependencies
```

## 📊 Installation Stats

- Total packages: 375
- Dependencies: 23
- Dev dependencies: 10
- Security vulnerabilities: 0
- Install time: ~25 seconds
- Disk space: ~180MB

## 🔧 Environment Requirements

- **Node.js**: >=20.0.0 (권장: 20.x LTS 또는 22.x)
- **npm**: >=9.0.0
- **MongoDB**: >=6.0 (mongoose 8.x 호환)
- **Redis**: >=6.0

## ⚠️ Known Issues & Notes

### Mongoose 8.x on WSL2
- WSL2 환경에서 Node.js 22.x + Mongoose 8.x 조합 시 모듈 로드 hang 발생 가능
- **해결책**: Windows 네이티브 환경 또는 Docker 사용 권장
- WSL2에서 반드시 실행해야 할 경우 Mongoose 7.x 사용

### nanoid Version
- nanoid 5.x는 ESM only
- CommonJS 프로젝트이므로 3.x 사용

## 📝 Installation Guide

### Fresh Install
```bash
# Clean install
npm run clean
npm install

# Build
npm run build
```

### Update Dependencies
```bash
# Update all to latest compatible versions
npm update

# Update specific package to latest
npm install <package>@latest

# Check outdated packages
npm outdated
```

## 🔄 Dependency Update Policy

- **Major updates**: Manual review required
- **Minor updates**: Auto-update allowed
- **Patch updates**: Auto-update allowed
- **Security updates**: Immediate update required

## 📌 Version Lock

package-lock.json은 버전 관리에 포함하여 일관된 환경 보장
