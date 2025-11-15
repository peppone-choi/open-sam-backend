const mongoose = require('mongoose');

async function checkDungji() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sangokushi');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    const dungji = await General.findOne({ 
      no: 1089,
      session_id: 'sangokushi_default' 
    });
    
    if (!dungji) {
      console.log('등지를 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    const data = dungji.data || {};
    
    console.log('\n=== 등지 정보 ===');
    console.log(`이름: ${data.name || dungji.name}`);
    console.log(`no: ${dungji.no}`);
    console.log(`npc (최상위): ${dungji.npc}`);
    console.log(`npc (data): ${data.npc}`);
    console.log(`owner (최상위): ${dungji.owner || 'null'}`);
    console.log(`owner (data): ${data.owner || 'null'}`);
    console.log(`nation (최상위): ${dungji.nation}`);
    console.log(`nation (data): ${data.nation}`);
    console.log(`officer_level (최상위): ${dungji.officer_level ?? 'null'}`);
    console.log(`officer_level (data): ${data.officer_level ?? 'null'}`);
    console.log(`permission (최상위): ${dungji.permission ?? 'null'}`);
    console.log(`permission (data): ${data.permission ?? 'null'}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDungji();
