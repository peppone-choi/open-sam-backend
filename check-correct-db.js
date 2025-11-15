const mongoose = require('mongoose');

async function checkCorrectDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sangokushi');
    
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    
    // 건업 찾기
    const city = await City.findOne({ city: 7 });
    
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
    console.log(`supply (data.supply): ${data.supply}`);
    console.log(`supply (최상위 supply): ${city.supply}`);
    console.log(`세션: ${city.session_id}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCorrectDB();
