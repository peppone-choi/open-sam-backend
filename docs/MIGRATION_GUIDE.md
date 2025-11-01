# OpenSAM Migration Guide
## Detailed Migration Strategy & Technical Specifications

**Related:** See ARCHITECTURE_MAPPING.md for complete file inventory

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vue.js 3 SPA (TypeScript)                          │   │
│  │  - 16 main views (v_*.php entry points)             │   │
│  │  - Component-based UI                                │   │
│  │  - State management (Pinia recommended)             │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ AJAX/Fetch API
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  api.php (Router)                                    │   │
│  │  └─> APIHelper::launch()                            │   │
│  │       - Route matching                               │   │
│  │       - Authentication                               │   │
│  │       - Error handling                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Legacy Endpoints (32 j_*.php files)                        │
│  - Direct database access                                   │
│  - Should be migrated to API layer                          │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  API Classes    │  │  Command System │                  │
│  │  (79 classes)   │  │  (93 commands)  │                  │
│  │                 │  │                 │                  │
│  │  - Auction      │  │  - General (55) │                  │
│  │  - Betting      │  │  - Nation (38)  │                  │
│  │  - Command      │  │                 │                  │
│  │  - General      │  │  Base: BaseCmd  │                  │
│  │  - Global       │  └─────────────────┘                  │
│  │  - Message      │                                        │
│  │  - Nation       │  ┌─────────────────┐                  │
│  │  - Vote         │  │  Action System  │                  │
│  │  - Troop        │  │  (161 items)    │                  │
│  └─────────────────┘  │                 │                  │
│                       │  - Items        │                  │
│                       │  - Effects      │                  │
│                       │  - Triggers     │                  │
│                       └─────────────────┘                  │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Core Functions (func_*.php - 13 files)             │   │
│  │                                                      │   │
│  │  func.php (3000+ lines)                             │   │
│  │  - Nation management                                │   │
│  │  - Image handling                                   │   │
│  │  - Refresh tracking                                 │   │
│  │                                                      │   │
│  │  func_command.php (1500+ lines)                     │   │
│  │  - Command queue                                    │   │
│  │  - Command execution                                │   │
│  │  - Turn processing                                  │   │
│  │                                                      │   │
│  │  func_process.php (2000+ lines)                     │   │
│  │  - Turn resolution                                  │   │
│  │  - Resource updates                                 │   │
│  │  - Event triggers                                   │   │
│  │                                                      │   │
│  │  process_war.php                                    │   │
│  │  - Battle simulation                                │   │
│  │  - Combat resolution                                │   │
│  │  - Casualties                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Domain Services                                     │   │
│  │  - Auction (func_auction.php)                       │   │
│  │  - Tournament (func_tournament.php)                 │   │
│  │  - History (func_history.php)                       │   │
│  │  - Legacy/Inheritance (func_legacy.php)             │   │
│  │  - Messages (func_message.php)                      │   │
│  │  - Map (func_map.php)                               │   │
│  │  - Templates (func_template.php)                    │   │
│  │  - Time Events (func_time_event.php)                │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   CONSTRAINT LAYER                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Game Rules & Validators (60+ classes)               │   │
│  │                                                      │   │
│  │  - Permission checks (BeChief, BeLord, etc.)        │   │
│  │  - Resource requirements (ReqCityValue, etc.)       │   │
│  │  - State validation (AllowWar, AllowRebellion)      │   │
│  │  - Spatial constraints (NearCity, HasRoute)         │   │
│  │  - Diplomatic rules (AllowDiplomacy*)               │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ORM (Illuminate/Eloquent)                           │   │
│  │  Database Wrapper (MeekroDB)                         │   │
│  │                                                      │   │
│  │  DB.php - Connection management                     │   │
│  │  - MySQL connection pooling                         │   │
│  │  - Query building                                   │   │
│  │  - Transaction management                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DTOs (14 classes)                                   │   │
│  │  - AuctionInfo, BettingInfo, VoteInfo               │   │
│  │  - MenuItem, GeneralAccessLog                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Enums (16 classes)                                  │   │
│  │  - Column definitions                                │   │
│  │  - Type constants                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MySQL Database                                      │   │
│  │                                                      │   │
│  │  Core Tables:                                        │   │
│  │  - general (players/characters)                     │   │
│  │  - nation (kingdoms/factions)                       │   │
│  │  - city (territories)                               │   │
│  │  - command (action queue)                           │   │
│  │  - history (event log)                              │   │
│  │  - message (communications)                         │   │
│  │  - auction (marketplace)                            │   │
│  │  - betting (wagering)                               │   │
│  │  - vote (governance)                                │   │
│  │  - diplomacy (relations)                            │   │
│  │  - troop (military units)                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Root Database (Multi-server)                        │   │
│  │  - user (accounts)                                   │   │
│  │  - system (global settings)                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  File Storage                                        │   │
│  │  - KVStorage (key-value pairs)                      │   │
│  │  - FileDB (file-based data)                         │   │
│  │  - User uploads (avatars)                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  i_entrance/ (Server Selection)                      │   │
│  │  - entrance.php (lobby)                              │   │
│  │  - user_info.php (profile)                           │   │
│  │  - 12 API endpoints (j_*.php)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  oauth_kakao/ (OAuth Provider)                       │   │
│  │  - oauth.php (callback)                              │   │
│  │  - join.php (registration)                           │   │
│  │  - 6 API endpoints (j_*.php)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Session Management                                  │   │
│  │  - Session.php (state management)                   │   │
│  │  - Login APIs (LoginByID, LoginByToken)             │   │
│  │  - Nonce generation (ReqNonce)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Kakao Platform                                      │   │
│  │  - OAuth 2.0 (login)                                │   │
│  │  - Messaging API (OTP delivery)                     │   │
│  │  - REST API (user info)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Request Flow Examples

### Example 1: Player Login

```
1. User visits index.php (root)
   GET /

2. Clicks "Kakao Login"
   → Redirects to Kakao OAuth
   → User authorizes

3. Kakao callback
   GET /oauth_kakao/oauth.php?code=XXX
   
4. oauth.php processes
   → Calls Kakao API for user info
   → Creates/updates user in RootDB
   → Creates session (Session.php)
   → Sets cookies

5. Redirect to entrance
   GET /i_entrance/entrance.php
   
6. User selects server
   → Loads server list via j_server_get_status.php
   → Displays available servers

7. User clicks server
   → Redirects to /hwe/index.php
   
8. Game loads
   → Vue.js app initializes
   → Fetches j_basic_info.php (generalID, nation, etc.)
   → Loads game state
   → Ready to play
```

### Example 2: Execute Command (Found Nation)

```
1. User clicks "Found Nation" in UI
   Vue component emits action

2. Frontend API call
   POST /hwe/api.php?path=Command/PushCommand
   Body: {
     commandType: "che_건국",
     args: {
       nationName: "Shu Han",
       nationColor: "#FF0000"
     }
   }

3. api.php routes request
   APIHelper::launch('sammo/API/Command/PushCommand', params)

4. PushCommand.php executes
   → Validates session (Session::requireGameLogin())
   → Loads general data
   → Validates command constraints:
     - NotBeNeutral.php ✓
     - ReqGeneralValue (resources) ✓
     - CheckNationNameDuplicate ✓
   
5. Command queued
   → func_command.php::pushCommand()
   → Inserts into `command` table
   → Returns success

6. Turn processing (triggered by timer)
   → proc.php or ExecuteEngine.php
   → func_process.php::processTurn()
   → Loads commands for current turn
   → Executes che_건국.php command class
     - Creates nation record
     - Updates general's nation
     - Deducts resources
     - Logs history
   → Commits transaction

7. Frontend updates
   → Polls j_basic_info.php
   → Sees myNationID changed
   → Refreshes nation info
   → Shows "Nation founded!" notification
```

### Example 3: Battle Resolution

```
1. General A attacks General B's city
   Command: che_출병.php (Deploy)
   Target: City X

2. Turn processes
   → func_process.php identifies attacking command
   → Loads defender info
   → Calls process_war.php::resolveBattle()

3. Battle simulation
   → Loads both generals' stats
   → Applies ActionItem effects (weapons, horses, books)
   → Applies ActionSpecialWar (combat skills)
   → Applies terrain modifiers
   → Applies unit type advantages
   → Calculates combat power
   → Simulates rounds of combat
   → Determines winner, casualties, loot

4. Results applied
   → Updates general stats (troops, exp)
   → Updates city ownership if captured
   → Logs to history table
   → Sends messages to both players
   → Updates nation power rankings

5. Notifications
   → Players see battle report
   → Map updates with new city owner
   → History page shows event
```

---

## 3. Database Schema (Inferred)

### Core Tables

#### general (Player Characters)
```sql
CREATE TABLE general (
  no INT PRIMARY KEY AUTO_INCREMENT,
  owner INT NOT NULL,              -- User ID (foreign key to user table)
  name VARCHAR(255),
  nation INT,                      -- Nation ID
  city INT,                        -- Current city
  officer_level INT,               -- Rank (12 = chief)
  permission INT,                  -- Access level
  belong INT,                      -- Affiliation
  penalty INT,                     -- Restrictions
  
  -- Stats
  leadership INT,                  -- 통솔
  strength INT,                    -- 무력
  intel INT,                       -- 지력
  
  -- Resources
  gold INT,
  rice INT,
  
  -- Military
  crew INT,                        -- Troops
  crew_type INT,                   -- Unit type
  atmos INT,                       -- Morale
  train INT,                       -- Training
  
  -- Items
  item_weapon VARCHAR(255),
  item_armor VARCHAR(255),
  item_book VARCHAR(255),
  item_horse VARCHAR(255),
  
  -- Time
  turntime DATETIME,
  
  -- Skills
  special_war VARCHAR(255),        -- Combat special
  special_dom VARCHAR(255),        -- Domestic special
  
  INDEX(owner),
  INDEX(nation),
  INDEX(city)
);
```

#### nation (Kingdoms/Factions)
```sql
CREATE TABLE nation (
  nation INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  color VARCHAR(7),                -- Hex color
  type VARCHAR(255),               -- Nation type (che_유가, etc.)
  level INT,                       -- Nation tier
  capital INT,                     -- Capital city ID
  
  -- Resources
  gold INT,
  rice INT,
  tech INT,                        -- Technology level
  
  -- Stats
  gennum INT,                      -- General count
  power INT,                       -- Total power
  
  -- Settings
  notice TEXT,                     -- Nation notice
  bill TEXT,                       -- Laws/bills
  rate_exp INT,                    -- Experience rate
  rate_gold INT,                   -- Gold tax
  rate_rice INT,                   -- Rice tax
  
  -- Diplomacy
  block_war BOOLEAN,
  block_scout BOOLEAN,
  
  INDEX(name)
);
```

#### city (Territories)
```sql
CREATE TABLE city (
  city INT PRIMARY KEY,
  name VARCHAR(255),
  nation INT,                      -- Owning nation
  
  -- Position
  x INT,
  y INT,
  
  -- Resources
  agriculture INT,                 -- Farm capacity
  commerce INT,                    -- Trade capacity
  security INT,                    -- Security level
  defense INT,                     -- Wall strength
  
  -- Population
  pop INT,                         -- Population
  pop_max INT,                     -- Population cap
  
  -- Special
  trust INT,                       -- Loyalty
  trader INT,                      -- Market level
  
  INDEX(nation)
);
```

#### command (Action Queue)
```sql
CREATE TABLE command (
  id INT PRIMARY KEY AUTO_INCREMENT,
  general_id INT NOT NULL,
  nation_id INT,                   -- NULL for general commands
  
  turn_count INT,                  -- Execution turn
  command VARCHAR(255),            -- Command class name
  arg JSON,                        -- Command arguments
  
  reserved BOOLEAN,                -- Future command
  repeat_mode INT,                 -- Repeat behavior
  
  created_at DATETIME,
  
  INDEX(general_id, turn_count),
  INDEX(nation_id, turn_count)
);
```

#### history (Event Log)
```sql
CREATE TABLE history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE,                       -- Game year/month
  
  type VARCHAR(50),                -- Event type
  sub_type VARCHAR(50),
  
  general_id INT,
  nation_id INT,
  city_id INT,
  
  message TEXT,                    -- Event description
  detail JSON,                     -- Additional data
  
  created_at DATETIME,
  
  INDEX(date),
  INDEX(type),
  INDEX(general_id)
);
```

#### message (Player Communications)
```sql
CREATE TABLE message (
  id INT PRIMARY KEY AUTO_INCREMENT,
  from_general_id INT,
  to_general_id INT,
  
  type INT,                        -- MessageType enum
  message TEXT,
  
  read_at DATETIME,
  created_at DATETIME,
  
  -- For special messages
  response JSON,
  
  INDEX(to_general_id, read_at),
  INDEX(from_general_id)
);
```

#### auction
```sql
CREATE TABLE auction (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(50),                -- buy_rice, sell_rice, unique_item
  
  seller_id INT,
  
  -- Item details
  item_type VARCHAR(255),
  item_name VARCHAR(255),
  
  -- Pricing
  start_price INT,
  current_price INT,
  buyout_price INT,
  
  -- Bidding
  current_bidder_id INT,
  
  -- Timing
  close_date DATETIME,
  
  status VARCHAR(20),              -- active, closed, cancelled
  
  INDEX(type, status),
  INDEX(close_date)
);
```

#### betting
```sql
CREATE TABLE betting (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  bet_type VARCHAR(50),            -- nation_tournament, etc.
  target_id INT,                   -- Nation ID or other target
  
  general_id INT,                  -- Bettor
  amount INT,                      -- Bet amount
  
  result VARCHAR(20),              -- win, lose, pending
  payout INT,
  
  created_at DATETIME,
  resolved_at DATETIME,
  
  INDEX(general_id),
  INDEX(bet_type, result)
);
```

#### vote
```sql
CREATE TABLE vote (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nation_id INT,
  
  creator_id INT,
  title VARCHAR(255),
  description TEXT,
  
  options JSON,                    -- Vote choices
  votes JSON,                      -- Vote tallies
  
  close_date DATETIME,
  status VARCHAR(20),
  
  created_at DATETIME,
  
  INDEX(nation_id, status)
);
```

#### diplomacy
```sql
CREATE TABLE diplomacy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  from_nation INT,
  to_nation INT,
  
  type VARCHAR(50),                -- non_aggression, war, ceasefire
  status VARCHAR(20),              -- proposed, accepted, rejected, active
  
  terms JSON,
  
  proposed_at DATETIME,
  accepted_at DATETIME,
  expires_at DATETIME,
  
  INDEX(from_nation, to_nation),
  INDEX(status)
);
```

#### troop
```sql
CREATE TABLE troop (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  nation_id INT,
  leader_id INT,                   -- General ID
  
  name VARCHAR(255),
  members JSON,                    -- Array of general IDs
  
  created_at DATETIME,
  
  INDEX(nation_id),
  INDEX(leader_id)
);
```

### Root Database Tables

#### user (Account System)
```sql
CREATE TABLE user (
  NO INT PRIMARY KEY AUTO_INCREMENT,
  ID VARCHAR(255) UNIQUE,          -- Username
  PW VARCHAR(255),                 -- Hashed password
  
  -- Kakao OAuth
  KAKAO_ID VARCHAR(255),
  OAUTH_TOKEN TEXT,
  
  -- Profile
  ICON_PATH VARCHAR(255),          -- Avatar
  LAST_LOGIN DATETIME,
  
  -- Permissions
  GRADE INT,                       -- User level
  ACL JSON,                        -- Access control
  
  -- Settings
  DISALLOW_THIRD_USE BOOLEAN,      -- Privacy setting
  
  created_at DATETIME,
  
  INDEX(ID),
  INDEX(KAKAO_ID)
);
```

#### system
```sql
CREATE TABLE system (
  NO INT PRIMARY KEY,
  NOTICE TEXT,                     -- Global notice
  MAINTENANCE BOOLEAN,
  
  -- Stats
  TOTAL_USERS INT,
  ACTIVE_SERVERS INT,
  
  updated_at DATETIME
);
```

---

## 4. Migration Roadmap

### Phase 1: Foundation (Weeks 1-4)

#### Week 1: Setup & Documentation
- [ ] Set up new project repository
- [ ] Document all database schemas
- [ ] Create entity relationship diagrams
- [ ] Document all game formulas and rules
- [ ] Set up development environment

#### Week 2: Test Coverage
- [ ] Add unit tests for critical functions
  - Turn processing (func_process.php)
  - Command execution (func_command.php)
  - Battle resolution (process_war.php)
- [ ] Add integration tests for API endpoints
- [ ] Achieve 70%+ coverage on core logic

#### Week 3: Database Migration
- [ ] Create migration scripts
- [ ] Set up Eloquent models
- [ ] Implement repositories pattern
- [ ] Add database seeders
- [ ] Test data integrity

#### Week 4: Authentication
- [ ] Migrate Session.php to JWT
- [ ] Implement OAuth 2.0 server
- [ ] Keep Kakao OAuth integration
- [ ] Add API key authentication
- [ ] Implement rate limiting

### Phase 2: Core APIs (Weeks 5-8)

#### Week 5: API Framework
- [ ] Set up Laravel/Symfony/FastAPI
- [ ] Create base API controllers
- [ ] Implement middleware stack
  - Authentication
  - Authorization
  - Rate limiting
  - CORS
  - Request validation
- [ ] Set up API versioning (v1, v2)
- [ ] Add Swagger/OpenAPI documentation

#### Week 6: Read APIs
Migrate read-only endpoints:
- [ ] General APIs (GetFrontInfo, GetCommandTable, etc.)
- [ ] Global APIs (GetMap, GetNationList, etc.)
- [ ] Nation APIs (GetNationInfo, GeneralList, etc.)
- [ ] Message APIs (GetRecentMessage, GetContactList, etc.)

#### Week 7: Write APIs
Migrate mutation endpoints:
- [ ] Command APIs (PushCommand, ReserveCommand, etc.)
- [ ] Message APIs (SendMessage, DeleteMessage, etc.)
- [ ] Vote APIs (NewVote, Vote, AddComment)
- [ ] Troop APIs (NewTroop, JoinTroop, etc.)

#### Week 8: Complex APIs
Migrate specialized systems:
- [ ] Auction APIs (all 9 endpoints)
- [ ] Betting APIs (all 3 endpoints)
- [ ] InheritAction APIs (all 8 endpoints)
- [ ] Admin APIs (BanEmailAddress, etc.)

### Phase 3: Business Logic (Weeks 9-12)

#### Week 9: Service Layer
Extract logic from func_*.php into services:
- [ ] NationService (from func.php)
- [ ] CommandService (from func_command.php)
- [ ] TurnService (from func_process.php)
- [ ] HistoryService (from func_history.php)
- [ ] MessageService (from func_message.php)

#### Week 10: Domain Services
Create specialized services:
- [ ] AuctionService (from func_auction.php)
- [ ] TournamentService (from func_tournament.php)
- [ ] LegacyService (from func_legacy.php)
- [ ] MapService (from func_map.php)
- [ ] TimeEventService (from func_time_event.php)

#### Week 11: Command System
Refactor command classes:
- [ ] Create CommandInterface
- [ ] Implement CommandBus
- [ ] Add command validation pipeline
- [ ] Implement command handlers
- [ ] Add command logging

#### Week 12: Battle System
Migrate battle logic:
- [ ] Extract battle formulas
- [ ] Create BattleService
- [ ] Implement damage calculation
- [ ] Add battle replay system
- [ ] Test battle outcomes

### Phase 4: Game Content (Weeks 13-16)

#### Week 13: Item System
Migrate ActionItem/* (161 files):
- [ ] Create Item interface
- [ ] Implement ItemEffect system
- [ ] Migrate all item classes
- [ ] Add item validation
- [ ] Test item effects

#### Week 14: Command Migration
Migrate Command/* classes:
- [ ] General commands (55 files)
- [ ] Nation commands (38 files)
- [ ] Validate all constraints
- [ ] Test command execution
- [ ] Add command history

#### Week 15: Action Systems
Migrate Action* classes:
- [ ] ActionNationType (15 files)
- [ ] ActionPersonality (12 files)
- [ ] ActionSpecialDomestic (28 files)
- [ ] ActionSpecialWar (18 files)
- [ ] ActionCrewType
- [ ] ActionScenarioEffect

#### Week 16: Constraints & Rules
Migrate Constraint/* (60+ files):
- [ ] Create ConstraintInterface
- [ ] Implement validation chain
- [ ] Migrate all constraint classes
- [ ] Add constraint composition
- [ ] Test rule enforcement

### Phase 5: Frontend (Weeks 17-20)

#### Week 17: Build System
- [ ] Migrate from Webpack to Vite
- [ ] Add TypeScript support
- [ ] Configure build optimization
- [ ] Set up hot module replacement
- [ ] Add environment configs

#### Week 18: Component Migration
- [ ] Update to Vue 3 Composition API
- [ ] Add TypeScript to components
- [ ] Implement Pinia store
- [ ] Create composables
- [ ] Add component tests

#### Week 19: API Integration
- [ ] Create typed API client
- [ ] Add request/response types
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Implement optimistic updates

#### Week 20: UI Enhancement
- [ ] Replace Bootstrap with Tailwind
- [ ] Add Headless UI components
- [ ] Improve mobile responsive
- [ ] Add dark mode
- [ ] Optimize performance

### Phase 6: Infrastructure (Weeks 21-24)

#### Week 21: Caching
- [ ] Set up Redis
- [ ] Cache nation data
- [ ] Cache map data
- [ ] Cache general lists
- [ ] Implement cache invalidation

#### Week 22: Queue System
- [ ] Set up Redis Queue or RabbitMQ
- [ ] Move turn processing to queue
- [ ] Queue notification emails
- [ ] Queue battle resolution
- [ ] Add job monitoring

#### Week 23: Monitoring
- [ ] Add application logging
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring (New Relic)
- [ ] Create admin dashboard
- [ ] Set up alerts

#### Week 24: Deployment
- [ ] Containerize with Docker
- [ ] Set up CI/CD pipeline
- [ ] Configure load balancer
- [ ] Set up database replication
- [ ] Create rollback plan

### Phase 7: Testing & Launch (Weeks 25-28)

#### Week 25: Testing
- [ ] End-to-end tests
- [ ] Load testing
- [ ] Security testing
- [ ] Penetration testing
- [ ] User acceptance testing

#### Week 26: Beta Launch
- [ ] Deploy to staging
- [ ] Invite beta testers
- [ ] Gather feedback
- [ ] Fix bugs
- [ ] Optimize performance

#### Week 27: Documentation
- [ ] API documentation
- [ ] Developer guide
- [ ] Admin guide
- [ ] User guide
- [ ] Deployment guide

#### Week 28: Production Launch
- [ ] Final security audit
- [ ] Database migration
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Celebrate! 🎉

---

## 5. Technology Stack Comparison

### Current Stack
```
Backend:
  - PHP 7.4+
  - MeekroDB
  - Illuminate/Eloquent
  - League/Plates (templates)
  
Frontend:
  - Vue.js 2/3
  - Bootstrap
  - Webpack
  - Some TypeScript
  
Database:
  - MySQL/MariaDB
  
Infrastructure:
  - Apache/Nginx
  - File-based sessions
  - No caching layer
  - No queue system
```

### Recommended New Stack

#### Option A: PHP Modern
```
Backend:
  - PHP 8.2+
  - Laravel 10
  - Eloquent ORM
  - Laravel Sanctum (API auth)
  - Laravel Queue
  
Frontend:
  - Vue 3 (Composition API)
  - TypeScript
  - Vite
  - Tailwind CSS
  - Pinia (state)
  
Database:
  - MySQL 8.0
  - Redis (cache + queue)
  
Infrastructure:
  - Nginx
  - Docker
  - Redis
  - Laravel Horizon (queue monitoring)
  - Laravel Telescope (debugging)
```

#### Option B: Node.js
```
Backend:
  - Node.js 18+
  - NestJS (TypeScript)
  - TypeORM
  - Passport.js (auth)
  - Bull (queue)
  
Frontend:
  - Vue 3 (Composition API)
  - TypeScript
  - Vite
  - Tailwind CSS
  - Pinia
  
Database:
  - MySQL 8.0
  - Redis
  
Infrastructure:
  - Nginx
  - Docker
  - Redis
  - Bull Dashboard
  - PM2
```

#### Option C: Python
```
Backend:
  - Python 3.11+
  - FastAPI
  - SQLAlchemy
  - Pydantic (validation)
  - Celery (queue)
  
Frontend:
  - Vue 3
  - TypeScript
  - Vite
  - Tailwind CSS
  - Pinia
  
Database:
  - MySQL 8.0
  - Redis
  
Infrastructure:
  - Nginx
  - Docker
  - Redis
  - Flower (Celery monitoring)
  - Uvicorn
```

### Recommendation: **Option A (Laravel)**

**Reasons:**
1. **Familiarity**: Team already knows PHP
2. **Ecosystem**: Laravel has excellent tooling
3. **Migration**: Easier to migrate PHP → PHP than PHP → Node/Python
4. **Community**: Large community, lots of packages
5. **Performance**: PHP 8.2+ is very fast
6. **Real-time**: Laravel Echo for WebSockets
7. **Queue**: Laravel Queue is robust
8. **Testing**: PHPUnit integration
9. **Admin**: Laravel Nova for admin panel
10. **Documentation**: Excellent documentation

---

## 6. Critical Code Preservation

### Must-Preserve Functions

#### func_process.php
```php
// Turn processing core - DO NOT LOSE
function processTurn($year, $month)
function applyCommand($general, $command)
function calculateResourceProduction($city)
function updateNationPower($nation)
```

#### process_war.php
```php
// Battle simulation - CRITICAL
function resolveBattle($attacker, $defender, $city)
function calculateCombatPower($general)
function applyWarSpecials($general, $enemy)
function calculateCasualties($attacker, $defender, $result)
```

#### func_command.php
```php
// Command queue - ESSENTIAL
function pushCommand($general, $commandType, $args)
function reserveCommand($general, $commandType, $args, $turn)
function executeCommand($command)
```

#### func.php
```php
// Nation management - IMPORTANT
function getNationStaticInfo($nationID)
function refreshNationStaticInfo()
```

### Game Balance Constants

**Extract and preserve all constants from:**
- GameConst (base game rules)
- GameUnitConst (unit stats)
- CityConst (city definitions)
- All ActionItem/* effect values
- All Command/* cost/effect values

### Formulas to Document

1. **Combat Power Calculation**
2. **Resource Production Rates**
3. **Experience Gain Formula**
4. **Item Effect Multipliers**
5. **Special Skill Effects**
6. **Diplomacy Mechanics**
7. **Auction Pricing**
8. **Betting Odds**
9. **Turn Time Calculation**
10. **Penalty System**

---

## 7. API Design Patterns

### RESTful API Structure

```
GET    /api/v1/generals              # List generals
GET    /api/v1/generals/:id          # Get general
POST   /api/v1/generals              # Create general
PUT    /api/v1/generals/:id          # Update general
DELETE /api/v1/generals/:id          # Delete general

GET    /api/v1/nations               # List nations
GET    /api/v1/nations/:id           # Get nation
GET    /api/v1/nations/:id/generals  # Nation's generals
POST   /api/v1/nations               # Found nation
PUT    /api/v1/nations/:id           # Update nation
DELETE /api/v1/nations/:id           # Dissolve nation

POST   /api/v1/commands              # Queue command
GET    /api/v1/commands              # List commands
DELETE /api/v1/commands/:id          # Cancel command

GET    /api/v1/map                   # Get map
GET    /api/v1/map/cities            # List cities
GET    /api/v1/map/cities/:id        # Get city

POST   /api/v1/messages              # Send message
GET    /api/v1/messages              # List messages
GET    /api/v1/messages/:id          # Get message
DELETE /api/v1/messages/:id          # Delete message

GET    /api/v1/auctions              # List auctions
POST   /api/v1/auctions              # Create auction
POST   /api/v1/auctions/:id/bid      # Place bid

GET    /api/v1/votes                 # List votes
POST   /api/v1/votes                 # Create vote
POST   /api/v1/votes/:id/vote        # Cast vote
```

### GraphQL Alternative

```graphql
type Query {
  me: General
  general(id: ID!): General
  generals(nation: ID): [General!]!
  
  nation(id: ID!): Nation
  nations: [Nation!]!
  
  map: Map
  city(id: ID!): City
  
  messages(limit: Int): [Message!]!
  auctions(type: AuctionType): [Auction!]!
  votes(status: VoteStatus): [Vote!]!
}

type Mutation {
  queueCommand(input: CommandInput!): Command!
  foundNation(input: NationInput!): Nation!
  sendMessage(to: ID!, message: String!): Message!
  placeBid(auctionId: ID!, amount: Int!): Auction!
  castVote(voteId: ID!, option: Int!): Vote!
}

type Subscription {
  turnProcessed: Turn!
  messageReceived: Message!
  battleResolved: Battle!
}
```

---

## 8. Security Considerations

### Current Vulnerabilities (to fix)

1. **SQL Injection**
   - Some raw queries in j_*.php files
   - Need parameterized queries everywhere

2. **XSS**
   - User-generated content (notices, messages)
   - Need proper escaping

3. **CSRF**
   - No CSRF tokens on j_*.php endpoints
   - Need CSRF protection

4. **Session Hijacking**
   - File-based sessions
   - Need secure session storage

5. **Rate Limiting**
   - No rate limiting
   - Need API throttling

### Security Improvements

```php
// Before (vulnerable)
$db->query("SELECT * FROM general WHERE name = '{$_POST['name']}'");

// After (safe)
$db->query("SELECT * FROM general WHERE name = %s", $_POST['name']);
// Or with Eloquent:
General::where('name', $request->input('name'))->first();
```

```php
// Add CSRF protection
Route::post('/api/commands', [CommandController::class, 'store'])
    ->middleware(['auth:sanctum', 'throttle:60,1']);
```

```php
// Add rate limiting
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});
```

---

## 9. Performance Optimization

### Caching Strategy

```php
// Cache nation list (expires every turn)
$nations = Cache::remember('nations_list', $turnTime, function () {
    return Nation::all();
});

// Cache map data (expires every 5 minutes)
$map = Cache::remember('map_data', 300, function () {
    return Map::with(['cities', 'nations'])->get();
});

// Cache general info (expires on action)
$general = Cache::tags(['general:'.$id])->remember('general_info:'.$id, 3600, function () use ($id) {
    return General::with(['nation', 'city', 'items'])->find($id);
});

// Invalidate on update
Cache::tags(['general:'.$general->id])->flush();
```

### Database Optimization

```sql
-- Add indexes
CREATE INDEX idx_general_nation ON general(nation);
CREATE INDEX idx_general_city ON general(city);
CREATE INDEX idx_command_turn ON command(turn_count, general_id);
CREATE INDEX idx_message_to_read ON message(to_general_id, read_at);

-- Add composite indexes
CREATE INDEX idx_general_nation_officer ON general(nation, officer_level);
CREATE INDEX idx_city_nation_defense ON city(nation, defense);
```

### Query Optimization

```php
// Before: N+1 query problem
$generals = General::all();
foreach ($generals as $general) {
    echo $general->nation->name; // N queries!
}

// After: Eager loading
$generals = General::with('nation')->get();
foreach ($generals as $general) {
    echo $general->nation->name; // 1 query!
}
```

---

## 10. Monitoring & Observability

### Key Metrics to Track

1. **Turn Processing Time**
   - Target: < 5 seconds per turn
   - Alert if > 10 seconds

2. **API Response Time**
   - Target: < 200ms (p95)
   - Alert if > 500ms

3. **Active Users**
   - Track concurrent users
   - Track daily active users

4. **Command Queue Length**
   - Monitor queue depth
   - Alert if queue backup

5. **Database Performance**
   - Slow query log
   - Connection pool usage

6. **Error Rate**
   - Target: < 0.1%
   - Alert if > 1%

### Logging Strategy

```php
// Structured logging
Log::info('Command queued', [
    'general_id' => $general->id,
    'command' => $commandType,
    'turn' => $turnCount,
]);

Log::warning('Battle took too long', [
    'battle_id' => $battle->id,
    'duration' => $duration,
    'threshold' => 1000,
]);

Log::error('Command execution failed', [
    'command_id' => $command->id,
    'error' => $e->getMessage(),
    'trace' => $e->getTraceAsString(),
]);
```

---

## Summary

This migration guide provides a comprehensive 28-week plan to modernize the OpenSAM game backend and frontend. The phased approach ensures:

1. **Minimal disruption** - Gradual migration with testing at each phase
2. **Risk mitigation** - Core logic preserved and tested thoroughly
3. **Modern stack** - Laravel + Vue 3 + TypeScript + Redis
4. **Better performance** - Caching, queues, optimization
5. **Improved security** - Authentication, authorization, rate limiting
6. **Scalability** - Containerization, load balancing, replication
7. **Maintainability** - Clean architecture, documentation, tests

The total estimated time is **6-7 months** with a team of 2-3 developers.

For questions or clarifications, refer to ARCHITECTURE_MAPPING.md for detailed file inventory.

---

*End of Migration Guide*
