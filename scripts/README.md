# 스크립트 사용 가이드

## 어드민 계정 생성

초기 어드민 계정을 생성하거나 기존 사용자를 어드민으로 승급시킵니다.

### 기본 사용법

```bash
npm run create-admin
```

기본값으로 다음 계정이 생성됩니다:
- 사용자명: `admin`
- 비밀번호: `admin123`
- 등급: `10` (최고 등급, 어드민)

### 커스텀 사용법

**방법 1: 환경변수 사용 (특수문자 안전) - 권장**

```bash
# Linux/Mac
ADMIN_USERNAME=myadmin ADMIN_PASSWORD='myP@ssw0rd!123' ADMIN_GRADE=10 npm run create-admin

# Windows (PowerShell)
$env:ADMIN_USERNAME="myadmin"; $env:ADMIN_PASSWORD="myP@ssw0rd!123"; $env:ADMIN_GRADE="10"; npm run create-admin

# Windows (CMD)
set ADMIN_USERNAME=myadmin && set ADMIN_PASSWORD=myP@ssw0rd!123 && set ADMIN_GRADE=10 && npm run create-admin
```

**방법 2: 커맨드 라인 인자 (특수문자 주의)**

```bash
# 특수문자 없는 비밀번호
npm run create-admin myadmin mypassword123 10

# 특수문자 포함 시 따옴표 사용 (bash 히스토리 확장 주의)
npm run create-admin myadmin 'myP@ssw0rd!123' 10
```

### 예시

```bash
# 기본 어드민 계정 생성
npm run create-admin

# 환경변수로 특수문자 포함 비밀번호 설정 (권장)
ADMIN_USERNAME=admin ADMIN_PASSWORD='My@dmin!2024' npm run create-admin

# 기존 사용자를 어드민으로 승급
ADMIN_USERNAME=existinguser ADMIN_PASSWORD='newP@ss!2024' ADMIN_GRADE=10 npm run create-admin
```

### 등급 시스템

- `1-4`: 일반 사용자
- `5-9`: 일반 어드민
- `10`: 최고 어드민 (모든 권한)

### 주의사항

- **특수문자 포함 비밀번호**: 환경변수를 사용하는 것이 안전합니다 (히스토리 확장 문제 방지)
- 기존 사용자가 있으면 비밀번호를 업데이트하고 등급을 변경합니다.
- 새 사용자를 생성하면 자동으로 어드민 권한이 부여됩니다.
- MongoDB 연결이 필요합니다 (`.env` 파일의 `MONGODB_URI` 확인).

### 특수문자 문제 해결

bash에서 `!` 같은 특수문자를 사용하면 "event not found" 에러가 발생할 수 있습니다.
이 경우 환경변수 방식을 사용하세요:

```bash
# ❌ 문제 발생 가능
npm run create-admin admin 'MyPass!123' 10

# ✅ 안전한 방법
ADMIN_USERNAME=admin ADMIN_PASSWORD='MyPass!123' npm run create-admin
```
