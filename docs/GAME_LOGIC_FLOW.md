# OpenSAM Game Logic Flow Analysis

**Document Version:** 1.0  
**Last Updated:** 2025-11-01  
**Purpose:** Comprehensive analysis of the turn-based game engine for migration to modern stack

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Turn Processing System](#turn-processing-system)
3. [Command System Architecture](#command-system-architecture)
4. [Data Flow Mapping](#data-flow-mapping)
5. [Battle Resolution System](#battle-resolution-system)
6. [Critical Game Loops](#critical-game-loops)
7. [Migration Considerations](#migration-considerations)

---

## Executive Summary

OpenSAM is a sophisticated turn-based strategy game with a **daemon-based turn processing system**. The game operates on a **monthly turn cycle** where:

- **Turn Daemon**: `/core/hwe/proc.php` - Simple script that triggers `TurnExecutionHelper::executeAllCommand()`
- **Turn Interval**: Configurable (typically 5-10 minutes per month)
- **Processing Model**: Lock-based sequential execution with time-limited processing
- **Command Queue**: Pre-reserved turns stored in database (`general_turn`, `nation_turn` tables)
- **Real-time Updates**: Polling-based system (no WebSockets in current implementation)

**Key Insight**: The system is designed for **deterministic replay** using RNG seeds, making battles reproducible and auditable.

---

## Turn Processing System

### 1. Turn Daemon (`proc.php`)

**Location**: `/core/hwe/proc.php`

```php
<?php
namespace sammo;

include "lib.php";
include "func.php";

$session = Session::getInstance()->setReadOnly();
$db = DB::db();

TurnExecutionHelper::executeAllCommand();
```

**Invocation**: 
- Cron job or web-based trigger
- Client polling via API: `ExecuteEngine.php`

### 2. Main Execution Flow (`TurnExecutionHelper::executeAllCommand()`)

**Location**: `/core/hwe/sammo/TurnExecutionHelper.php:393-524`

```
┌─────────────────────────────────────────────────────────┐
│         TurnExecutionHelper::executeAllCommand()        │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Check if current time >= turntime (next turn time)
             │   └─► NO: Return (wait for next turn)
             │
             ├─► Acquire Lock (tryLock())
             │   └─► FAIL: Return locked status
             │
             ├─► Check server freeze state (isunited)
             │
             ├─► MAIN LOOP: while (nextTurn <= currentTime)
             │   │
             │   ├─► executeGeneralCommandUntil(nextTurn)
             │   │   ├─► Query generals WHERE turntime < nextTurn
             │   │   │   ORDER BY turntime ASC, no ASC
             │   │   │
             │   │   └─► For each general:
             │   │       ├─► Load environment (game_env)
             │   │       ├─► Check if chief officer (level >= 5)
             │   │       │   └─► Load nation command (nation_turn)
             │   │       │
             │   │       ├─► Determine AI/autorun mode
             │   │       │
             │   │       ├─► preprocessCommand() - Pre-turn triggers
             │   │       │   ├─► Injury reduction (부상경감)
             │   │       │   └─► Troop/supply consumption (병력군량소모)
             │   │       │
             │   │       ├─► Check block status
             │   │       │
             │   │       ├─► Process Nation Command (if exists)
             │   │       │   └─► processNationCommand()
             │   │       │
             │   │       ├─► Process General Command
             │   │       │   └─► processCommand()
             │   │       │
             │   │       ├─► Pull commands (shift queue)
             │   │       │   ├─► pullNationCommand()
             │   │       │   └─► pullGeneralCommand()
             │   │       │
             │   │       └─► updateTurnTime()
             │   │           ├─► Decrease killturn
             │   │           ├─► Check death/retirement
             │   │           └─► Set next turntime
             │   │
             │   ├─► Monthly Tick (when month changes):
             │   │   ├─► preUpdateMonthly()
             │   │   │   ├─► Penalty reduction
             │   │   │   ├─► Nation founding counters
             │   │   │   └─► Supply consumption
             │   │   │
             │   │   ├─► turnDate() - Advance game calendar
             │   │   │
             │   │   └─► postUpdateMonthly()
             │   │       ├─► Monthly resource generation
             │   │       ├─► Population growth
             │   │       └─► Seasonal events
             │   │
             │   └─► Check execution time limit
             │       └─► If exceeded: Save state and exit
             │
             ├─► processTournament() - Handle tournaments
             │
             ├─► processAuction() - Handle auction endings
             │
             └─► unlock() - Release lock
```

### 3. Turn Timing Mechanics

**Time Representation**: MySQL DATETIME(6) with microsecond precision

```php
// Turn interval calculation
$nextTurn = addTurn($prevTurn, $turnterm);  // Add X minutes
$currentTurn = cutTurn($turntime, $turnterm); // Snap to turn boundary
```

**Key Fields**:
- `game_env.turntime`: Global "current turn time"
- `game_env.turnterm`: Minutes per turn (e.g., 5, 10)
- `general.turntime`: When this general's next turn executes

**Example Timeline**:
```
T0: 2025-01-01 00:00:00  [Month 1, Turn 1]
    General A: turntime = 2025-01-01 00:05:00
    General B: turntime = 2025-01-01 00:03:00
    
T1: Proc runs at 2025-01-01 00:03:30
    ├─► Execute General B (turntime < T1)
    │   └─► B's turntime → 2025-01-01 00:08:00
    ├─► Execute General A (turntime < T1)
    │   └─► A's turntime → 2025-01-01 00:10:00
    └─► game_env.turntime → 2025-01-01 00:05:00 (next month tick)
```

---

## Command System Architecture

### 1. Command Class Hierarchy

```
BaseCommand (abstract)
├─► GeneralCommand (abstract)
│   ├─► che_농지개간 (Farm Development)
│   ├─► che_출병 (Deploy Troops)
│   ├─► che_이동 (Move)
│   ├─► che_훈련 (Training)
│   └─► ... 50+ commands
│
└─► NationCommand (abstract)
    ├─► che_선전포고 (Declare War)
    ├─► che_천도 (Move Capital)
    ├─► che_급습 (Raid)
    └─► ... 20+ commands
```

### 2. Command Lifecycle

#### A. Command Reservation (User Input)

**API Endpoint**: `/sammo/API/Command/ReserveCommand.php`

```
User Input (Vue) 
    ↓
API: POST /hwe/api.php (Command/ReserveCommand)
    ↓
setGeneralCommand($generalID, $turnList, $command, $arg)
    ↓
Validation:
├─► Basic arg validation (checkCommandArg)
├─► Build command object (buildGeneralCommandClass)
├─► Test permissions (hasPermissionToReserve)
└─► Test min conditions (hasMinConditionMet)
    ↓
Database Insert/Update:
UPDATE general_turn SET
  action = 'che_농지개간',
  arg = '{}',
  brief = '농지 개간'
WHERE general_id = ? AND turn_idx IN (0, 1, 2, ...)
```

**Turn Queue Tables**:

```sql
-- General commands (player actions)
CREATE TABLE general_turn (
  id INT AUTO_INCREMENT,
  general_id INT,
  turn_idx INT,       -- 0 = next turn, 1 = turn after, etc.
  action VARCHAR(20), -- Command class name
  arg TEXT,           -- JSON-encoded arguments
  brief TEXT,         -- Display text
  PRIMARY KEY (id),
  UNIQUE KEY (general_id, turn_idx)
);

-- Nation commands (leader/officer actions)
CREATE TABLE nation_turn (
  id INT AUTO_INCREMENT,
  nation_id INT,
  officer_level INT,  -- 5-12 (different officer ranks)
  turn_idx INT,
  action VARCHAR(16),
  arg TEXT,
  brief TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY (nation_id, officer_level, turn_idx)
);
```

**Turn Index Meaning**:
- `turn_idx = 0`: Execute on next turn
- `turn_idx = 1`: Execute in 2 turns
- `turn_idx = -1`: Odd turns (0, 2, 4, ...)
- `turn_idx = -2`: Even turns (1, 3, 5, ...)
- `turn_idx = -3`: All turns

#### B. Command Execution

**Entry Point**: `TurnExecutionHelper::processCommand()`

**Location**: `/core/hwe/sammo/TurnExecutionHelper.php:111-168`

```php
public function processCommand(RandUtil $rng, Command\GeneralCommand $commandObj, bool $autorunMode)
{
    $general = $this->getGeneral();
    
    while (true) {
        // 1. Check full conditions
        if (!$commandObj->hasFullConditionMet()) {
            $failString = $commandObj->getFailString();
            $general->getLogger()->pushGeneralActionLog("{$failString}");
            break;
        }
        
        // 2. Check term stack (multi-turn commands)
        if (!$commandObj->addTermStack()) {
            $termString = $commandObj->getTermString();
            $general->getLogger()->pushGeneralActionLog("{$termString}");
            break;
        }
        
        // 3. Run command
        $result = $commandObj->run($rng);
        if ($result) {
            $commandObj->setNextAvailable();
            break;
        }
        
        // 4. Try alternative command (e.g., Move if Deploy fails)
        $alt = $commandObj->getAlternativeCommand();
        if ($alt === null) break;
        $commandObj = $alt;
    }
    
    // 5. Update killturn (action points)
    $general->decreaseKillturn();
    
    return $commandObj->getResultTurn();
}
```

### 3. Command Constraints System

**Constraint Framework**: `/core/hwe/sammo/Constraint/`

Commands use a **declarative constraint system**:

```php
class che_농지개간 extends Command\GeneralCommand {
    protected function init() {
        $this->fullConditionConstraints = [
            ConstraintHelper::NotBeNeutral(),        // Must belong to nation
            ConstraintHelper::OccupiedCity(),        // City must be occupied
            ConstraintHelper::SuppliedCity(),        // City must have supply
            ConstraintHelper::ReqGeneralGold(100),   // Need 100 gold
            ConstraintHelper::RemainCityCapacity('agri', '농지 개간')
        ];
    }
    
    public function run(RandUtil $rng): bool {
        // Calculate success/fail/critical
        $score = $this->calcBaseScore($rng);
        
        // Update city agriculture
        $db->update('city', [
            'agri' => $city['agri'] + $score
        ], 'city=%i', $cityID);
        
        // Update general
        $general->increaseVarWithLimit('gold', -100, 0);
        $general->addExperience($score * 0.7);
        
        return true;
    }
}
```

### 4. Deterministic RNG System

**Critical Design**: All randomness is **seeded** for replay capability.

```php
// Command execution uses seeded RNG
$rng = new RandUtil(new LiteHashDRBG(Util::simpleSerialize(
    UniqueConst::$hiddenSeed,      // Server secret
    'generalCommand',              // Context
    $year,                         // Year
    $month,                        // Month
    $general->getID(),             // General ID
    $commandObj->getRawClassName() // Command name
)));

$commandObj->run($rng);
```

**Implications for Migration**:
- RNG algorithm must be preserved exactly
- Seed generation must be identical
- Battle replays depend on this

---

## Data Flow Mapping

### 1. User Action → State Update

```
┌──────────────┐
│   Vue.js UI  │
│  (Frontend)  │
└──────┬───────┘
       │ 1. User clicks "농지개간" (Farm Development)
       │    for turns [0, 1, 2]
       │
       ▼
┌──────────────────────────────────────────────┐
│  API: POST /hwe/api.php                      │
│  {                                           │
│    "module": "Command",                      │
│    "action": "ReserveCommand",               │
│    "args": {                                 │
│      "action": "che_농지개간",               │
│      "turnList": [0, 1, 2],                  │
│      "arg": {}                               │
│    }                                         │
│  }                                           │
└──────────────┬───────────────────────────────┘
               │ 2. API Handler
               │
               ▼
┌─────────────────────────────────────────────┐
│  setGeneralCommand()                        │
│  (func_command.php:304-400)                 │
│                                             │
│  ├─► Sanitize arguments                    │
│  ├─► Build command object                  │
│  ├─► Validate permissions                  │
│  └─► Test minimum conditions               │
└──────────────┬──────────────────────────────┘
               │ 3. Database Write
               │
               ▼
┌─────────────────────────────────────────────┐
│  MySQL: general_turn table                  │
│                                             │
│  UPDATE general_turn SET                    │
│    action = 'che_농지개간',                 │
│    arg = '{}',                              │
│    brief = '농지 개간'                      │
│  WHERE general_id = 123                     │
│    AND turn_idx IN (0, 1, 2)                │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Response to Client                         │
│  {                                          │
│    "result": true,                          │
│    "brief": "농지 개간",                    │
│    "reason": "success"                      │
│  }                                          │
└─────────────────────────────────────────────┘
```

### 2. Turn Processing → State Updates

```
┌──────────────────────────────────────────────┐
│  Cron/Trigger: proc.php                      │
│  (Every 30 seconds typical)                  │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  TurnExecutionHelper::executeAllCommand()    │
└──────────────┬───────────────────────────────┘
               │
               ├─► Check: Is it time for next turn?
               │   SELECT turntime FROM game_env
               │   └─► NO: Exit early
               │
               ├─► Acquire distributed lock
               │   UPDATE plock SET plock=1 WHERE type='GAME'
               │
               ├─► SELECT generals WHERE turntime < now()
               │   ORDER BY turntime ASC
               │   └─► Result: [General A, B, C...]
               │
               └─► For each general:
                   │
                   ├─► Load command from general_turn
                   │   SELECT action, arg FROM general_turn
                   │   WHERE general_id = ? AND turn_idx = 0
                   │
                   ├─► Execute command
                   │   ├─► che_농지개간::run()
                   │   │   └─► UPDATE city SET agri = agri + score
                   │   │       UPDATE general SET gold = gold - cost
                   │   │
                   │   └─► Log results to general_log
                   │
                   ├─► Shift turn queue
                   │   UPDATE general_turn SET turn_idx = turn_idx - 1
                   │   WHERE general_id = ?
                   │
                   └─► Update next turn time
                       UPDATE general SET
                         turntime = DATE_ADD(turntime, INTERVAL 5 MINUTE)
                       WHERE no = ?
```

### 3. Battle Execution Flow

```
che_출병::run()  (Deploy/Attack command)
    ↓
processWar($warSeed, $attacker, $attackerNation, $defenderCity)
    ↓
┌─────────────────────────────────────────────┐
│  1. Build War Units                         │
│                                             │
│  Attacker: WarUnitGeneral($attackerGen)     │
│  Defender: WarUnitCity($defenderCity)       │
│                                             │
│  Query defending generals in city:          │
│  SELECT * FROM general                      │
│  WHERE city = ? AND nation = ?              │
│    └─► Build WarUnitGeneral for each       │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  2. processWar_NG() - Battle Loop           │
│                                             │
│  while (attacker.phase < maxPhase) {        │
│    // Get next defender                     │
│    defender = getNextDefender();            │
│                                             │
│    // Check supply                          │
│    if (defender.rice <= 0) {                │
│      defender loses (supply exhausted)      │
│      break;                                 │
│    }                                        │
│                                             │
│    // Initialize combat                     │
│    if (new opponent) {                      │
│      defender.setOppose(attacker);          │
│      attacker.setOppose(defender);          │
│                                             │
│      // Fire init triggers                  │
│      initCaller.fire();                     │
│    }                                        │
│                                             │
│    // Combat phase                          │
│    attacker.beginPhase();                   │
│    defender.beginPhase();                   │
│                                             │
│    // Fire battle triggers (skills)         │
│    battleCaller.fire();                     │
│                                             │
│    // Calculate damage                      │
│    deadDefender = attacker.calcDamage();    │
│    deadAttacker = defender.calcDamage();    │
│                                             │
│    // Apply damage                          │
│    attacker.decreaseHP(deadAttacker);       │
│    defender.decreaseHP(deadDefender);       │
│                                             │
│    // Log battle detail                     │
│    logger.pushGeneralBattleDetailLog(...)   │
│                                             │
│    // Check continuation                    │
│    if (!attacker.continueWar()) {           │
│      attacker retreats                      │
│      break;                                 │
│    }                                        │
│                                             │
│    if (!defender.continueWar()) {           │
│      defender defeated                      │
│      defender = getNextDefender();          │
│    }                                        │
│  }                                          │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  3. Post-Battle Processing                  │
│                                             │
│  ├─► Update casualties                      │
│  │   UPDATE city SET dead = dead + X        │
│  │                                          │
│  ├─► Update tech (battle experience)        │
│  │   UPDATE nation SET                      │
│  │     tech = tech + (killed * 0.009)       │
│  │                                          │
│  ├─► Update diplomacy                       │
│  │   UPDATE diplomacy SET                   │
│  │     dead = dead + casualties             │
│  │                                          │
│  └─► If city conquered:                     │
│      ConquerCity()                          │
│        ├─► Transfer city to attacker        │
│        ├─► Relocate defending generals      │
│        └─► Update nation stats              │
└─────────────────────────────────────────────┘
```

---

## Battle Resolution System

### 1. Battle Components

**Core Classes**:
- `WarUnit` (abstract): Base battle unit
  - `WarUnitGeneral`: Player/NPC general
  - `WarUnitCity`: City defense

**Key Files**:
- `/core/hwe/process_war.php`: Main battle orchestration
- `/core/hwe/sammo/WarUnit.php`: Battle unit mechanics
- `/core/hwe/sammo/WarUnitTrigger/`: Battle skills/effects

### 2. Battle Damage Calculation

**Damage Formula** (simplified from code analysis):

```php
// Base damage
$atk = $unit->getAtk();  // Attack power
$def = $opponent->getDef(); // Defense power
$crewPower = $unit->getCrew() * $unit->getTrain() * $unit->getAtmos();

// Crew type bonuses
$crewTypeCoef = $attacker->getCrewType()
    ->getAttackCoef($defender->getCrewType())
    * $defender->getCrewType()
    ->getDefenceCoef($attacker->getCrewType());

// Final damage
$damage = ($atk - $def * 0.5) 
    * $crewPower 
    * $crewTypeCoef
    * randomFactor(0.8, 1.2);
```

**Crew Type Triangle**:
```
      Cavalry
       /   \
      /     \
  Archer - Infantry
  
Cavalry > Infantry > Archer > Cavalry
```

### 3. Battle Skill System

**Trigger Points**:
1. **Battle Init** (`getBattleInitSkillTriggerList`): Before first phase
2. **Battle Phase** (`getBattlePhaseSkillTriggerList`): Each combat round

**Example Skill**: 필살 (Critical Strike)

```php
class che_필살발동 extends WarUnitTrigger {
    public function run(
        WarUnit $self, 
        WarUnit $oppose, 
        RandUtil $rng
    ): bool {
        $critProb = 0.1; // 10% chance
        
        if ($rng->nextBool($critProb)) {
            // Apply damage multiplier
            $self->addAttackMultiplier(1.5);
            
            // Log to battle detail
            $self->getLogger()
                ->pushGeneralBattleDetailLog("<C>필살</>공격!");
            
            return true;
        }
        return false;
    }
}
```

### 4. Battle Logs

**Two-tier Logging**:

```sql
-- High-level battle results
general_history (type='전투결과')
  ├─► Won/Lost
  ├─► Casualties
  └─► Experience gained

-- Detailed combat log (phase-by-phase)
general_history (type='전투상세')
  ├─► Phase 1: HP changes
  ├─► Skill activations
  └─► Turn-by-turn damage
```

**Frontend Display**: `/core/hwe/ts/battleCenter.ts`

---

## Critical Game Loops

### 1. Main Game Loop (Monthly Cycle)

```
Every ~5-10 minutes (turnterm):
  ┌─────────────────────────────────────┐
  │  executeAllCommand()                │
  │                                     │
  │  For each general:                  │
  │    ├─► Execute queued command       │
  │    ├─► Update resources             │
  │    ├─► Check death/retirement       │
  │    └─► Advance turntime             │
  │                                     │
  │  If month boundary crossed:         │
  │    ├─► preUpdateMonthly()           │
  │    │   ├─► Reduce penalties         │
  │    │   ├─► Nation timers (war, etc) │
  │    │   └─► Supply consumption       │
  │    │                                │
  │    ├─► turnDate() - Increment month │
  │    │                                │
  │    └─► postUpdateMonthly()          │
  │        ├─► Farm production          │
  │        ├─► Commerce revenue         │
  │        ├─► Population growth        │
  │        ├─► Salary payments          │
  │        └─► Seasonal events          │
  └─────────────────────────────────────┘
```

### 2. Resource Generation Loop

**Monthly Resources** (from `postUpdateMonthly()`):

```php
// Agriculture production
$riceProduction = $city['agri'] * $city['trust'] / 100;
$city['rice'] += $riceProduction;

// Commerce production  
$goldProduction = $city['comm'] * $city['trust'] / 100;
$city['gold'] += $goldProduction;

// Population growth
$popGrowth = ($city['pop'] * 0.01) - ($city['dead'] * 0.1);
$city['pop'] = clamp($city['pop'] + $popGrowth, 0, $city['pop_max']);

// Decay dead bodies
$city['dead'] *= 0.9;
```

### 3. Event System Loop

**Event Triggers**: `TurnExecutionHelper::runEventHandler()`

```php
// Events stored in database
SELECT * FROM event 
WHERE target = 'PreMonth' 
ORDER BY priority DESC, id ASC

foreach ($events as $event) {
    $condition = Json::decode($event['condition']);
    $action = Json::decode($event['action']);
    
    if (checkCondition($condition, $env)) {
        executeAction($action, $env);
    }
}
```

**Event Targets**:
- `PreMonth`: Before monthly updates
- `Month`: After monthly updates
- `PreSeason`: Seasonal events
- Custom triggers

### 4. AI Decision Loop

**AI Activation**: `GeneralAI::chooseGeneralTurn()`

**Triggers**:
- NPC generals (`npc >= 2`)
- Inactive players (autorun mode)

```php
if ($general->getNPCType() >= 2) {
    $ai = new GeneralAI($general);
    $commandObj = $ai->chooseGeneralTurn($reservedCommand);
}
```

**AI Decision Tree** (simplified):

```
1. Check immediate threats
   ├─► Low troops? → Recruit
   ├─► Low gold? → Commerce
   └─► Under attack? → Defend/Retreat

2. Strategic goals
   ├─► Nation goal (expand/defend)
   ├─► Officer orders (nation commands)
   └─► Personal development

3. Execute chosen command
```

---

## Migration Considerations

### 1. Critical Systems to Preserve

#### A. Deterministic RNG
**Challenge**: Battle replays and fairness depend on exact RNG reproduction.

**Migration Strategy**:
```typescript
// Must port exact algorithm
class LiteHashDRBG {
  // PHP's implementation uses specific hash functions
  // Consider using WebAssembly to ensure binary compatibility
}
```

**Recommendation**: 
- Port RNG to Rust/Go with test vectors
- Keep battle replay verification tests
- Document seed format precisely

#### B. Lock-Based Concurrency

**Current System**:
```php
// Single global lock
function tryLock(): bool {
    $db->update('plock', 
        ['plock' => 1, 'locktime' => now()],
        'type = %s AND plock = 0', 'GAME'
    );
    return $db->affectedRows() > 0;
}
```

**Migration Options**:

1. **Distributed Lock** (Redis/etcd)
   ```typescript
   const lock = await redlock.acquire(['game:turn'], 30000);
   try {
     await processTurns();
   } finally {
     await lock.release();
   }
   ```

2. **Event Sourcing**
   - Commands become immutable events
   - Process events in order
   - No lock needed (single writer)

3. **Queue-Based** (Recommended)
   ```typescript
   // BullMQ/Temporal.io
   await turnQueue.add('processTurn', {
     turnTime: nextTurn,
   }, {
     jobId: nextTurn.toISOString(), // Deduplication
     removeOnComplete: true
   });
   ```

#### C. Command Queue System

**Current Schema**:
```sql
general_turn: (general_id, turn_idx) → (action, arg, brief)
nation_turn: (nation_id, officer_level, turn_idx) → (action, arg, brief)
```

**Proposed Migration**:

**Option 1: Event Sourcing**
```typescript
interface CommandReserved {
  eventId: UUID;
  generalId: number;
  turnIdx: number;
  commandType: string;
  args: Record<string, unknown>;
  timestamp: Date;
}

// Commands are immutable events
// Query current state by reducing events
```

**Option 2: Modern Queue**
```typescript
interface ScheduledCommand {
  id: UUID;
  generalId: number;
  executeAt: Date;  // Computed from turnIdx
  commandType: string;
  args: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

// Index: (generalId, executeAt)
// Index: (executeAt, status) for processing
```

### 2. Database Migration Strategy

**Current Tables** (50+ tables):
- `general`: Player state
- `general_turn`: Command queue
- `city`: City state
- `nation`: Nation state
- `nation_turn`: Nation command queue
- `general_history`: Logs
- ... and more

**Migration Approach**:

```typescript
// Phase 1: Dual-write
class CommandService {
  async reserveCommand(cmd: CommandInput) {
    // Write to both old and new DB
    await Promise.all([
      this.legacyDB.insertCommand(cmd),
      this.newDB.insertCommand(cmd)
    ]);
  }
}

// Phase 2: Verify consistency
// Phase 3: Cut over to new DB
// Phase 4: Remove dual-write
```

**Schema Evolution**:
```sql
-- Old
general_turn: turn_idx INT  -- Relative index

-- New (proposed)
scheduled_commands: 
  execute_at TIMESTAMPTZ  -- Absolute time
  turn_offset INT         -- For display
```

### 3. Real-Time Updates

**Current System**: Polling via `ExecuteEngine` API

```typescript
// Client polls every 10-30 seconds
setInterval(async () => {
  const result = await API.ExecuteEngine();
  if (result.updated) {
    await refreshGameState();
  }
}, 10000);
```

**Migration Options**:

**Option 1: Server-Sent Events (SSE)**
```typescript
// Backend
app.get('/api/turn-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  
  const subscription = turnEvents.subscribe((turn) => {
    res.write(`data: ${JSON.stringify(turn)}\n\n`);
  });
  
  req.on('close', () => subscription.unsubscribe());
});

// Frontend
const eventSource = new EventSource('/api/turn-stream');
eventSource.onmessage = (event) => {
  const turn = JSON.parse(event.data);
  updateGameState(turn);
};
```

**Option 2: WebSockets**
```typescript
// Backend (Socket.io/ws)
io.on('connection', (socket) => {
  socket.on('subscribe:general', (generalId) => {
    socket.join(`general:${generalId}`);
  });
});

// Emit on turn completion
io.to(`general:${generalId}`).emit('turnCompleted', result);

// Frontend
socket.on('turnCompleted', (result) => {
  updateGameState(result);
});
```

**Option 3: GraphQL Subscriptions**
```graphql
subscription OnTurnCompleted($generalId: ID!) {
  turnCompleted(generalId: $generalId) {
    turnTime
    results {
      command
      logs
      stateChanges
    }
  }
}
```

**Recommendation**: Start with SSE (simpler), migrate to WebSockets if needed.

### 4. Performance Optimization Opportunities

#### A. Batch Processing
**Current**: Sequential general processing  
**Proposed**: Parallel processing with dependency graph

```typescript
// Identify independencies
const generals = await getGeneralsForTurn(turnTime);

// Build dependency graph
const graph = buildDependencyGraph(generals);
// Dependencies: battles, city sharing, etc.

// Process in parallel
await Promise.all(
  graph.independent.map(g => processGeneral(g))
);

// Then process dependent nodes
for (const level of graph.levels) {
  await Promise.all(
    level.map(g => processGeneral(g))
  );
}
```

#### B. Caching Strategy

```typescript
// Cache frequently accessed data
const cityCache = new LRU<number, City>({ max: 500 });

// Invalidate on city state change
eventEmitter.on('cityUpdated', (cityId) => {
  cityCache.delete(cityId);
});
```

#### C. Database Indexing

**Critical Indexes**:
```sql
-- Turn processing
CREATE INDEX idx_general_turntime ON general(turntime, no);

-- Command lookup
CREATE INDEX idx_general_turn_next ON general_turn(general_id, turn_idx);

-- Battle queries
CREATE INDEX idx_general_city_nation ON general(city, nation) 
  WHERE nation != 0;
```

### 5. Testing Strategy

#### A. Turn Execution Tests

```typescript
describe('Turn Execution', () => {
  it('should process generals in correct order', async () => {
    // Setup: 3 generals with different turntimes
    await createGeneral({ id: 1, turntime: '2025-01-01 00:05' });
    await createGeneral({ id: 2, turntime: '2025-01-01 00:03' });
    await createGeneral({ id: 3, turntime: '2025-01-01 00:07' });
    
    // Execute
    await executeTurn('2025-01-01 00:06');
    
    // Assert: Only generals 1 and 2 processed
    expect(await getProcessedGenerals()).toEqual([2, 1]);
  });
  
  it('should handle failed commands gracefully', async () => {
    // Setup: Command with insufficient resources
    await reserveCommand({
      generalId: 1,
      turnIdx: 0,
      command: 'che_농지개간',
      args: {}
    });
    await setGeneralGold(1, 0); // Not enough gold
    
    // Execute
    await executeTurn();
    
    // Assert: Log shows failure, turn still processed
    const logs = await getGeneralLogs(1);
    expect(logs[0]).toContain('실패');
  });
});
```

#### B. Battle Replay Tests

```typescript
describe('Battle Determinism', () => {
  it('should produce identical results with same seed', async () => {
    const seed = 'test-seed-123';
    
    const result1 = await simulateBattle({
      attackerId: 1,
      defenderId: 2,
      seed
    });
    
    const result2 = await simulateBattle({
      attackerId: 1,
      defenderId: 2,
      seed
    });
    
    expect(result1).toEqual(result2);
  });
});
```

#### C. Performance Tests

```typescript
describe('Turn Performance', () => {
  it('should process 1000 generals in under 30 seconds', async () => {
    // Setup: 1000 generals
    const generals = await createManyGenerals(1000);
    
    const start = Date.now();
    await executeTurn();
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(30000);
  });
});
```

---

## Flow Diagrams

### Complete User Action Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         USER ACTION                         │
│                                                             │
│  User clicks "Deploy Troops" button                         │
│  - Target city: Luoyang                                     │
│  - Turns: [0, 1, 2] (next 3 turns)                         │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP POST
             ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY                             │
│  /hwe/api.php?module=Command&action=ReserveCommand          │
└────────────┬────────────────────────────────────────────────┘
             │
             │ 1. Validate session
             │ 2. Parse args
             ▼
┌─────────────────────────────────────────────────────────────┐
│                COMMAND VALIDATION                           │
│                                                             │
│  buildGeneralCommandClass('che_출병', ...)                  │
│    ├─► Check permissions                                   │
│    │   - Is general in a nation?                           │
│    │   - Has route to target?                              │
│    │                                                        │
│    └─► Check resources                                     │
│        - Enough troops?                                    │
│        - Enough rice?                                      │
└────────────┬────────────────────────────────────────────────┘
             │
             │ ✓ Valid
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE WRITE                            │
│                                                             │
│  BEGIN TRANSACTION                                          │
│    UPDATE general_turn SET                                  │
│      action = 'che_출병',                                   │
│      arg = '{"destCityID": 5}',                            │
│      brief = '【낙양】로 출병'                              │
│    WHERE general_id = 123                                   │
│      AND turn_idx IN (0, 1, 2)                             │
│  COMMIT                                                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Success
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE                                 │
│  {                                                          │
│    "result": true,                                          │
│    "brief": "【낙양】로 출병"                               │
│  }                                                          │
└────────────┬────────────────────────────────────────────────┘
             │
             │ JSON response
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND UPDATE                            │
│  Vue updates turn display:                                  │
│    Turn 0: 【낙양】로 출병                                  │
│    Turn 1: 【낙양】로 출병                                  │
│    Turn 2: 【낙양】로 출병                                  │
└─────────────────────────────────────────────────────────────┘

         ...time passes (5-10 minutes)...

┌─────────────────────────────────────────────────────────────┐
│                   CRON TRIGGER                              │
│  */1 * * * * curl http://localhost/hwe/proc.php             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              TURN EXECUTION ENGINE                          │
│                                                             │
│  TurnExecutionHelper::executeAllCommand()                   │
│    ├─► Acquire lock                                        │
│    ├─► SELECT generals WHERE turntime <= NOW()             │
│    │     ORDER BY turntime ASC                             │
│    │   → [General #123, ...]                               │
│    │                                                        │
│    └─► For General #123:                                   │
│        │                                                    │
│        ├─► Load command (turn_idx=0)                       │
│        │   → che_출병 to Luoyang                           │
│        │                                                    │
│        ├─► Execute processCommand()                        │
│        │   ├─► Check conditions (still valid?)            │
│        │   ├─► Run che_출병::run()                         │
│        │   │   └─► processWar() → [see battle flow]       │
│        │   │                                               │
│        │   └─► Log results to general_history             │
│        │                                                    │
│        ├─► Shift queue (turn_idx--):                       │
│        │   UPDATE general_turn SET turn_idx = turn_idx - 1 │
│        │                                                    │
│        └─► Update next turn time:                          │
│            UPDATE general SET                               │
│              turntime = DATE_ADD(turntime, '0:05')         │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Turn completed
             ▼
┌─────────────────────────────────────────────────────────────┐
│                CLIENT POLLING                               │
│  setInterval(() => {                                        │
│    API.ExecuteEngine().then(result => {                     │
│      if (result.updated) {                                  │
│        refreshGameState();                                  │
│      }                                                      │
│    });                                                      │
│  }, 10000);                                                 │
└────────────┬────────────────────────────────────────────────┘
             │
             │ GET /hwe/api.php?module=Global&action=GetRecentRecord
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   FETCH UPDATES                             │
│  {                                                          │
│    "general": [                                             │
│      [seq, "【낙양】로 진격합니다. 00:05"],                 │
│      [seq, "전투결과: 승리"]                                │
│    ],                                                       │
│    "flushGeneral": 0                                        │
│  }                                                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  UI UPDATE                                  │
│  General Log:                                               │
│    【낙양】로 진격합니다. 00:05                             │
│    전투결과: 승리                                           │
│                                                             │
│  Turn Queue Updated:                                        │
│    Turn 0: 【낙양】로 출병  ← (was turn 1)                  │
│    Turn 1: 【낙양】로 출병  ← (was turn 2)                  │
│    Turn 2: 휴식                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary & Key Takeaways

### Critical Migration Points

1. **RNG Determinism**: Must preserve exact battle replay capability
2. **Lock Mechanism**: Replace MySQL lock with distributed lock (Redis/etcd)
3. **Command Queue**: Consider event sourcing or modern queue system
4. **Real-time**: Upgrade from polling to WebSockets/SSE
5. **Database**: Plan dual-write migration strategy

### Architecture Recommendations

**Proposed Stack**:
```
Frontend: Next.js + React + TailwindCSS
Backend: NestJS (TypeScript) or Go
Database: PostgreSQL (main) + Redis (cache/locks)
Queue: BullMQ / Temporal.io
Real-time: Socket.io / GraphQL Subscriptions
```

**Deployment**:
```
Vercel/Netlify (Frontend)
Railway/Fly.io (Backend)
Supabase/Neon (Database)
Upstash (Redis)
```

### Next Steps

1. **Phase 1**: Port RNG + Battle system (validate with test vectors)
2. **Phase 2**: Implement command execution engine
3. **Phase 3**: Migrate database schema
4. **Phase 4**: Build real-time updates
5. **Phase 5**: Gradual cutover with dual-write

---

**Document End**

*For questions or clarifications, refer to source code locations provided throughout this document.*
