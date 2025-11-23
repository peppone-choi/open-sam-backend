#!/usr/bin/env node
/**
 * Session Seed Script for Backend Session B
 * 
 * Creates a test session with:
 * - 1 session (sangokushi_test)
 * - 5 users
 * - 10 generals
 * - MongoDB + Redis data injection
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SESSION_ID = 'sangokushi_test';
const USER_COUNT = 5;
const GENERAL_COUNT = 10;

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/opensam';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

console.log('='.repeat(60));
console.log('Session Seed Script - Backend Session B');
console.log('='.repeat(60));
console.log(`Target: MongoDB=${MONGO_URI}, Redis=${REDIS_HOST}:${REDIS_PORT}`);
console.log(`Session: ${SESSION_ID}`);
console.log(`Users: ${USER_COUNT}, Generals: ${GENERAL_COUNT}`);
console.log('='.repeat(60));

// Define schemas
const userSchema = new mongoose.Schema({
  no: { type: Number, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  grade: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now },
  data: { type: Object, default: {} }
}, { collection: 'users' });

const sessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, default: 'preparing' },
  turntime: { type: Date, default: Date.now },
  data: { type: Object, default: {} }
}, { collection: 'sessions' });

const generalSchema = new mongoose.Schema({
  no: { type: Number, required: true },
  session_id: { type: String, required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  npc: { type: Number, default: 0 },
  leadership: { type: Number, default: 50 },
  strength: { type: Number, default: 50 },
  intel: { type: Number, default: 50 },
  politics: { type: Number, default: 50 },
  charm: { type: Number, default: 50 },
  nation: { type: Number, default: 0 },
  city: { type: Number, required: true },
  officer_level: { type: Number, default: 0 },
  data: { type: Object, default: {} }
}, { collection: 'generals' });

const citySchema = new mongoose.Schema({
  city: { type: Number, required: true },
  session_id: { type: String, required: true },
  name: { type: String, required: true },
  nation: { type: Number, default: 0 },
  level: { type: Number, default: 5 },
  data: { type: Object, default: {} }
}, { collection: 'cities' });

const rankDataSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  data: {
    id: { type: String, required: true },
    general_id: { type: Number, required: true },
    nation_id: { type: Number, default: 0 },
    type: { type: String, required: true },
    value: { type: Number, default: 0 }
  }
}, { collection: 'rank_data' });

const generalTurnSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  data: {
    general_id: { type: Number, required: true },
    turn_idx: { type: Number, required: true },
    action: { type: String, default: '휴식' },
    arg: { type: Object, default: {} },
    brief: { type: String, default: '휴식' }
  }
}, { collection: 'general_turns' });

async function seedSession() {
  let connection;
  let redis;

  try {
    // Connect to MongoDB
    console.log('\n[1/6] Connecting to MongoDB...');
    connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ MongoDB connected');

    // Connect to Redis
    console.log('\n[2/6] Connecting to Redis...');
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      lazyConnect: true
    });
    await redis.connect();
    console.log('✓ Redis connected');

    // Define models
    const User = mongoose.model('User', userSchema);
    const Session = mongoose.model('Session', sessionSchema);
    const General = mongoose.model('General', generalSchema);
    const City = mongoose.model('City', citySchema);
    const RankData = mongoose.model('RankData', rankDataSchema);
    const GeneralTurn = mongoose.model('GeneralTurn', generalTurnSchema);

    // Clean up existing test data
    console.log('\n[3/6] Cleaning up existing test data...');
    await Session.deleteMany({ session_id: SESSION_ID });
    await General.deleteMany({ session_id: SESSION_ID });
    await City.deleteMany({ session_id: SESSION_ID });
    await RankData.deleteMany({ session_id: SESSION_ID });
    await GeneralTurn.deleteMany({ session_id: SESSION_ID });
    
    // Clean Redis keys
    const redisKeys = await redis.keys(`*${SESSION_ID}*`);
    if (redisKeys.length > 0) {
      await redis.del(...redisKeys);
      console.log(`✓ Deleted ${redisKeys.length} Redis keys`);
    }
    console.log('✓ Cleanup complete');

    // Create session
    console.log('\n[4/6] Creating session...');
    const session = await Session.create({
      session_id: SESSION_ID,
      name: 'Test Session - Backend Session B',
      status: 'preparing',
      turntime: new Date(),
      data: {
        game_env: {
          year: 184,
          month: 1,
          startyear: 184,
          init_year: 184,
          init_month: 1,
          scenario: 1,
          maxgeneral: 500,
          maxTurn: 30,
          turnterm: 10,
          genius: 3,
          defaultStatTotal: 275,
          defaultGold: 1000,
          defaultRice: 1000,
          defaultCrewtype: 0,
          show_img_level: 1,
          block_general_create: 0,
          inheritBornCityPoint: 500,
          inheritBornStatPoint: 500,
          inheritBornSpecialPoint: 1000,
          inheritBornTurntimePoint: 300
        }
      }
    });
    console.log(`✓ Session created: ${session.session_id}`);

    // Create cities
    console.log('\n[5/6] Creating cities...');
    const cities = [];
    const cityNames = ['낙양', '장안', '허창', '업성', '성도', '건업', '양양', '한중', '완성', '남양'];
    for (let i = 1; i <= 10; i++) {
      cities.push({
        city: i,
        session_id: SESSION_ID,
        name: cityNames[i - 1] || `도시${i}`,
        nation: i <= 5 ? 1 : 0, // First 5 cities belong to nation 1
        level: 5,
        data: {
          city: i,
          name: cityNames[i - 1] || `도시${i}`,
          nation: i <= 5 ? 1 : 0,
          level: 5,
          pop: 10000,
          pop_max: 20000,
          agri: 5000,
          agri_max: 10000,
          comm: 5000,
          comm_max: 10000,
          def: 3000,
          def_max: 5000,
          wall: 2000,
          wall_max: 3000
        }
      });
    }
    await City.insertMany(cities);
    console.log(`✓ Created ${cities.length} cities`);

    // Create users
    console.log('\n[6/6] Creating users and generals...');
    const users = [];
    for (let i = 1; i <= USER_COUNT; i++) {
      const userNo = 1000 + i;
      users.push({
        no: userNo,
        username: `testuser${i}`,
        password: '$2b$10$dummyhash', // Dummy bcrypt hash
        name: `테스트유저${i}`,
        grade: 1,
        data: {
          picture: null,
          imgsvr: 0
        }
      });
    }
    
    // Check for existing users and only create new ones
    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        await User.create(userData);
        console.log(`✓ Created user: ${userData.username}`);
      } else {
        console.log(`  User already exists: ${userData.username}`);
      }
    }

    // Create generals (10 generals, 5 users → 2 generals per user)
    const generals = [];
    const generalNames = [
      '관우', '장비', '조조', '유비', '손권',
      '제갈량', '사마의', '주유', '육손', '여포'
    ];

    for (let i = 1; i <= GENERAL_COUNT; i++) {
      const userIndex = Math.floor((i - 1) / 2);
      const userId = users[userIndex].no;
      const cityIndex = (i - 1) % 10;
      
      generals.push({
        no: i,
        session_id: SESSION_ID,
        owner: String(userId),
        name: generalNames[i - 1] || `장수${i}`,
        npc: 0,
        leadership: 50 + (i * 2),
        strength: 50 + (i * 2),
        intel: 50 + (i * 2),
        politics: 50 + (i * 2),
        charm: 50 + (i * 2),
        nation: i <= 5 ? 1 : 0,
        city: cityIndex + 1,
        officer_level: i <= 5 ? 1 : 0,
        data: {
          owner: String(userId),
          owner_name: users[userIndex].name,
          nation: i <= 5 ? 1 : 0,
          city: cityIndex + 1,
          troop: 0,
          affinity: 100,
          leadership: 50 + (i * 2),
          strength: 50 + (i * 2),
          intel: 50 + (i * 2),
          politics: 50 + (i * 2),
          charm: 50 + (i * 2),
          trait: '범인',
          experience: 0,
          dedication: 0,
          gold: 1000,
          rice: 1000,
          crew: 0,
          train: 0,
          atmos: 0,
          officer_level: i <= 5 ? 1 : 0,
          turntime: new Date(Date.now() + i * 60000),
          killturn: 6,
          crewtype: 0,
          makelimit: 0,
          betray: 0,
          age: 25,
          startage: 25,
          personal: '냉정',
          specage: 35,
          special: '없음',
          specage2: 30,
          special2: '없음',
          penalty: {},
          npc: 0
        }
      });
    }

    await General.insertMany(generals);
    console.log(`✓ Created ${generals.length} generals`);

    // Create rank_data for each general
    console.log('  Creating rank_data...');
    const rankColumns = [
      'firenum', 'warnum', 'killnum', 'deathnum', 'killcrew', 'deathcrew',
      'occupied', 'inherit_earned', 'inherit_spent', 'inherit_spent_dyn'
    ];

    const rankDataRows = [];
    for (const general of generals) {
      for (const type of rankColumns) {
        rankDataRows.push({
          session_id: SESSION_ID,
          data: {
            id: `${general.no}_${type}`,
            general_id: general.no,
            nation_id: general.nation,
            type: type,
            value: 0
          }
        });
      }
    }
    await RankData.insertMany(rankDataRows);
    console.log(`✓ Created ${rankDataRows.length} rank_data entries`);

    // Create general_turns
    console.log('  Creating general_turns...');
    const turnRows = [];
    for (const general of generals) {
      for (let turnIdx = 0; turnIdx < 30; turnIdx++) {
        turnRows.push({
          session_id: SESSION_ID,
          data: {
            general_id: general.no,
            turn_idx: turnIdx,
            action: '휴식',
            arg: {},
            brief: '휴식'
          }
        });
      }
    }
    await GeneralTurn.insertMany(turnRows);
    console.log(`✓ Created ${turnRows.length} general_turn entries`);

    // Inject Redis data
    console.log('\n[Redis] Injecting game environment data...');
    const gameEnvKey = `game_env:${SESSION_ID}`;
    await redis.hset(gameEnvKey, 'year', '184');
    await redis.hset(gameEnvKey, 'month', '1');
    await redis.hset(gameEnvKey, 'startyear', '184');
    await redis.hset(gameEnvKey, 'init_year', '184');
    await redis.hset(gameEnvKey, 'init_month', '1');
    await redis.hset(gameEnvKey, 'scenario', '1');
    await redis.hset(gameEnvKey, 'maxgeneral', '500');
    await redis.hset(gameEnvKey, 'genius', '3');
    console.log(`✓ Redis key created: ${gameEnvKey}`);

    // Create inheritance storage for each user
    console.log('\n[Redis] Creating inheritance storage...');
    for (const user of users) {
      const inheritKey = `inheritance_${user.no}:${SESSION_ID}`;
      await redis.hset(inheritKey, 'previous', JSON.stringify([5000, null]));
      console.log(`✓ Created: ${inheritKey} (5000 points)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`Session: ${SESSION_ID}`);
    console.log(`Users: ${USER_COUNT} (IDs: ${users.map(u => u.no).join(', ')})`);
    console.log(`Generals: ${GENERAL_COUNT} (IDs: 1-${GENERAL_COUNT})`);
    console.log(`Cities: 10`);
    console.log(`RankData: ${rankDataRows.length} entries`);
    console.log(`GeneralTurns: ${turnRows.length} entries`);
    console.log('='.repeat(60));
    console.log('\nTest users:');
    users.forEach((user, idx) => {
      console.log(`  ${idx + 1}. username: ${user.username}, password: test123 (use original)`);
    });
    console.log('\nRun validation:');
    console.log('  npm run build');
    console.log('  npm test -- lottery');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ SEED FAILED:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\nMongoDB disconnected');
    }
    if (redis) {
      await redis.quit();
      console.log('Redis disconnected');
    }
  }
}

// Run seed
seedSession()
  .then(() => {
    console.log('\nSeed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSeed script failed:', error);
    process.exit(1);
  });
