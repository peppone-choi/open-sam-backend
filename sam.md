# 삼국지 게임 - 은하영웅전설7 완전 적용 시스템

> **실시간 MMORPG + 조직 시뮬레이션 + RTS 전투**

---

## 🎯 핵심 컨셉

### 은하영웅전설7의 핵심 요소

```
1. 실시간 진행 (24배속)
   - 실제 1시간 = 게임 내 1일
   - 모든 플레이어가 동시에 플레이
   - 오프라인 시에도 캐릭터는 게임 내 존재

2. 조직 시뮬레이션
   - 직책 시스템 (황제, 승상, 대장군 등)
   - 권한 카드 시스템
   - 인사/임명/파면

3. 전략 게임 (메타 레이어)
   - 이동, 생산, 외교, 계략
   - 커맨드 포인트 (CP) 소모
   - 실행 시간 (이동 30분, 생산 2시간 등)

4. 전술 게임 (RTS 전투)
   - 실시간 전투
   - 명령 입력 + AI 자동
   - 함대 지휘

5. 플레이어 협력
   - 2000명 동시 접속
   - 파벌/동맹
   - 권력 투쟁, 쿠데타
```

---

## 1. 시간 시스템

### 1.1 실시간 진행 (24배속)

```javascript
// shared/config/time-config.js

const TimeConfig = {
  // 시간 가속 비율
  GAME_SPEED: 24,
  
  // 실시간 → 게임시간 변환
  toGameTime(realSeconds) {
    return realSeconds * this.GAME_SPEED;
  },
  
  // 게임시간 → 실시간 변환
  toRealTime(gameSeconds) {
    return gameSeconds / this.GAME_SPEED;
  }
};

// 예시
실시간 1초   = 게임 24초
실시간 1분   = 게임 24분
실시간 1시간 = 게임 1일
실시간 24시간 = 게임 24일
실시간 30시간 = 게임 1개월

module.exports = TimeConfig;
```

### 1.2 게임 루프

```javascript
// game-server/src/core/game-clock.js

class GameClock {
  constructor() {
    this.startTime = Date.now();
    this.tickInterval = null;
  }

  /**
   * 게임 시계 시작
   */
  start() {
    // 1초마다 틱
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);

    console.log('🕐 Game clock started (24x speed)');
  }

  /**
   * 매 초 실행
   */
  async tick() {
    const now = this.getGameTime();
    
    // 1. 커맨드 완료 확인
    await this.checkCommandCompletion(now);
    
    // 2. 이동 업데이트
    await this.updateMovements(now);
    
    // 3. 생산 업데이트
    await this.updateProductions(now);
    
    // 4. 세금 징수 (매월 1일)
    if (this.isFirstDayOfMonth(now)) {
      await this.collectTaxes();
    }
    
    // 5. 자동 이벤트
    await this.triggerAutoEvents(now);
  }

  /**
   * 현재 게임 시간
   */
  getGameTime() {
    const elapsed = Date.now() - this.startTime;
    return new Date(elapsed * 24); // 24배속
  }

  /**
   * 커맨드 완료 확인
   */
  async checkCommandCompletion(now) {
    const commands = await Command.findAll({
      where: {
        status: 'EXECUTING',
        completionTime: { [Op.lte]: now }
      }
    });

    for (const cmd of commands) {
      await this.completeCommand(cmd);
    }
  }

  /**
   * 커맨드 완료 처리
   */
  async completeCommand(command) {
    command.status = 'COMPLETED';
    command.completedAt = new Date();
    await command.save();

    // 결과 처리
    switch (command.type) {
      case 'MOVE':
        await this.handleMoveComplete(command);
        break;
      case 'PRODUCE':
        await this.handleProduceComplete(command);
        break;
      case 'RECRUIT':
        await this.handleRecruitComplete(command);
        break;
    }

    // 플레이어에게 알림
    await this.notifyPlayer(command.generalId, {
      type: 'COMMAND_COMPLETE',
      command
    });
  }
}

module.exports = GameClock;
```

---

## 2. 직책/권한 시스템

### 2.1 직책 카드

```javascript
// shared/models/Position.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Position = sequelize.define('Position', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    nationId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    
    // 직책명
    name: {
      type: DataTypes.STRING,
      allowNull: false
      // '황제', '승상', '대장군', '사도', '태위', '군단장' 등
    },
    
    // 직책 레벨 (높을수록 권한 강함)
    level: {
      type: DataTypes.INTEGER,
      allowNull: false
      // 1: 황제, 2: 승상, 3: 대장군, 4: 군단장, 5: 태수
    },
    
    // 현재 보유자
    currentHolderId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // 권한 (JSONB)
    authorities: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
      /* 
      {
        canAppoint: ['군단장', '태수'],
        canDismiss: ['태수'],
        canDeclareWar: true,
        canMakePeace: true,
        canIssueLaw: true,
        cpMultiplier: 2.0
      }
      */
    },
    
    // 급여 (매월)
    salary: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  });

  return Position;
};
```

### 2.2 직책 권한 체크

```javascript
// game-server/src/services/authority-service.js

class AuthorityService {
  /**
   * 권한 확인
   */
  async hasAuthority(generalId, action, targetData) {
    const general = await General.findByPk(generalId, {
      include: [{ model: Position, as: 'position' }]
    });

    if (!general.position) {
      return false;
    }

    const authorities = general.position.authorities;

    switch (action) {
      case 'APPOINT':
        return authorities.canAppoint?.includes(targetData.positionName);
        
      case 'DISMISS':
        return authorities.canDismiss?.includes(targetData.positionName);
        
      case 'DECLARE_WAR':
        return authorities.canDeclareWar === true;
        
      case 'MAKE_PEACE':
        return authorities.canMakePeace === true;
        
      case 'ISSUE_LAW':
        return authorities.canIssueLaw === true;
        
      default:
        return false;
    }
  }

  /**
   * 임명
   */
  async appoint(appointerId, targetGeneralId, positionId) {
    // 권한 확인
    const hasAuth = await this.hasAuthority(appointerId, 'APPOINT', {
      positionName: position.name
    });

    if (!hasAuth) {
      throw new Error('임명 권한이 없습니다');
    }

    const position = await Position.findByPk(positionId);
    
    // 기존 보유자 해임
    if (position.currentHolderId) {
      const formerHolder = await General.findByPk(position.currentHolderId);
      formerHolder.positionId = null;
      await formerHolder.save();
    }

    // 새 보유자 임명
    const newHolder = await General.findByPk(targetGeneralId);
    newHolder.positionId = positionId;
    await newHolder.save();

    position.currentHolderId = targetGeneralId;
    await position.save();

    // 알림
    await this.notifyAll({
      type: 'APPOINTMENT',
      appointer: appointerId,
      target: targetGeneralId,
      position: position.name
    });

    return position;
  }
}

module.exports = AuthorityService;
```

---

## 3. 커맨드 포인트 (CP) 시스템

### 3.1 CP 종류

```javascript
// shared/models/General.js 확장

const General = sequelize.define('General', {
  // ... 기존 필드
  
  // PCP (Political/Personal Command Point)
  // 정치/개인 활동에 사용
  pcp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  
  pcpMax: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  
  // MCP (Military Command Point)
  // 군사 활동에 사용
  mcp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  
  mcpMax: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  
  // CP 회복 속도 (직책/능력치에 따라)
  cpRecoveryRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1.0
  }
});
```

### 3.2 CP 회복

```javascript
// game-server/src/services/cp-service.js

class CPService {
  /**
   * CP 회복 (매시간)
   */
  async recoverCP() {
    const generals = await General.findAll({
      include: [{ model: Position, as: 'position' }]
    });

    for (const general of generals) {
      // 기본 회복량
      let pcpRecovery = 10;
      let mcpRecovery = 10;

      // 직책 보너스
      if (general.position) {
        const multiplier = general.position.authorities.cpMultiplier || 1.0;
        pcpRecovery *= multiplier;
        mcpRecovery *= multiplier;
      }

      // 능력치 보너스
      pcpRecovery += Math.floor(general.intel / 10);
      mcpRecovery += Math.floor(general.leadership / 10);

      // 회복
      general.pcp = Math.min(general.pcp + pcpRecovery, general.pcpMax);
      general.mcp = Math.min(general.mcp + mcpRecovery, general.mcpMax);

      await general.save();
    }
  }

  /**
   * CP 소모
   */
  async consumeCP(generalId, type, amount) {
    const general = await General.findByPk(generalId);

    if (type === 'PCP') {
      if (general.pcp < amount) {
        throw new Error('PCP가 부족합니다');
      }
      general.pcp -= amount;
    } else if (type === 'MCP') {
      if (general.mcp < amount) {
        throw new Error('MCP가 부족합니다');
      }
      general.mcp -= amount;
    }

    await general.save();
    return general;
  }
}

module.exports = CPService;
```

---

## 4. 커맨드 시스템 (실행 시간)

### 4.1 커맨드 모델

```javascript
// shared/models/Command.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Command = sequelize.define('Command', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    generalId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    
    type: {
      type: DataTypes.ENUM(
        'MOVE',           // 이동
        'PRODUCE',        // 생산
        'RECRUIT',        // 징병
        'TRAIN',          // 훈련
        'BUILD',          // 건설
        'RESEARCH',       // 연구
        'DIPLOMACY',      // 외교
        'ESPIONAGE',      // 첩보
        'ASSIGN',         // 배치
        'ATTACK'          // 공격
      ),
      allowNull: false
    },
    
    // 커맨드 데이터 (JSONB)
    data: {
      type: DataTypes.JSONB,
      allowNull: false
      /*
      {
        from: 'cityId',
        to: 'cityId',
        troops: 5000,
        productType: 'WEAPON',
        amount: 1000
      }
      */
    },
    
    // CP 비용
    cpType: {
      type: DataTypes.ENUM('PCP', 'MCP'),
      allowNull: false
    },
    
    cpCost: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    
    // 상태
    status: {
      type: DataTypes.ENUM('PENDING', 'EXECUTING', 'COMPLETED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    
    // 시작/완료 시간
    startTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    completionTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  return Command;
};
```

### 4.2 커맨드 실행

```javascript
// game-server/src/services/command-service.js

class CommandService {
  /**
   * 커맨드 제출
   */
  async submitCommand(generalId, commandType, commandData) {
    const general = await General.findByPk(generalId);

    // CP 비용 계산
    const { cpType, cpCost, executionTime } = this.getCommandCost(
      commandType,
      commandData,
      general
    );

    // CP 확인
    if (cpType === 'PCP' && general.pcp < cpCost) {
      throw new Error('PCP가 부족합니다');
    }
    if (cpType === 'MCP' && general.mcp < cpCost) {
      throw new Error('MCP가 부족합니다');
    }

    // CP 소모
    await this.cpService.consumeCP(generalId, cpType, cpCost);

    // 완료 시간 계산
    const now = new Date();
    const completionTime = new Date(now.getTime() + executionTime);

    // 커맨드 생성
    const command = await Command.create({
      generalId,
      type: commandType,
      data: commandData,
      cpType,
      cpCost,
      status: 'EXECUTING',
      startTime: now,
      completionTime
    });

    // 플레이어에게 알림
    await this.notifyPlayer(generalId, {
      type: 'COMMAND_SUBMITTED',
      command,
      completionTime
    });

    return command;
  }

  /**
   * 커맨드 비용 계산
   */
  getCommandCost(type, data, general) {
    const costs = {
      MOVE: {
        cpType: 'MCP',
        cpCost: 10,
        executionTime: 1800000 // 30분 (실제 75초)
      },
      PRODUCE: {
        cpType: 'PCP',
        cpCost: 20,
        executionTime: 7200000 // 2시간 (실제 5분)
      },
      RECRUIT: {
        cpType: 'MCP',
        cpCost: 15,
        executionTime: 3600000 // 1시간 (실제 2.5분)
      },
      TRAIN: {
        cpType: 'MCP',
        cpCost: 10,
        executionTime: 1800000 // 30분
      },
      BUILD: {
        cpType: 'PCP',
        cpCost: 30,
        executionTime: 14400000 // 4시간 (실제 10분)
      },
      ATTACK: {
        cpType: 'MCP',
        cpCost: 20,
        executionTime: 900000 // 15분 (실제 37.5초)
      }
    };

    const base = costs[type];

    // 능력치/거리/규모에 따라 조정
    if (type === 'MOVE') {
      const distance = this.calculateDistance(data.from, data.to);
      base.executionTime = distance * 60000; // 거리당 1분
    }

    if (type === 'PRODUCE') {
      base.executionTime = data.amount * 1000; // 수량당 시간
    }

    return base;
  }

  /**
   * 커맨드 취소
   */
  async cancelCommand(commandId, generalId) {
    const command = await Command.findByPk(commandId);

    if (command.generalId !== generalId) {
      throw new Error('권한이 없습니다');
    }

    if (command.status !== 'EXECUTING') {
      throw new Error('실행 중인 커맨드만 취소할 수 있습니다');
    }

    // CP 일부 환불 (50%)
    const refund = Math.floor(command.cpCost * 0.5);
    const general = await General.findByPk(generalId);
    
    if (command.cpType === 'PCP') {
      general.pcp = Math.min(general.pcp + refund, general.pcpMax);
    } else {
      general.mcp = Math.min(general.mcp + refund, general.mcpMax);
    }
    
    await general.save();

    // 커맨드 취소
    command.status = 'CANCELLED';
    await command.save();

    return command;
  }
}

module.exports = CommandService;
```

---

## 5. 이동 시스템

### 5.1 실시간 이동

```javascript
// game-server/src/services/movement-service.js

class MovementService {
  /**
   * 이동 커맨드 실행
   */
  async executeMove(general, fromCityId, toCityId, troops) {
    // 거리 계산
    const distance = await this.calculateDistance(fromCityId, toCityId);
    
    // 이동 시간 (거리당 1분)
    const travelTime = distance * 60000;
    
    // 커맨드 제출
    const command = await this.commandService.submitCommand(
      general.id,
      'MOVE',
      {
        from: fromCityId,
        to: toCityId,
        troops
      }
    );

    return command;
  }

  /**
   * 이동 완료 처리
   */
  async handleMoveComplete(command) {
    const { from, to, troops } = command.data;
    
    // 병력 이동
    const fromCity = await City.findByPk(from);
    const toCity = await City.findByPk(to);

    fromCity.garrison -= troops;
    await fromCity.save();

    // 목적지가 적 영토면 전투 발생
    if (toCity.nationId !== fromCity.nationId) {
      await this.triggerBattle(command.generalId, toCity.id, troops);
    } else {
      // 아군 영토면 주둔
      toCity.garrison += troops;
      await toCity.save();
    }
  }

  /**
   * 실시간 위치 업데이트 (매 초)
   */
  async updateMovements() {
    const movements = await Command.findAll({
      where: {
        type: 'MOVE',
        status: 'EXECUTING'
      }
    });

    for (const movement of movements) {
      const progress = this.calculateProgress(
        movement.startTime,
        movement.completionTime
      );

      // 진행률 브로드캐스트
      await this.broadcastMovement({
        commandId: movement.id,
        generalId: movement.generalId,
        from: movement.data.from,
        to: movement.data.to,
        progress
      });
    }
  }

  /**
   * 진행률 계산
   */
  calculateProgress(startTime, completionTime) {
    const now = Date.now();
    const total = completionTime - startTime;
    const elapsed = now - startTime;
    return Math.min(elapsed / total, 1.0);
  }
}

module.exports = MovementService;
```

---

## 6. 생산/징병 시스템

### 6.1 생산

```javascript
// game-server/src/services/production-service.js

class ProductionService {
  /**
   * 생산 시작
   */
  async startProduction(generalId, cityId, productType, amount) {
    const city = await City.findByPk(cityId);
    
    // 자원 확인
    const cost = this.getProductionCost(productType, amount);
    
    if (city.gold < cost.gold || city.food < cost.food) {
      throw new Error('자원이 부족합니다');
    }

    // 자원 소모
    city.gold -= cost.gold;
    city.food -= cost.food;
    await city.save();

    // 커맨드 제출
    const command = await this.commandService.submitCommand(
      generalId,
      'PRODUCE',
      {
        cityId,
        productType,
        amount
      }
    );

    return command;
  }

  /**
   * 생산 완료
   */
  async handleProduceComplete(command) {
    const { cityId, productType, amount } = command.data;
    const city = await City.findByPk(cityId);

    switch (productType) {
      case 'WEAPON':
        city.weapons += amount;
        break;
      case 'FOOD':
        city.food += amount;
        break;
      case 'HORSE':
        city.horses += amount;
        break;
    }

    await city.save();

    // 알림
    await this.notifyPlayer(command.generalId, {
      type: 'PRODUCTION_COMPLETE',
      productType,
      amount,
      city: city.name
    });
  }
}

module.exports = ProductionService;
```

---

## 7. 오프라인 시스템

### 7.1 오프라인 보호

```javascript
// game-server/src/services/offline-service.js

class OfflineService {
  /**
   * 로그아웃 시 처리
   */
  async handleLogout(generalId) {
    const general = await General.findByPk(generalId);

    // 안전 지대 확인
    const location = await this.getGeneralLocation(generalId);
    
    if (this.isSafeZone(location)) {
      // 안전 지대: 공격 불가
      general.isProtected = true;
      general.protectedUntil = null; // 무기한
    } else {
      // 위험 지대: 제한적 보호
      general.isProtected = true;
      general.protectedUntil = new Date(Date.now() + 3600000); // 1시간 보호
    }

    general.lastOnline = new Date();
    await general.save();
  }

  /**
   * AI 대리 플레이 (전투)
   */
  async handleOfflineBattle(generalId, battleId) {
    const general = await General.findByPk(generalId);

    if (general.isOnline) {
      // 온라인: 플레이어가 직접 조작
      return;
    }

    // 오프라인: AI가 대신 전투
    const battle = await Battle.findByPk(battleId);
    const unit = await BattleUnit.findOne({
      where: { battleId, generalId }
    });

    // AI 전략 설정
    const aiStrategy = this.getAIStrategy(general);
    
    // AI 명령 생성
    await this.executeAICommands(unit, aiStrategy);
  }

  /**
   * AI 전략 결정
   */
  getAIStrategy(general) {
    // 장수 성향에 따라
    if (general.aggression > 70) {
      return 'AGGRESSIVE'; // 적극 공격
    } else if (general.caution > 70) {
      return 'DEFENSIVE'; // 방어 우선
    } else {
      return 'BALANCED'; // 균형
    }
  }
}

module.exports = OfflineService;
```

---

## 8. 통합 API

### 8.1 메인 서버

```javascript
// game-server/src/app.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const GameClock = require('./core/game-clock');
const RealtimeBattleEngine = require('./battle/realtime-battle-engine');
const RealtimeBattleSocket = require('./battle/realtime-battle-socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 게임 시계 시작
const gameClock = new GameClock();
gameClock.start();

// 전투 엔진 시작
const battleEngine = new RealtimeBattleEngine();
battleEngine.startGameLoop();

// WebSocket 서버
const battleSocket = new RealtimeBattleSocket(server);

// REST API
app.use(express.json());

// 커맨드 제출
app.post('/api/commands', async (req, res) => {
  try {
    const { generalId, type, data } = req.body;
    
    const command = await commandService.submitCommand(
      generalId,
      type,
      data
    );
    
    res.json({ success: true, command });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 현재 상태 조회
app.get('/api/status', async (req, res) => {
  const { generalId } = req.query;
  
  const general = await General.findByPk(generalId, {
    include: [
      { model: Position, as: 'position' },
      { model: City, as: 'location' }
    ]
  });
  
  const commands = await Command.findAll({
    where: { 
      generalId,
      status: 'EXECUTING'
    }
  });
  
  res.json({
    general,
    commands,
    gameTime: gameClock.getGameTime()
  });
});

server.listen(3000, () => {
  console.log('🚀 Game server started on port 3000');
});
```

---

## 9. 클라이언트 (React)

### 9.1 메인 화면

```jsx
// client/src/App.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const App = () => {
  const [general, setGeneral] = useState(null);
  const [commands, setCommands] = useState([]);
  const [gameTime, setGameTime] = useState(null);

  useEffect(() => {
    loadStatus();
    
    // 실시간 업데이트
    const socket = io('http://localhost:3000');
    
    socket.on('command:complete', (data) => {
      console.log('커맨드 완료:', data);
      loadStatus();
    });

    socket.on('battle:started', (data) => {
      console.log('전투 시작:', data);
      // 전투 화면으로 이동
      window.location.href = `/battle/${data.battleId}`;
    });

    return () => socket.close();
  }, []);

  const loadStatus = async () => {
    const res = await axios.get('/api/status', {
      params: { generalId: 'myGeneralId' }
    });
    
    setGeneral(res.data.general);
    setCommands(res.data.commands);
    setGameTime(res.data.gameTime);
  };

  const submitCommand = async (type, data) => {
    await axios.post('/api/commands', {
      generalId: general.id,
      type,
      data
    });
    
    loadStatus();
  };

  return (
    <div>
      <header>
        <h1>삼국지 온라인</h1>
        <div>게임 시간: {gameTime}</div>
      </header>

      <main>
        {/* 장수 정보 */}
        <section>
          <h2>{general?.name}</h2>
          <p>직책: {general?.position?.name || '없음'}</p>
          <p>위치: {general?.location?.name}</p>
          <p>PCP: {general?.pcp} / {general?.pcpMax}</p>
          <p>MCP: {general?.mcp} / {general?.mcpMax}</p>
        </section>

        {/* 실행 중인 커맨드 */}
        <section>
          <h2>실행 중인 명령</h2>
          {commands.map(cmd => (
            <div key={cmd.id}>
              <span>{cmd.type}</span>
              <progress 
                value={getProgress(cmd)} 
                max="100"
              />
              <span>{formatTime(cmd.completionTime)}</span>
            </div>
          ))}
        </section>

        {/* 커맨드 입력 */}
        <section>
          <h2>명령</h2>
          <button onClick={() => submitCommand('MOVE', {
            from: general.locationId,
            to: 'targetCityId',
            troops: 5000
          })}>
            이동
          </button>
          
          <button onClick={() => submitCommand('PRODUCE', {
            cityId: general.locationId,
            productType: 'WEAPON',
            amount: 100
          })}>
            생산
          </button>

          <button onClick={() => submitCommand('RECRUIT', {
            cityId: general.locationId,
            amount: 1000
          })}>
            징병
          </button>
        </section>
      </main>
    </div>
  );
};

const getProgress = (cmd) => {
  const now = Date.now();
  const total = new Date(cmd.completionTime) - new Date(cmd.startTime);
  const elapsed = now - new Date(cmd.startTime);
  return Math.min((elapsed / total) * 100, 100);
};

const formatTime = (time) => {
  const remaining = new Date(time) - Date.now();
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default App;
```

---

## 10. 요약

### ✅ 구현된 시스템

1. **실시간 진행 (24배속)**
   - 실제 1시간 = 게임 1일
   - 게임 시계 (Game Clock)
   - 매 초 틱 업데이트

2. **직책/권한 시스템**
   - 직책 카드 (황제, 승상, 대장군 등)
   - 권한 체크
   - 임명/파면

3. **커맨드 포인트 (CP)**
   - PCP / MCP 분리
   - 자동 회복
   - 직책/능력치 보너스

4. **커맨드 시스템 (실행 시간)**
   - 이동, 생산, 징병, 건설 등
   - 실행 시간 (30분 ~ 4시간)
   - 진행률 표시

5. **오프라인 시스템**
   - 안전 지대 보호
   - AI 대리 플레이
   - 제한적 보호 (1시간)

6. **RTS 전투**
   - 실시간 명령 입력
   - AI 자동 행동
   - 60 FPS 게임 루프