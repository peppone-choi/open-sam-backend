# OpenSAM Database Schema Documentation

## Overview

OpenSAM uses a **dual-database architecture**:

1. **Root Database (Common/Shared)** - Multi-server shared data (User authentication, sessions, logs)
2. **Game Database (Per-Server)** - Per-server game state (Generals, Nations, Cities, etc.)
3. **SQLite Logs** - Separate SQLite databases for error and API logging

## Database Technology

- **Primary Engine**: MariaDB/MySQL with **Aria** storage engine
- **Charset**: `utf8mb4_general_ci` (supports Korean and emoji)
- **JSON Validation**: Extensive use of JSON columns with `json_valid()` constraints
- **High-precision timestamps**: DATETIME(6) for microsecond precision

---

## 1. ROOT DATABASE (Common Schema)

**File**: `/core/f_install/sql/common_schema.sql`

This database is shared across all game servers and handles user authentication, sessions, and cross-server data.

### 1.1 `system` - System Configuration

**Purpose**: Global system settings and flags

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| NO | INT(11) | PK, AUTO_INCREMENT | System settings ID |
| REG | VARCHAR(1) | DEFAULT 'N' | Registration enabled flag |
| LOGIN | VARCHAR(1) | DEFAULT 'N' | Login enabled flag |
| NOTICE | VARCHAR(256) | DEFAULT '' | System notice message |
| CRT_DATE | DATETIME | NULL | Creation timestamp |
| MDF_DATE | DATETIME | NULL | Modification timestamp |

**Indexes**:
- PRIMARY KEY (`NO`)

**Notes**: Planned migration to key-value storage

---

### 1.2 `member` - User Accounts

**Purpose**: Core user authentication and profile data

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| NO | INT(11) | PK, AUTO_INCREMENT | User ID |
| oauth_id | BIGINT(20) | NULL, UNIQUE | OAuth provider ID |
| ID | VARCHAR(64) | NOT NULL, UNIQUE | Username/login ID |
| EMAIL | VARCHAR(64) | NULL, UNIQUE | Email address |
| oauth_type | ENUM | NOT NULL | OAuth provider: 'NONE', 'KAKAO' |
| oauth_info | TEXT | DEFAULT '{}' | OAuth metadata (JSON) |
| token_valid_until | DATETIME | NULL | OAuth token expiration |
| PW | CHAR(128) | NOT NULL | Password hash |
| salt | CHAR(16) | NOT NULL | Password salt |
| third_use | INT(1) | DEFAULT 0 | Third-party service usage flag |
| NAME | VARCHAR(64) | NOT NULL | Display name |
| PICTURE | VARCHAR(64) | DEFAULT 'default.jpg' | Profile picture filename |
| IMGSVR | INT(1) | DEFAULT 0 | Image server ID |
| acl | TEXT | DEFAULT '{}' | Access control list (JSON) |
| penalty | TEXT | DEFAULT '{}' | User penalties (JSON) |
| GRADE | INT(1) | DEFAULT 1 | User grade/tier |
| REG_NUM | INT(3) | DEFAULT 0 | Registration count |
| REG_DATE | DATETIME | NOT NULL | Registration date |
| BLOCK_NUM | INT(3) | DEFAULT 0 | Block count |
| BLOCK_DATE | DATETIME | NULL | Last block date |
| delete_after | DATE | NULL | Scheduled deletion date |

**Indexes**:
- PRIMARY KEY (`NO`)
- UNIQUE INDEX `ID` (`ID`)
- UNIQUE INDEX `EMAIL` (`EMAIL`)
- UNIQUE INDEX `kauth_id` (`oauth_id`)
- INDEX `delete_after` (`delete_after`)

**Constraints**:
- `json1`: CHECK (json_valid(`acl`))
- `json2`: CHECK (json_valid(`penalty`))

**Critical for Migration**: YES - Core authentication table

---

### 1.3 `member_log` - User Activity Log

**Purpose**: Audit trail for user actions

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | BIGINT(20) | PK, AUTO_INCREMENT | Log entry ID |
| member_no | INT(11) | NOT NULL | User ID (FK to member.NO) |
| date | DATETIME | DEFAULT CURRENT_TIMESTAMP | Action timestamp |
| action_type | ENUM | NOT NULL | Action type (see below) |
| action | TEXT | NULL | Additional action data (JSON) |

**Action Types**:
- `reg` - Registration
- `try_login` - Login attempt
- `login` - Successful login
- `logout` - Logout
- `oauth` - OAuth action
- `change_pw` - Password change
- `make_general` - General creation
- `access_server` - Server access
- `delete` - Account deletion

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `action` (`member_no`, `action_type`, `date`)
- INDEX `member` (`member_no`, `date`)

**Constraints**:
- `json`: CHECK (json_valid(`action`))

---

### 1.4 `storage` - Key-Value Storage

**Purpose**: Generic key-value storage with namespacing

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Storage entry ID |
| namespace | VARCHAR(40) | NOT NULL | Storage namespace |
| key | VARCHAR(40) | NOT NULL | Key name |
| value | TEXT | NOT NULL | JSON value |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `key` (`namespace`, `key`)

**Constraints**:
- `json`: CHECK (json_valid(`value`))

---

### 1.5 `login_token` - Session Tokens

**Purpose**: User session management

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Token ID |
| user_id | INT(11) | NOT NULL | User ID (FK to member.NO) |
| base_token | VARCHAR(20) | NOT NULL, UNIQUE | Session token |
| reg_ip | VARCHAR(40) | NOT NULL | Registration IP address |
| reg_date | DATETIME | NOT NULL | Token creation date |
| expire_date | DATETIME | NOT NULL | Token expiration date |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `by_token` (`base_token`)
- INDEX `by_date` (`user_id`, `expire_date`)

**Critical for Migration**: YES - Session management

---

### 1.6 `banned_member` - Banned Users

**Purpose**: Permanent ban list by hashed email

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT | PK, AUTO_INCREMENT | Ban entry ID |
| hashed_email | VARCHAR(128) | NOT NULL, UNIQUE | SHA512(salt + email + salt) |
| info | TEXT | NULL | Ban reason/metadata |

**Indexes**:
- PRIMARY KEY (`no`)
- UNIQUE INDEX `email` (`hashed_email`(128))

---

## 2. GAME DATABASE (Per-Server Schema)

**File**: `/core/hwe/sql/schema.sql`

Each game server instance has its own database containing game state.

### 2.1 `general` - Player Characters/Generals

**Purpose**: Core character data (players and NPCs)

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | General ID |
| owner | INT(11) | DEFAULT 0 | User ID (FK to member.NO in root DB) |
| npcmsg | TEXT | DEFAULT '' | NPC message |
| npc | INT(1) | DEFAULT 0 | Is NPC flag (0=player, 1=NPC) |
| npc_org | INT(1) | NULL | Original NPC status |
| affinity | INT(3) | DEFAULT 0 | Affinity/loyalty value |
| bornyear | INT(3) | DEFAULT 180 | Birth year |
| deadyear | INT(3) | DEFAULT 300 | Death year |
| newmsg | INT(1) | DEFAULT 0 | New message flag |
| picture | VARCHAR(40) | NOT NULL | Character portrait filename |
| imgsvr | INT(1) | DEFAULT 0 | Image server ID |
| name | VARCHAR(32) | NOT NULL | Character name (utf8mb4_bin) |
| owner_name | VARCHAR(32) | NULL | Owner's display name |
| nation | INT(6) | DEFAULT 0 | Nation ID (FK to nation.nation) |
| city | INT(6) | DEFAULT 3 | Current city ID (FK to city.city) |
| troop | INT(6) | DEFAULT 0 | Troop ID (FK to troop.troop_leader) |
| leadership | INT(3) | DEFAULT 50 | Leadership stat (1-100) |
| leadership_exp | INT(3) | DEFAULT 0 | Leadership experience |
| strength | INT(3) | DEFAULT 50 | Strength stat (1-100) |
| strength_exp | INT(3) | DEFAULT 0 | Strength experience |
| intel | INT(3) | DEFAULT 50 | Intelligence stat (1-100) |
| intel_exp | INT(3) | DEFAULT 0 | Intelligence experience |
| injury | INT(2) | DEFAULT 0 | Injury level |
| experience | INT(6) | DEFAULT 0 | Total experience |
| dedication | INT(6) | DEFAULT 0 | Dedication points |
| dex1-dex5 | INT(8) | DEFAULT 0 | Special abilities/dexterities |
| officer_level | INT(2) | DEFAULT 0 | Officer rank (0-12) |
| officer_city | INT(4) | DEFAULT 0 | Officer assigned city |
| permission | ENUM | DEFAULT 'normal' | 'normal', 'auditor', 'ambassador' |
| gold | INT(6) | DEFAULT 1000 | Gold resources |
| rice | INT(6) | DEFAULT 1000 | Rice resources |
| crew | INT(5) | DEFAULT 0 | Military unit count |
| crewtype | INT(2) | DEFAULT 0 | Military unit type |
| train | INT(3) | DEFAULT 0 | Training level |
| atmos | INT(3) | DEFAULT 0 | Atmosphere/morale |
| weapon | VARCHAR(20) | DEFAULT 'None' | Equipped weapon |
| book | VARCHAR(20) | DEFAULT 'None' | Equipped book |
| horse | VARCHAR(20) | DEFAULT 'None' | Equipped horse |
| item | VARCHAR(20) | DEFAULT 'None' | Equipped item |
| turntime | DATETIME(6) | NOT NULL | Last turn execution time |
| recent_war | DATETIME(6) | NULL | Most recent war participation |
| makelimit | INT(2) | DEFAULT 0 | Creation limit |
| killturn | INT(3) | NULL | Death turn number |
| block | INT(1) | DEFAULT 0 | Blocked flag |
| dedlevel | INT(2) | DEFAULT 0 | Dedication level |
| explevel | INT(2) | DEFAULT 0 | Experience level |
| age | INT(3) | DEFAULT 20 | Current age |
| startage | INT(3) | DEFAULT 20 | Starting age |
| belong | INT(2) | DEFAULT 1 | Belonging faction |
| betray | INT(2) | DEFAULT 0 | Betrayal count |
| personal | VARCHAR(20) | DEFAULT 'None' | Personal trait |
| special | VARCHAR(20) | DEFAULT 'None' | Special ability 1 |
| specage | INT(2) | DEFAULT 0 | Special 1 age acquired |
| special2 | VARCHAR(20) | DEFAULT 'None' | Special ability 2 |
| specage2 | INT(2) | DEFAULT 0 | Special 2 age acquired |
| defence_train | INT(3) | DEFAULT 80 | Defense training |
| tnmt | INT(1) | DEFAULT 1 | Tournament flag |
| myset | INT(1) | DEFAULT 6 | My settings |
| tournament | INT(1) | DEFAULT 0 | In tournament flag |
| newvote | INT(1) | DEFAULT 0 | New vote notification |
| last_turn | TEXT | DEFAULT '{}' | Last turn action data (JSON) |
| aux | LONGTEXT | DEFAULT '{}' | Auxiliary data (JSON) |
| penalty | TEXT | DEFAULT '{}' | Penalties (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)
- INDEX `nation` (`nation`, `npc`)
- INDEX `city` (`city`)
- INDEX `turntime` (`turntime`, `no`)
- INDEX `no_member` (`owner`)
- INDEX `npc` (`npc`)
- INDEX `troop` (`troop`, `turntime`)
- INDEX `officer_level` (`nation`, `officer_level`)
- INDEX `officer_city` (`officer_city`, `officer_level`)
- INDEX `name` (`name`)

**Constraints**:
- `json1`: CHECK (json_valid(`last_turn`))
- `json2`: CHECK (json_valid(`aux`))
- `json3`: CHECK (json_valid(`penalty`))

**Critical for Migration**: YES - Core game state

---

### 2.2 `general_turn` - Command Queue

**Purpose**: Stores queued commands for generals

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Turn command ID |
| general_id | INT(11) | NOT NULL | General ID (FK to general.no) |
| turn_idx | INT(4) | NOT NULL | Turn index (0-based) |
| action | VARCHAR(20) | NOT NULL | Action type identifier |
| arg | TEXT | NULL | Action arguments (JSON) |
| brief | TEXT | NULL | Action brief description |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `general_id` (`general_id`, `turn_idx`)

**Critical for Migration**: YES - Command execution system

---

### 2.3 `general_access_log` - General Activity Tracking

**Purpose**: Track general access and refresh patterns

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Log entry ID |
| general_id | INT(11) | NOT NULL, UNIQUE | General ID (FK to general.no) |
| user_id | INT(11) | NULL | User ID |
| last_refresh | DATETIME | NULL | Last page refresh |
| refresh | INT(11) | DEFAULT 0 | Session refresh count |
| refresh_total | INT(11) | DEFAULT 0 | Total refresh count |
| refresh_score | INT(11) | DEFAULT 0 | Session refresh score |
| refresh_score_total | INT(11) | DEFAULT 0 | Total refresh score |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `general_id` (`general_id`)

---

### 2.4 `nation` - Nations/Factions

**Purpose**: Nation/faction state and resources

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| nation | INT(6) | PK, AUTO_INCREMENT | Nation ID |
| name | VARCHAR(64) | NOT NULL | Nation name (utf8mb4_bin) |
| color | CHAR(10) | NOT NULL | Nation color (hex) |
| capital | INT(1) | DEFAULT 0 | Capital city ID |
| capset | INT(6) | DEFAULT 0 | Capital settings |
| gennum | INT(3) | DEFAULT 1 | General count |
| gold | INT(8) | DEFAULT 0 | National gold |
| rice | INT(8) | DEFAULT 0 | National rice |
| bill | INT(3) | DEFAULT 0 | Bill/decree count |
| rate | INT(3) | DEFAULT 0 | Tax rate |
| rate_tmp | INT(3) | DEFAULT 0 | Temporary tax rate |
| secretlimit | INT(2) | DEFAULT 3 | Secret command limit |
| chief_set | INT(11) | DEFAULT 0 | Chief settings |
| scout | INT(1) | DEFAULT 0 | Scout enabled |
| war | INT(1) | DEFAULT 0 | War state flag |
| strategic_cmd_limit | INT(4) | DEFAULT 36 | Strategic command limit |
| surlimit | INT(4) | DEFAULT 72 | Surrender limit |
| tech | FLOAT | DEFAULT 0 | Technology level |
| power | INT(8) | DEFAULT 0 | National power |
| spy | TEXT | DEFAULT '{}' | Spy data (JSON) |
| level | INT(1) | DEFAULT 0 | Nation level |
| type | VARCHAR(20) | DEFAULT 'che_중립' | Nation type |
| aux | LONGTEXT | DEFAULT '{}' | Auxiliary data (JSON) |

**Indexes**:
- PRIMARY KEY (`nation`)

**Constraints**:
- `json1`: CHECK (json_valid(`spy`))
- `json2`: CHECK (json_valid(`aux`))

**Critical for Migration**: YES - Core game state

---

### 2.5 `nation_turn` - National Commands

**Purpose**: Queued national-level commands

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Command ID |
| nation_id | INT(11) | NOT NULL | Nation ID (FK to nation.nation) |
| officer_level | INT(4) | NOT NULL | Officer level executing command |
| turn_idx | INT(4) | NOT NULL | Turn index |
| action | VARCHAR(16) | NOT NULL | Action type |
| arg | TEXT | NULL | Action arguments (JSON) |
| brief | TEXT | NULL | Action brief |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `nation` (`nation_id`, `officer_level`, `turn_idx`)

**Constraints**:
- `json`: CHECK (json_valid(`arg`))

---

### 2.6 `board` - Nation Forum/Board

**Purpose**: Nation bulletin board posts

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | Post ID |
| nation_no | INT(11) | NOT NULL | Nation ID |
| is_secret | TINYINT(1) | NOT NULL | Secret post flag |
| date | DATETIME | NOT NULL | Post date |
| general_no | INT(11) | NOT NULL | Author general ID |
| author | VARCHAR(32) | NOT NULL | Author name |
| author_icon | VARCHAR(128) | NULL | Author icon |
| title | TEXT | NOT NULL | Post title |
| text | TEXT | NOT NULL | Post content |

**Indexes**:
- PRIMARY KEY (`no`)
- INDEX `nation_no` (`nation_no`, `is_secret`, `date`)

---

### 2.7 `comment` - Forum Comments

**Purpose**: Comments on board posts

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | Comment ID |
| nation_no | INT(11) | NOT NULL | Nation ID |
| is_secret | TINYINT(1) | NOT NULL | Secret comment flag |
| date | DATETIME | NOT NULL | Comment date |
| document_no | INT(11) | NOT NULL | Parent post ID (FK to board.no) |
| general_no | INT(11) | NOT NULL | Author general ID |
| author | VARCHAR(32) | NOT NULL | Author name |
| text | TEXT | NOT NULL | Comment text |

**Indexes**:
- PRIMARY KEY (`no`)
- INDEX `nation_no` (`nation_no`, `is_secret`, `date`)
- INDEX `document_no` (`document_no`, `date`)

---

### 2.8 `city` - Cities/Territories

**Purpose**: City state and resources

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| city | INT(6) | PK, AUTO_INCREMENT | City ID |
| name | VARCHAR(64) | NOT NULL | City name |
| level | INT(1) | NOT NULL | City level |
| nation | INT(6) | DEFAULT 0 | Controlling nation ID |
| supply | INT(1) | DEFAULT 1 | Supply status |
| front | INT(1) | DEFAULT 0 | Frontline flag |
| pop | INT(7) | NOT NULL | Population |
| pop_max | INT(7) | NOT NULL | Max population |
| agri | INT(5) | NOT NULL | Agriculture value |
| agri_max | INT(5) | NOT NULL | Max agriculture |
| comm | INT(5) | NOT NULL | Commerce value |
| comm_max | INT(5) | NOT NULL | Max commerce |
| secu | INT(5) | NOT NULL | Security value |
| secu_max | INT(5) | NOT NULL | Max security |
| trust | FLOAT | NOT NULL | Trust/loyalty |
| trade | INT(3) | NULL | Trade value (100 = standard) |
| dead | INT(7) | DEFAULT 0 | Dead population |
| def | INT(5) | NOT NULL | Defense value |
| def_max | INT(5) | NOT NULL | Max defense |
| wall | INT(5) | NOT NULL | Wall value |
| wall_max | INT(5) | NOT NULL | Max wall |
| officer_set | INT(11) | DEFAULT 0 | Officer settings |
| state | INT(2) | DEFAULT 0 | City state |
| region | INT(2) | NOT NULL | Region ID |
| term | INT(1) | DEFAULT 0 | Term counter |
| conflict | TEXT | DEFAULT '{}' | Conflict data (JSON) |

**Indexes**:
- PRIMARY KEY (`city`)
- INDEX `nation` (`nation`)

**Constraints**:
- `json`: CHECK (json_valid(`conflict`))

**Critical for Migration**: YES - Core game state

---

### 2.9 `troop` - Military Units

**Purpose**: Troop/army groupings

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| troop_leader | INT(6) | PK | Troop leader general ID |
| nation | INT(6) | NOT NULL | Nation ID |
| name | VARCHAR(50) | NOT NULL | Troop name |

**Indexes**:
- PRIMARY KEY (`troop_leader`)

---

### 2.10 `plock` - Process Locks

**Purpose**: Game tick synchronization and locking

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | Lock ID |
| type | ENUM | DEFAULT 'GAME' | Lock type: 'GAME', 'ETC', 'TOURNAMENT' |
| plock | INT(1) | DEFAULT 0 | Lock status (0=unlocked, 1=locked) |
| locktime | DATETIME(6) | NOT NULL | Lock timestamp (microseconds) |

**Indexes**:
- PRIMARY KEY (`no`)
- UNIQUE INDEX `type` (`type`)

**Critical for Migration**: YES - Game tick synchronization

---

### 2.11 `message` - In-Game Messages

**Purpose**: Player/nation messaging system

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Message ID |
| mailbox | INT(11) | NOT NULL | Mailbox ID (9999=public, >=9000=national) |
| type | ENUM | NOT NULL | 'private', 'national', 'public', 'diplomacy' |
| src | INT(11) | NOT NULL | Sender general ID |
| dest | INT(11) | NOT NULL | Recipient general ID |
| time | DATETIME | DEFAULT CURRENT_TIMESTAMP | Message timestamp |
| valid_until | DATETIME | DEFAULT '9999-12-31 23:59:59' | Expiration date |
| message | TEXT | NOT NULL | Message content (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `by_mailbox` (`mailbox`, `type`, `id`)

**Constraints**:
- `json`: CHECK (json_valid(`message`))

**Critical for Migration**: MEDIUM - Real-time communication

---

### 2.12 `hall` - Hall of Fame (Persistent)

**Purpose**: Cross-game achievement records

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Record ID |
| server_id | CHAR(20) | NOT NULL | Server identifier |
| season | INT(11) | NOT NULL | Season number |
| scenario | INT(11) | NOT NULL | Scenario number |
| general_no | INT(11) | NOT NULL | General ID |
| type | VARCHAR(20) | NOT NULL | Achievement type |
| value | DOUBLE | NOT NULL | Achievement value |
| owner | INT(11) | NULL | User ID |
| aux | LONGTEXT | DEFAULT '{}' | Additional data (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `server_general` (`server_id`, `type`, `general_no`)
- UNIQUE INDEX `owner` (`owner`, `server_id`, `type`)
- INDEX `server_show` (`server_id`, `type`, `value`)
- INDEX `scenario` (`season`, `scenario`, `type`, `value`)

**Constraints**:
- `json`: CHECK (json_valid(`aux`))

**Notes**: Data persists across game resets

---

### 2.13 `ng_games` - Game Metadata (Persistent)

**Purpose**: Game instance records

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Game ID |
| server_id | CHAR(20) | NOT NULL, UNIQUE | Server identifier |
| date | DATETIME | NOT NULL | Game end date |
| winner_nation | INT(11) | NULL | Winning nation ID |
| map | VARCHAR(50) | NULL | Map name |
| season | INT(11) | NOT NULL | Season number |
| scenario | INT(11) | NOT NULL | Scenario number |
| scenario_name | TEXT | NOT NULL | Scenario display name |
| env | TEXT | NOT NULL | Environment config (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `server_id` (`server_id`)
- INDEX `date` (`date`)

**Constraints**:
- `json`: CHECK (json_valid(`env`))

**Notes**: Data persists across game resets

---

### 2.14 `ng_old_nations` - Historical Nations (Persistent)

**Purpose**: Archive of destroyed nations

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Record ID |
| server_id | CHAR(20) | DEFAULT '0' | Server identifier |
| nation | INT(11) | DEFAULT 0 | Nation ID |
| data | LONGTEXT | DEFAULT '{}' | Nation snapshot (JSON) |
| date | DATETIME | DEFAULT CURRENT_TIMESTAMP | Destruction date |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `server_id` (`server_id`, `nation`)

**Constraints**:
- `json`: CHECK (json_valid(`data`))

**Notes**: Data persists across game resets

---

### 2.15 `ng_old_generals` - Historical Generals (Persistent)

**Purpose**: Archive of dead generals

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Record ID |
| server_id | CHAR(20) | NOT NULL | Server identifier |
| general_no | INT(11) | NOT NULL | General ID |
| owner | INT(11) | NULL | User ID |
| name | VARCHAR(32) | NOT NULL | General name |
| last_yearmonth | INT(11) | NOT NULL | Year-month of death (YYYYMM) |
| turntime | DATETIME(6) | NOT NULL | Last turn timestamp |
| data | MEDIUMTEXT | NOT NULL | General snapshot (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `by_no` (`server_id`, `general_no`)
- INDEX `by_name` (`server_id`, `name`)
- INDEX `owner` (`owner`, `server_id`)

**Constraints**:
- `json`: CHECK (json_valid(`data`))

**Notes**: Data persists across game resets

---

### 2.16 `emperior` - Dynasty Records (Persistent)

**Purpose**: Historical dynasty/empire records

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(6) | PK, AUTO_INCREMENT | Dynasty ID |
| server_id | CHAR(20) | DEFAULT '' | Server identifier |
| phase | VARCHAR(255) | | Game phase |
| nation_count | VARCHAR(64) | | Nation count history |
| nation_name | TEXT | | Nation names |
| nation_hist | TEXT | | Nation history |
| gen_count | VARCHAR(64) | | General count |
| personal_hist | TEXT | | Personal trait history |
| special_hist | TEXT | | Special ability history |
| name | VARCHAR(64) | | Dynasty name |
| type | VARCHAR(64) | | Dynasty type |
| color | VARCHAR(7) | | Dynasty color |
| year | INT(4) | DEFAULT 0 | Year |
| month | INT(2) | DEFAULT 0 | Month |
| power | INT(8) | DEFAULT 0 | Total power |
| gennum | INT(3) | DEFAULT 0 | General count |
| citynum | INT(3) | DEFAULT 0 | City count |
| pop | VARCHAR(255) | DEFAULT '0' | Population |
| poprate | VARCHAR(255) | | Population rate |
| gold | INT(9) | DEFAULT 0 | Gold reserves |
| rice | INT(9) | DEFAULT 0 | Rice reserves |
| l5name-l12name | VARCHAR(64) | | Officer names (levels 5-12) |
| l5pic-l12pic | VARCHAR(32) | | Officer portraits (levels 5-12) |
| tiger | VARCHAR(128) | | Tiger general |
| eagle | VARCHAR(128) | | Eagle general |
| gen | TEXT | | General data |
| history | MEDIUMTEXT | DEFAULT '{}' | Historical events (JSON) |
| aux | MEDIUMTEXT | DEFAULT '{}' | Additional data (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)

**Constraints**:
- `json1`: CHECK (json_valid(`history`))
- `json2`: CHECK (json_valid(`aux`))

**Notes**: Data persists across game resets

---

### 2.17 `diplomacy` - Diplomatic Relations

**Purpose**: Nation-to-nation diplomatic state

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(6) | PK, AUTO_INCREMENT | Relation ID |
| me | INT(6) | NOT NULL | Nation A ID |
| you | INT(6) | NOT NULL | Nation B ID |
| state | INT(6) | DEFAULT 0 | Diplomatic state |
| term | INT(6) | DEFAULT 0 | Treaty term |
| dead | INT(8) | DEFAULT 0 | Casualties |
| showing | DATETIME | NULL | Display timestamp |

**Indexes**:
- PRIMARY KEY (`no`)
- UNIQUE INDEX `me` (`me`, `you`)

---

### 2.18 `ng_diplomacy` - Diplomatic Documents

**Purpose**: Diplomatic proposals and treaties

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | Document ID |
| src_nation_id | INT(11) | NOT NULL | Proposing nation |
| dest_nation_id | INT(11) | NOT NULL | Receiving nation |
| prev_no | INT(11) | NULL | Previous document ID |
| state | ENUM | DEFAULT 'proposed' | 'proposed', 'activated', 'cancelled', 'replaced' |
| text_brief | TEXT | NOT NULL | Brief description |
| text_detail | TEXT | NOT NULL | Detailed terms |
| date | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation date |
| src_signer | INT(11) | NOT NULL | Proposing general ID |
| dest_signer | INT(11) | NULL | Accepting general ID |
| aux | TEXT | NULL | Additional data (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)
- INDEX `by_nation_src` (`src_nation_id`, `dest_nation_id`, `state`, `date`)
- INDEX `by_nation_dest` (`dest_nation_id`, `src_nation_id`, `state`, `date`)

**Constraints**:
- `json`: CHECK (json_valid(`aux`))

---

### 2.19 `tournament` - Tournament System

**Purpose**: Tournament participants and standings

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| seq | INT(6) | PK, AUTO_INCREMENT | Entry ID |
| no | INT(6) | DEFAULT 0 | General ID |
| npc | INT(6) | DEFAULT 0 | NPC flag |
| name | VARCHAR(64) | DEFAULT '' | General name |
| w | VARCHAR(20) | DEFAULT 'None' | Weapon |
| b | VARCHAR(20) | DEFAULT 'None' | Book |
| h | VARCHAR(20) | DEFAULT 'None' | Horse |
| leadership | INT(3) | DEFAULT 0 | Leadership stat |
| strength | INT(3) | DEFAULT 0 | Strength stat |
| intel | INT(3) | DEFAULT 0 | Intelligence stat |
| lvl | INT(3) | DEFAULT 0 | Level |
| grp | INT(2) | DEFAULT 0 | Group number |
| grp_no | INT(2) | DEFAULT 0 | Group position |
| win | INT(2) | DEFAULT 0 | Win count |
| draw | INT(2) | DEFAULT 0 | Draw count |
| lose | INT(2) | DEFAULT 0 | Loss count |
| gl | INT(2) | DEFAULT 0 | Goal/score |
| prmt | INT(1) | DEFAULT 0 | Promotion flag |

**Indexes**:
- PRIMARY KEY (`seq`)
- INDEX `grp` (`grp`, `grp_no`)

---

### 2.20 `statistic` - Game Statistics

**Purpose**: Historical game statistics snapshots

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(6) | PK, AUTO_INCREMENT | Statistic ID |
| year | INT(4) | DEFAULT 0 | Year |
| month | INT(2) | DEFAULT 0 | Month |
| nation_count | INT(2) | DEFAULT 0 | Nation count |
| nation_name | TEXT | | Nation names |
| nation_hist | TEXT | | Nation history |
| gen_count | VARCHAR(32) | | General count |
| personal_hist | TEXT | | Personal trait statistics |
| special_hist | TEXT | | Special ability statistics |
| power_hist | TEXT | | Power history |
| crewtype | TEXT | | Crew type statistics |
| etc | TEXT | | Miscellaneous data |
| aux | TEXT | NULL | Additional data (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)

**Constraints**:
- `json`: CHECK (json_valid(`aux`))

---

### 2.21 `ng_history` - Game Chronicle (Persistent)

**Purpose**: Monthly game state snapshots

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(6) | PK, AUTO_INCREMENT | History ID |
| server_id | CHAR(20) | NOT NULL | Server identifier |
| year | INT(4) | NULL | Year |
| month | INT(2) | NULL | Month |
| map | MEDIUMTEXT | NULL | Map state (JSON) |
| global_history | MEDIUMTEXT | NULL | Global events (JSON) |
| global_action | MEDIUMTEXT | NULL | Global actions (JSON) |
| nations | MEDIUMTEXT | NULL | Nation snapshots (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)
- INDEX `server_id` (`server_id`, `year`, `month`)

**Constraints**:
- `json1`: CHECK (json_valid(`map`))
- `json2`: CHECK (json_valid(`global_history`))
- `json3`: CHECK (json_valid(`global_action`))
- `json4`: CHECK (json_valid(`nations`))

**Notes**: Data persists across game resets

---

### 2.22 `event` - Event Handlers

**Purpose**: Scripted game events and triggers

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Event ID |
| target | ENUM | DEFAULT 'MONTH' | 'MONTH', 'OCCUPY_CITY', 'DESTROY_NATION', 'PRE_MONTH', 'UNITED' |
| priority | INT(11) | DEFAULT 1000 | Execution priority |
| condition | MEDIUMTEXT | NOT NULL | Trigger condition (JSON) |
| action | MEDIUMTEXT | NOT NULL | Action to execute (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `target` (`target`, `priority`, `id`)

**Constraints**:
- `json1`: CHECK (json_valid(`condition`))
- `json2`: CHECK (json_valid(`action`))

---

### 2.23 `world_history` - Nation History Log

**Purpose**: Nation-level event history

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Entry ID |
| nation_id | INT(11) | NOT NULL | Nation ID |
| year | INT(4) | NOT NULL | Year |
| month | INT(2) | NOT NULL | Month |
| text | TEXT | NOT NULL | Event description |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `date` (`nation_id`, `year`, `month`, `id`)
- INDEX `plain` (`nation_id`, `id`)

---

### 2.24 `general_record` - General Activity Log

**Purpose**: Detailed general action history

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Record ID |
| general_id | INT(11) | NOT NULL | General ID |
| log_type | ENUM | NOT NULL | 'action', 'battle_brief', 'battle', 'history' |
| year | INT(4) | NOT NULL | Year |
| month | INT(2) | NOT NULL | Month |
| text | TEXT | NOT NULL | Record text |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `date` (`general_id`, `log_type`, `year`, `month`, `id`)
- INDEX `plain` (`general_id`, `log_type`, `id`)

---

### 2.25 `reserved_open` - Scheduled Server Opens

**Purpose**: Schedule new game server launches

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Reservation ID |
| options | TEXT | NULL | Server options (JSON) |
| date | DATETIME | NULL | Scheduled open date |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `date` (`date`)

**Constraints**:
- `json`: CHECK (json_valid(`options`))

---

### 2.26 `select_npc_token` - NPC Selection Tokens

**Purpose**: Temporary tokens for NPC general selection

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Token ID |
| owner | INT(11) | NOT NULL, UNIQUE | User ID |
| valid_until | DATETIME | NOT NULL | Expiration date |
| pick_more_from | DATETIME | NOT NULL | Next pick allowed date |
| pick_result | TEXT | NOT NULL | Selection results (JSON) |
| nonce | INT(11) | NOT NULL | Nonce for security |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `owner` (`owner`)
- INDEX `valid_until` (`valid_until`)

**Constraints**:
- `json`: CHECK (json_valid(`pick_result`))

---

### 2.27 `select_pool` - General Creation Pool

**Purpose**: Pool of available generals for selection

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Pool entry ID |
| unique_name | VARCHAR(20) | NOT NULL, UNIQUE | Unique identifier |
| owner | INT(11) | NULL | Claiming user ID |
| general_id | INT(11) | NULL, UNIQUE | Claimed general ID |
| reserved_until | DATETIME | NULL | Reservation expiration |
| info | TEXT | NOT NULL | General template info |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `unique_name` (`unique_name`)
- UNIQUE INDEX `general_id` (`general_id`)
- INDEX `owner` (`owner`)
- INDEX `reserved_until` (`reserved_until`, `general_id`)

---

### 2.28 `storage` - Game Key-Value Storage

**Purpose**: Generic key-value storage for game data

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Entry ID |
| namespace | VARCHAR(40) | NOT NULL | Storage namespace |
| key | VARCHAR(40) | NOT NULL | Key |
| value | LONGTEXT | NOT NULL | JSON value |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `key` (`namespace`, `key`)

**Constraints**:
- `json`: CHECK (json_valid(`value`))

---

### 2.29 `nation_env` - Nation Environment Storage

**Purpose**: Nation-specific configuration storage

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Entry ID |
| namespace | INT(11) | NOT NULL | Nation ID (different from storage!) |
| key | VARCHAR(40) | NOT NULL | Key |
| value | LONGTEXT | NOT NULL | JSON value |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `key` (`namespace`, `key`)

**Constraints**:
- `json`: CHECK (json_valid(`value`))

---

### 2.30 `rank_data` - Rankings/Leaderboards

**Purpose**: General rankings by various metrics

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Rank entry ID |
| nation_id | INT(11) | DEFAULT 0 | Nation ID |
| general_id | INT(11) | NOT NULL | General ID |
| type | VARCHAR(20) | NOT NULL | Rank type/category |
| value | INT(11) | DEFAULT 0 | Rank value |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `by_general` (`general_id`, `type`)
- INDEX `by_type` (`type`, `value`)
- INDEX `by_nation` (`nation_id`, `type`, `value`)

---

### 2.31 `user_record` - User Game Logs (Persistent)

**Purpose**: User-specific game event logs

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Record ID |
| user_id | INT(11) | NOT NULL | User ID |
| server_id | CHAR(20) | NOT NULL | Server identifier |
| log_type | VARCHAR(20) | NOT NULL | Log category |
| year | INT(4) | NOT NULL | Year |
| month | INT(2) | NOT NULL | Month |
| date | DATETIME | NULL | Timestamp |
| text | TEXT | NOT NULL | Log text |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `date1` (`user_id`, `server_id`, `log_type`, `year`, `month`, `id`)
- INDEX `date2` (`user_id`, `server_id`, `log_type`, `date`, `id`)
- INDEX `date3` (`server_id`, `date`)
- INDEX `date4` (`server_id`, `year`, `month`, `date`)
- INDEX `plain` (`user_id`, `log_type`, `id`)

**Notes**: Data persists across game resets

---

### 2.32 `ng_betting` - Betting System

**Purpose**: In-game betting records

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Bet ID |
| betting_id | INT(11) | NOT NULL | Betting event ID |
| general_id | INT(11) | NOT NULL | Betting general ID |
| user_id | INT(11) | NULL | User ID |
| betting_type | VARCHAR(100) | NOT NULL | Bet type (JSON) |
| amount | INT(11) | NOT NULL | Bet amount |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `by_general` (`general_id`, `betting_id`, `betting_type`)
- UNIQUE INDEX `by_bet` (`betting_id`, `betting_type`, `general_id`)
- INDEX `by_user` (`user_id`, `betting_id`, `betting_type`)

**Constraints**:
- `json`: CHECK (json_valid(`betting_type`))

---

### 2.33 `vote` - Voting System

**Purpose**: In-game polls and votes

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Vote record ID |
| vote_id | INT(11) | NOT NULL | Poll ID |
| general_id | INT(11) | NOT NULL | Voting general ID |
| nation_id | INT(11) | NOT NULL | General's nation |
| selection | VARCHAR(100) | NOT NULL | Selected option (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE INDEX `by_general` (`general_id`, `vote_id`)
- INDEX `by_vote` (`vote_id`, `selection`)

**Constraints**:
- `json`: CHECK (json_valid(`selection`))

---

### 2.34 `vote_comment` - Vote Comments

**Purpose**: Comments on polls

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Comment ID |
| vote_id | INT(11) | NOT NULL | Poll ID |
| general_id | INT(11) | NOT NULL | Commenting general ID |
| nation_id | INT(11) | NOT NULL | General's nation |
| general_name | VARCHAR(32) | NOT NULL | General name |
| nation_name | VARCHAR(64) | NOT NULL | Nation name |
| text | TEXT | NOT NULL | Comment text |
| date | DATETIME | NULL | Comment timestamp |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `by_vote` (`vote_id`)

---

### 2.35 `ng_auction` - Auction System

**Purpose**: Auction listings (rice, gold, unique items)

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INT(11) | PK, AUTO_INCREMENT | Auction ID |
| type | ENUM | NOT NULL | 'buyRice', 'sellRice', 'uniqueItem' |
| finished | BIT(1) | NOT NULL | Auction completed flag |
| target | VARCHAR(50) | NULL | Target item (if uniqueItem) |
| host_general_id | INT(11) | NOT NULL | Auction host general ID |
| req_resource | ENUM | NOT NULL | 'gold', 'rice', 'inheritPoint' |
| open_date | DATETIME | NOT NULL | Auction start date |
| close_date | DATETIME | NOT NULL | Auction end date |
| detail | LONGTEXT | NOT NULL | Auction details (JSON) |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `by_close` (`finished`, `type`, `close_date`)
- INDEX `by_general_id` (`host_general_id`, `type`, `finished`)

**Constraints**:
- `detail`: CHECK (json_valid(`detail`))

**Notes**: Auction objects stored in KVStorage

---

### 2.36 `ng_auction_bid` - Auction Bids

**Purpose**: Individual bids on auctions

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| no | INT(11) | PK, AUTO_INCREMENT | Bid ID |
| auction_id | INT(11) | NOT NULL | Auction ID (FK to ng_auction.id) |
| owner | INT(11) | NULL | Bidding user ID |
| general_id | INT(11) | NOT NULL | Bidding general ID |
| amount | INT(11) | NOT NULL | Bid amount |
| date | DATETIME | NOT NULL | Bid timestamp |
| aux | LONGTEXT | NOT NULL | Additional data (JSON) |

**Indexes**:
- PRIMARY KEY (`no`)
- UNIQUE INDEX `by_general` (`general_id`, `auction_id`, `amount`)
- UNIQUE INDEX `by_owner` (`owner`, `auction_id`, `amount`)
- UNIQUE INDEX `by_amount` (`auction_id`, `amount`)

**Constraints**:
- `aux`: CHECK (json_valid(`aux`))

---

## 3. SQLITE LOG DATABASES

### 3.1 `err_log` - Error Logging (SQLite)

**File**: `/core/f_install/sql/err_log.sql`

**Purpose**: Application error tracking

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Error ID |
| date | TEXT | NOT NULL | Error timestamp |
| err | TEXT | NOT NULL | Error code |
| errstr | TEXT | NOT NULL | Error message |
| errpath | TEXT | NOT NULL | Error location/path |
| trace | TEXT | NOT NULL | Stack trace |
| webuser | TEXT | NULL | User identifier |

**Indexes**:
- INDEX `date` (`date` DESC)

**Critical for Migration**: LOW - Logging only

---

### 3.2 `api_log` - API Request Logging (SQLite)

**File**: `/core/f_install/sql/api_log.sql`

**Purpose**: API request audit trail

| Column | Type | Attributes | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Log entry ID |
| user_id | INTEGER | NOT NULL | User ID |
| ip | TEXT | NOT NULL | Request IP address |
| date | TEXT | NOT NULL | Request timestamp |
| path | TEXT | NOT NULL | API endpoint path |
| arg | TEXT | NULL | Request arguments |
| aux | TEXT | NULL | Additional metadata |

**Indexes**:
- INDEX `by_date` (`date` DESC)
- INDEX `by_user` (`user_id` ASC, `date` DESC)

**Critical for Migration**: LOW - Logging only

---

## 4. TABLE RELATIONSHIPS

### Root Database Foreign Keys (Logical)

```
member.NO → member_log.member_no (1:N)
member.NO → login_token.user_id (1:N)
```

### Game Database Foreign Keys (Logical)

```
member.NO (root) → general.owner (1:N) [Cross-database]

general.no → general_turn.general_id (1:N)
general.no → general_access_log.general_id (1:1)
general.no → general_record.general_id (1:N)
general.no → troop.troop_leader (1:1)
general.no → ng_betting.general_id (1:N)
general.no → vote.general_id (1:N)
general.no → ng_auction.host_general_id (1:N)
general.no → ng_auction_bid.general_id (1:N)

nation.nation → general.nation (1:N)
nation.nation → nation_turn.nation_id (1:N)
nation.nation → city.nation (1:N)
nation.nation → board.nation_no (1:N)
nation.nation → diplomacy.me (1:N)
nation.nation → diplomacy.you (1:N)
nation.nation → ng_diplomacy.src_nation_id (1:N)
nation.nation → ng_diplomacy.dest_nation_id (1:N)
nation.nation → world_history.nation_id (1:N)
nation.nation → nation_env.namespace (1:N)

city.city → general.city (1:N)

board.no → comment.document_no (1:N)

ng_auction.id → ng_auction_bid.auction_id (1:N)
```

---

## 5. CRITICAL TABLES FOR MIGRATION PRIORITY

### Tier 1: Essential (Must migrate first)

1. **member** - User authentication (root DB)
2. **login_token** - Active sessions (root DB)
3. **general** - Core game state
4. **general_turn** - Command queue (real-time critical)
5. **nation** - Nation state
6. **city** - Territory state
7. **plock** - Game tick synchronization

### Tier 2: High Priority

8. **message** - In-game messaging
9. **nation_turn** - National commands
10. **board** / **comment** - Communication
11. **general_access_log** - Activity tracking
12. **storage** / **nation_env** - Key-value data

### Tier 3: Important Historical Data

13. **hall** - Hall of fame (persistent)
14. **ng_games** - Game metadata (persistent)
15. **ng_old_generals** - Historical generals (persistent)
16. **ng_old_nations** - Historical nations (persistent)
17. **ng_history** - Game chronicle (persistent)
18. **user_record** - User logs (persistent)

### Tier 4: Supporting Systems

19. **troop** - Military organization
20. **diplomacy** / **ng_diplomacy** - Diplomatic relations
21. **tournament** - Tournament system
22. **event** - Event handlers
23. **rank_data** - Rankings
24. **ng_auction** / **ng_auction_bid** - Auction system
25. **vote** / **vote_comment** - Voting system
26. **ng_betting** - Betting system

### Tier 5: Optional/Archival

27. **statistic** - Statistics snapshots
28. **emperior** - Dynasty records
29. **world_history** - Event history
30. **general_record** - Detailed logs
31. **select_npc_token** / **select_pool** - Temporary selection data
32. **reserved_open** - Scheduled opens

### Tier 6: Logging (Can be handled separately)

33. **member_log** - User activity audit (root DB)
34. **err_log** - Error logs (SQLite)
35. **api_log** - API logs (SQLite)

---

## 6. DATABASE-SPECIFIC FEATURES

### MySQL/MariaDB Features Used

1. **Aria Storage Engine**: Used throughout for crash recovery
2. **utf8mb4_bin Collation**: Case-sensitive for names
3. **utf8mb4_general_ci Collation**: Case-insensitive for most data
4. **JSON Validation**: Extensive use of `json_valid()` constraints
5. **DATETIME(6)**: Microsecond precision timestamps
6. **ENUM Types**: Used for state machines and type safety
7. **AUTO_INCREMENT**: All primary keys
8. **UNIQUE Constraints**: Multi-column unique indexes
9. **Composite Indexes**: Optimized for query patterns
10. **CHECK Constraints**: JSON validation

### No Triggers, Stored Procedures, or Views

The schema does **NOT** use:
- Triggers
- Stored procedures
- Views
- Foreign key constraints (enforced at application level)

This makes migration to other databases (PostgreSQL, SQLite, etc.) relatively straightforward.

---

## 7. DATA PERSISTENCE PATTERNS

### Ephemeral (Reset on game restart)
- general, nation, city, troop
- general_turn, nation_turn
- board, comment, message
- diplomacy, ng_diplomacy
- tournament, event
- plock, rank_data
- vote, ng_betting, ng_auction

### Persistent (Survives game resets)
- hall (achievements)
- ng_games (game records)
- ng_old_generals (death archive)
- ng_old_nations (destruction archive)
- emperior (dynasty records)
- ng_history (monthly snapshots)
- user_record (user logs)

### Cross-Game (Root database)
- member, member_log
- login_token, banned_member
- storage (root)

---

## 8. JSON FIELD USAGE

Many tables use JSON fields for flexible/extensible data:

- **general**: `last_turn`, `aux`, `penalty`
- **nation**: `spy`, `aux`
- **city**: `conflict`
- **message**: `message`
- **nation_turn**: `arg`
- **general_turn**: `arg`
- **ng_diplomacy**: `aux`
- **ng_games**: `env`
- **ng_old_nations**: `data`
- **ng_old_generals**: `data`
- **emperior**: `history`, `aux`
- **ng_history**: `map`, `global_history`, `global_action`, `nations`
- **event**: `condition`, `action`
- **storage**: `value`
- **nation_env**: `value`
- **ng_auction**: `detail`
- **ng_auction_bid**: `aux`

All JSON fields have `CHECK (json_valid())` constraints.

---

## 9. MIGRATION CONSIDERATIONS

### Cross-Database References

The `general.owner` field references `member.NO` from the **root database**, creating a cross-database dependency. Migration must handle this carefully.

### High-Frequency Tables

These tables have high write frequency and need special consideration:
- **general** - Updated every turn (every few seconds)
- **general_turn** - Command queue (real-time writes)
- **plock** - Game tick lock (every second)
- **message** - Real-time messaging
- **general_access_log** - Every page refresh

### Large Data Tables

These tables can grow very large:
- **ng_history** - Monthly snapshots (MEDIUMTEXT JSON)
- **ng_old_generals** - Cumulative death records
- **user_record** - Cumulative user logs
- **general_record** - Detailed action logs
- **member_log** - Cumulative activity logs

### Indexes for Performance

The schema is heavily indexed for read performance. Critical indexes:
- **general**: `turntime`, `nation`, `owner`
- **general_turn**: `general_id` + `turn_idx`
- **message**: `mailbox` + `type`
- **plock**: `type` (unique)

---

## 10. CHARACTER SET NOTES

- **Korean Language Support**: utf8mb4 throughout
- **Case-Sensitive Names**: `utf8mb4_bin` for character/nation names
- **Emoji Support**: utf8mb4 supports emoji in messages/names

---

## 11. BACKEND MIGRATION STRATEGY

### Phase 1: Core Authentication
1. Migrate `member` table
2. Migrate `login_token` table
3. Implement authentication API

### Phase 2: Game State Read
1. Migrate `general`, `nation`, `city`
2. Implement read-only game state API
3. Test game state display

### Phase 3: Command System
1. Migrate `general_turn`, `nation_turn`
2. Implement command queue API
3. Test command submission

### Phase 4: Real-Time Updates
1. Migrate `plock`
2. Implement game tick system
3. Implement WebSocket/SSE updates

### Phase 5: Communication
1. Migrate `message`, `board`, `comment`
2. Implement messaging API

### Phase 6: Persistence
1. Migrate persistent tables (hall, ng_games, etc.)
2. Implement archival system

### Phase 7: Supporting Systems
1. Migrate remaining tables as needed
2. Implement full feature parity

---

## Document Version

- **Created**: 2025-11-01
- **Source Files**:
  - `/core/f_install/sql/common_schema.sql` (Root DB)
  - `/core/hwe/sql/schema.sql` (Game DB)
  - `/core/f_install/sql/err_log.sql` (SQLite)
  - `/core/f_install/sql/api_log.sql` (SQLite)
- **Total Tables**: 42 (6 root + 34 game + 2 log)
