# 어드민 계정 생성 스크립트

## 사용 방법

### 기본 사용 (기본값: admin/admin123, 등급 10)

```bash
npm run create-admin
```

### 커맨드 라인 인자 사용

```bash
npm run create-admin -- --username myadmin --password mypass123 --grade 10 --name "관리자"
```

### 환경변수 사용 (특수문자 포함 비밀번호에 유용)

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=Complex@Pass123 ADMIN_GRADE=10 npm run create-admin
```

### 모든 옵션 지정

```bash
npm run create-admin -- \
  --username admin \
  --password secure123 \
  --name "시스템 관리자" \
  --grade 10 \
  --email admin@example.com
```

## 옵션 설명

- `--username`: 사용자명 (기본값: `admin`)
- `--password`: 비밀번호 (기본값: `admin123`, 최소 6자)
- `--name`: 표시 이름 (기본값: username과 동일)
- `--grade`: 사용자 등급 (기본값: `10`)
  - `5 이상`: 어드민 권한
  - `1-4`: 일반 사용자
- `--email`: 이메일 주소 (선택사항)

## 환경변수

다음 환경변수도 사용할 수 있습니다:

- `ADMIN_USERNAME`: 사용자명
- `ADMIN_PASSWORD`: 비밀번호
- `ADMIN_NAME`: 표시 이름
- `ADMIN_GRADE`: 사용자 등급
- `ADMIN_EMAIL`: 이메일 주소

## 동작 방식

1. 기존 사용자가 없으면 새로 생성
2. 기존 사용자가 있으면 등급과 비밀번호 업데이트
3. 비밀번호는 bcrypt로 해시화되어 저장

## 예제

### 최고 권한 어드민 생성

```bash
npm run create-admin -- --username superadmin --password SuperSecure123! --grade 10
```

### 일반 관리자 생성

```bash
npm run create-admin -- --username manager --password Manager123 --grade 7
```

### 기존 계정 업데이트

```bash
npm run create-admin -- --username admin --password NewPassword123 --grade 10
```

## 주의사항

- 비밀번호는 최소 6자 이상이어야 합니다
- 사용자명은 고유해야 합니다 (중복 시 오류)
- 등급 5 이상이어야 어드민 권한을 가집니다
- 프로덕션 환경에서는 강력한 비밀번호를 사용하세요

## 문제 해결

### "이미 존재하는 사용자입니다" 오류

기존 사용자의 등급과 비밀번호가 업데이트됩니다. 정상 동작입니다.

### "중복된 사용자명" 오류

다른 사용자명을 사용하거나 기존 계정을 업데이트하세요.

### MongoDB 연결 오류

`.env` 파일의 `MONGODB_URI`가 올바른지 확인하세요.


