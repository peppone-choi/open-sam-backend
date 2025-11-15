const mongoose = require('mongoose');

async function checkStatus() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    
    // 모든 NPC=1 (선택된 오리지널 캐릭터) 찾기
    const userGenerals = await General.find({ 
      session_id: 'sangokushi_default',
      $or: [
        { npc: 1 },
        { 'data.npc': 1 }
      ]
    });
    
    console.log(`선택된 오리지널 캐릭터 수: ${userGenerals.length}\n`);
    
    for (const gen of userGenerals) {
      const data = gen.data || {};
      const cityId = data.city ?? gen.city;
      const nationId = data.nation ?? gen.nation;
      
      console.log(`=== ${data.name || gen.name} (ID: ${gen.no}) ===`);
      console.log(`국가: ${nationId}`);
      console.log(`도시 ID: ${cityId}`);
      console.log(`officer_level: ${data.officer_level ?? gen.officer_level ?? '없음'}`);
      console.log(`permission: ${data.permission ?? gen.permission ?? '없음'}`);
      
      if (cityId) {
        const city = await City.findOne({ 
          city: cityId, 
          session_id: 'sangokushi_default' 
        });
        
        if (city) {
          const cData = city.data || {};
          console.log(`현재 도시: ${cData.name || city.name}`);
          console.log(`도시 국가: ${cData.nation || city.nation}`);
          console.log(`보급 상태: ${cData.supply ?? city.supply ?? '필드 없음'}`);
        }
      }
      console.log('');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStatus();
