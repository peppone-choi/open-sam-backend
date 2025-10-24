# 마이그레이션 가이드 - PHP → Express.js

## 📋 Oracle 자문 요약

**핵심 전략**: 레거시 PHP의 하드코딩된 상수들을 정규화된 Type 테이블로 전환하고, 수식은 코드에 유지하되 파라미터는 DB에서 가져오기

## 🗺️ 레거시 구조 분석

### PHP 코드 구조 (core/hwe/sammo/)
- ActionItem/ (161개 파일) - 하드코딩된 아이템
- ActionCrewType/ - 병종
- ActionSpecialWar/ - 특수능력
- General.php, City.php 등

### 하드코딩 패턴 예시
```php
// BaseStatItem.php
class BaseStatItem extends BaseItem {
    protected $statType = 'leadership';
    protected $statValue = 1;
    protected $cost = 1000;
    protected $buyable = true;
}
```

## 🎯 마이그레이션 전략

### 1단계: Master Data Type 테이블 생성 ✅
- ItemType, CrewType, SpecialAbilityType, CommandType
- 불변 ID, 밸런스 버전 관리

### 2단계: Runtime Instance 분리
- Item, SpecialAbility는 플레이어별 인스턴스
- typeId로 Type 테이블 참조

### 3단계: 효과 시스템 설계
- 로직은 코드에 (TypeScript)
- 파라미터는 DB에 (effectParams JSON)

## 📊 Wave별 구현 계획

### Wave 0: Read-only API ⏳ (1-2일)
- [x] Prisma 스키마 확장
- [x] Seed 데이터 준비
- [ ] Repository 구현
- [ ] Controller 구현
- [ ] 캐시 적용

### Wave 1: 기본 커맨드 ⏳ (2-4일)
- [ ] RedisService 구현
- [ ] CommandProcessor 구현
- [ ] MOVE, RECRUIT, BUILD

### Wave 2: 전투 시스템 ⏳ (3-6일)

### Wave 3: 아이템/특수능력 ⏳ (2-4일)

## 🔄 다음 단계

1. `npm run prisma:migrate`
2. `npm run prisma:seed`
3. Wave 0 구현 시작

