const mongoose = require('mongoose');

async function checkNPCPermissions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    // NPC 장수 중 국가에 소속된 장수 확인
    const generals = await General.find({ 
      session_id: 'sangokushi_default',
      $or: [
        { 'data.nation': { $gt: 0 } },
        { nation: { $gt: 0 } }
      ]
    }).limit(20);
    
    console.log('\n=== NPC 장수 권한 확인 ===\n');
    generals.forEach(g => {
      const data = g.data || {};
      const nation = data.nation ?? g.nation ?? 0;
      const npc = data.npc ?? g.npc ?? 0;
      const officerLevel = data.officer_level ?? g.officer_level;
      const permission = data.permission ?? g.permission;
      
      if (nation > 0) {
        console.log(`${data.name || g.name} (ID: ${g.no})`);
        console.log(`  NPC: ${npc}`);
        console.log(`  Nation: ${nation}`);
        console.log(`  officer_level: ${officerLevel ?? '없음'}`);
        console.log(`  permission: ${permission ?? '없음'}`);
        console.log('');
      }
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNPCPermissions();
