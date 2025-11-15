const mongoose = require('mongoose');

async function checkAllGenerals() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    const count = await General.countDocuments({ session_id: 'sangokushi_default' });
    console.log(`\n총 장수 수: ${count}\n`);
    
    const generals = await General.find({ 
      session_id: 'sangokushi_default'
    }).sort({ no: 1 }).limit(10);
    
    console.log('=== 장수 목록 (최대 10명) ===\n');
    generals.forEach(g => {
      const data = g.data || {};
      console.log(`${data.name || g.name || '무명'} (ID: ${g.no})`);
      console.log(`  NPC: ${data.npc ?? g.npc ?? 0}`);
      console.log(`  Nation: ${data.nation ?? g.nation ?? 0}`);
      console.log(`  officer_level: ${data.officer_level ?? g.officer_level ?? '없음'}`);
      console.log(`  permission: ${data.permission ?? g.permission ?? '없음'}`);
      console.log(`  데이터 구조: data 필드 ${data.name ? '있음' : '없음'}, 최상위 ${g.name ? '있음' : '없음'}`);
      console.log('');
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllGenerals();
