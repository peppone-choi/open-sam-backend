const mongoose = require('mongoose');

async function checkUserPermissions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    const generals = await General.find({ 
      session_id: 'sangokushi_default',
      npc: { $in: [0, null] }
    }).limit(10);
    
    console.log('\n=== 사용자 장수 권한 확인 ===\n');
    generals.forEach(g => {
      const data = g.data || g;
      console.log(`${data.name || g.name} (ID: ${g.no})`);
      console.log(`  Nation: ${data.nation || g.nation || 0}`);
      console.log(`  officer_level: ${data.officer_level ?? g.officer_level ?? '없음'}`);
      console.log(`  permission: ${data.permission ?? g.permission ?? '없음'}`);
      console.log('');
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserPermissions();
