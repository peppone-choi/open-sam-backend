# Repository Document 반환 문제 해결

## 문제
Repository가 캐시에서 조회하면 plain object를 반환하고,
DB에서 조회하면 Mongoose Document를 반환하여 불일치 발생.

결과: `.save()` 메서드가 없어서 에러 발생

## 해결 방안

### 방안 1: 캐시 로직 비활성화 (임시)
모든 조회를 DB에서 직접 하도록 변경
- 장점: 즉시 해결, .save() 사용 가능
- 단점: 캐시 성능 이점 상실

### 방안 2: 모든 .save()를 repository.update()로 변경
- 장점: 캐시 유지
- 단점: 대량 수정 필요 (100+ 파일)

### 방안 3: Repository가 Mongoose Document로 변환
캐시 조회 결과를 Mongoose Document로 변환
- 장점: 캐시 유지, .save() 사용 가능
- 단점: 변환 로직 복잡

## 선택된 방안: 방안 1 (임시) → 방안 3 (최종)

1단계: 캐시 비활성화로 즉시 수정
2단계: 점진적으로 캐시 재활성화 + Document 변환
