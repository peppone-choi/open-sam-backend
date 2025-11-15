const mongoose = require('mongoose');

async function checkSupply() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    // 감택 찾기
    const general = await General.findOne({ no: 1014, session_id: 'sangokushi_default' });
    if (!general) {
      console.log('장수를 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    const cityId = general.data?.city || general.city;
    console.log(`\n장수: ${general.data?.name || general.name}`);
    console.log(`도시 ID: ${cityId}`);
    console.log(`국가: ${general.data?.nation || general.nation}`);
    
    // 도시 정보 확인
    const city = await City.findOne({ 
      city: cityId, 
      session_id: 'sangokushi_default' 
    });
    
    if (city) {
      console.log(`\n도시: ${city.data?.name || city.name}`);
      console.log(`도시 국가: ${city.data?.nation || city.nation}`);
      console.log(`보급 상태 (supply): ${city.data?.supply ?? city.supply ?? '필드 없음'}`);
      console.log(`점령 상태 (occupied): ${city.data?.occupied ?? city.occupied ?? '필드 없음'}`);
      
      // 같은 국가 소속 도시 확인
      const nationCities = await City.find({
        session_id: 'sangokushi_default',
        $or: [
          { 'data.nation': general.data?.nation || general.nation },
          { nation: general.data?.nation || general.nation }
        ]
      });
      
      console.log(`\n국가 소속 도시 수: ${nationCities.length}`);
      console.log('도시 목록:');
      nationCities.forEach(c => {
        const cData = c.data || {};
        console.log(`  ${cData.name || c.name} (ID: ${c.city}) - supply: ${cData.supply ?? c.supply ?? '없음'}`);
      });
    } else {
      console.log('\n도시를 찾을 수 없습니다!');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSupply();
