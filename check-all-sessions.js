const mongoose = require('mongoose');

async function checkAllSessions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }), 'sessions');
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }), 'cities');
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    const sessions = await Session.find({});
    
    console.log(`\n총 세션 수: ${sessions.length}\n`);
    
    for (const session of sessions) {
      console.log(`=== ${session.session_id} ===`);
      console.log(`이름: ${session.name || '없음'}`);
      
      const cityCount = await City.countDocuments({ session_id: session.session_id });
      const genCount = await General.countDocuments({ session_id: session.session_id });
      
      console.log(`도시 수: ${cityCount}`);
      console.log(`장수 수: ${genCount}`);
      
      if (cityCount > 0) {
        // 건업 확인
        const city7 = await City.findOne({ session_id: session.session_id, city: 7 });
        if (city7) {
          const data = city7.data || {};
          console.log(`건업 발견: ${data.name || city7.name} - supply: ${data.supply ?? city7.supply ?? 'null'}`);
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

checkAllSessions();
