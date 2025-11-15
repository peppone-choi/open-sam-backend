const mongoose = require('mongoose');

async function checkCitySupply() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    
    // 건업 찾기 (cityId = 7)
    const city = await City.findOne({ 
      city: 7,
      session_id: 'sangokushi_default' 
    });
    
    if (!city) {
      console.log('건업을 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    const data = city.data || {};
    console.log('\n=== 건업 정보 ===');
    console.log(`이름: ${data.name || city.name}`);
    console.log(`도시 ID: ${city.city}`);
    console.log(`국가: ${data.nation || city.nation}`);
    console.log(`supply (data): ${data.supply}`);
    console.log(`supply (최상위): ${city.supply}`);
    console.log(`occupied: ${data.occupied ?? city.occupied}`);
    console.log('\n전체 데이터 구조:');
    console.log('data 필드:', Object.keys(data));
    console.log('최상위 필드:', Object.keys(city.toObject()).filter(k => k !== 'data' && k !== '_id' && k !== '__v'));
    
    // 손권 세력의 모든 도시 확인
    const nationCities = await City.find({
      session_id: 'sangokushi_default',
      $or: [
        { 'data.nation': 2 },
        { nation: 2 }
      ]
    }).sort({ city: 1 });
    
    console.log('\n=== 손권 세력 도시 목록 ===');
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
