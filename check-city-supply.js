const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    session: 'sangokushi_default',
    city: 7,
    seedScenario: null,
    dryRun: false,
    mongoUri: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--session')) {
      const [, value] = arg.split('=');
      if (value) {
        result.session = value;
      }
    } else if (arg.startsWith('--city')) {
      const [, value] = arg.split('=');
      if (value) {
        result.city = Number(value);
      }
    } else if (arg.startsWith('--seed-scenario')) {
      const [, value] = arg.split('=');
      if (value) {
        result.seedScenario = value;
      }
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--mongo-uri')) {
      const [, value] = arg.split('=');
      if (value) {
        result.mongoUri = value;
      }
    }
  }

  return result;
}

function loadScenarioCity(scenarioId, cityId) {
  if (!scenarioId) {
    return null;
  }

  const citiesPath = path.join(__dirname, 'config', 'scenarios', scenarioId, 'data', 'cities.json');
  if (!fs.existsSync(citiesPath)) {
    console.warn(`[seed] 시나리오 파일을 찾을 수 없습니다: ${citiesPath}`);
    return null;
  }

  const payload = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
  if (!Array.isArray(payload?.cities)) {
    return null;
  }

  return payload.cities.find(city => city.id === cityId || city.city === cityId) || null;
}

async function ensureCityExists(City, sessionId, cityId, seedScenario) {
  const city = await City.findOne({
    session_id: sessionId,
    city: cityId,
  });

  if (city) {
    return city;
  }

  const scenarioCity = loadScenarioCity(seedScenario, cityId);
  if (!scenarioCity) {
    return null;
  }

  const seedDocument = {
    session_id: sessionId,
    city: cityId,
    name: scenarioCity.name,
    nation: 0,
    level: scenarioCity.levelId || scenarioCity.level || 0,
    region: scenarioCity.regionId || scenarioCity.region || 0,
    supply: 0,
    pendingSupply: 0,
    data: {
      ...scenarioCity,
      supply: 0,
      pendingSupply: 0,
      nation: 0,
    },
  };

  const created = await City.create(seedDocument);
  console.log(`[seed] ${sessionId} 세션에 도시 ${cityId}를 생성했습니다.`);
  return created;
}

async function checkCitySupply() {
  const options = parseArgs();

  try {
    const mongoUri = options.mongoUri || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/opensam';
    await mongoose.connect(mongoUri);
    
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    
    let city = await ensureCityExists(City, options.session, options.city, options.seedScenario);

    if (!city) {
      console.log(`도시를 찾을 수 없습니다. 세션: ${options.session}, 도시: ${options.city}`);
      console.log('`--seed-scenario=<scenarioId>` 옵션을 사용해 기본 데이터를 주입할 수 있습니다.');
      await mongoose.disconnect();
      return;
    }
    
    const data = city.data || {};
    console.log(`\n=== ${data.name || city.name} 정보 ===`);
    console.log(`세션 ID: ${options.session}`);
    console.log(`도시 번호: ${city.city}`);
    console.log(`소속 국가: ${data.nation || city.nation}`);
    console.log(`공급량(data): ${data.supply}`);
    console.log(`공급량(최상위): ${city.supply}`);
    console.log(`대기 공급량(data): ${data.pendingSupply ?? data.pending_supply ?? 'null'}`);
    console.log(`대기 공급량(최상위): ${city.pendingSupply ?? city.pending_supply ?? 'null'}`);
    console.log(`점령 여부: ${data.occupied ?? city.occupied}`);
    console.log('\n데이터 필드 목록:');
    console.log('data 필드:', Object.keys(data));
    console.log('최상위 필드:', Object.keys(city.toObject()).filter(k => k !== 'data' && k !== '_id' && k !== '__v'));
    
    const nationFilter = {
      session_id: options.session,
      $or: [
        { 'data.nation': data.nation || city.nation || 0 },
        { nation: data.nation || city.nation || 0 }
      ]
    };

    const nationCities = await City.find(nationFilter).sort({ city: 1 });
    
    console.log('\n=== 동일 국가 도시 목록 ===');
    nationCities.forEach(c => {
      const d = c.data || {};
      console.log(`${d.name || c.name} (ID: ${c.city}) - supply: ${d.supply ?? c.supply ?? 'null'}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCitySupply();
