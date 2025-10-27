# 커맨드 로직 분석 (PHP → TypeScript)

PHP 코드 기반 게임 로직 분석 결과

## 📊 커맨드 통계

- **General 커맨드**: 52개
- **Nation 커맨드**: 27개
- **총**: 79개

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## General 커맨드 (52개)

### 1. 개인 커맨드

#### 요양
```php
    public function getCost():array{
        return [0, 0];
    }

    public function getPreReqTurn():int{
        return 0;
```

#### 단련
```php
    public function getCost():array{
        $env = $this->env;
        return [$env['develcost'], $env['develcost']];
    }

    public function getPreReqTurn():int{
```

#### 견문
```php
    public function getCost():array{
        return [0, 0];
    }

    public function getPreReqTurn():int{
        return 0;
```

#### 은퇴
```php
    public function getCost():array{
        return [0, 0];
    }

    public function getPreReqTurn():int{
        return 1;
```

#### 장비매매
```php
    public function getCost(): array
    {
        if (!$this->isArgValid) {
            return [0, 0];
        }

```

#### 군량매매
```php
    public function getCost():array{
        return [0, 0];
    }

    public function getPreReqTurn():int{
        return 0;
```

#### 내정특기초기화

#### 전투특기초기화
```php
    public function getCost():array{
        return [0, 0];
    }

    public function getPreReqTurn():int{
        return 1;
```

### 2. 내정 커맨드

#### 농지개간

#### 상업투자
```php
        $score = Util::valueFit($this->calcBaseScore($rng), 1);
```

#### 기술연구
```php
        $score = Util::valueFit($this->calcBaseScore($rng), 1);
```

#### 수비강화

#### 성벽보수

#### 치안강화

#### 정착장려
```php
        $score = Util::valueFit($this->calcBaseScore($rng), 1);
        $score *= CriticalScoreEx($rng, $pick);
        $score = Util::round($score);
```

#### 주민선정
```php
        $score = Util::valueFit($this->calcBaseScore($rng), 1);
        $score *= CriticalScoreEx($rng, $pick);
```


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

