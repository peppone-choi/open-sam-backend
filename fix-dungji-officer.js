const mongoose = require('mongoose');

async function fixDungji() {
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
    
    console.log('\n=== 수정 전 ===');
    console.log(`officer_level: ${dungji.officer_level}`);
    console.log(`permission: ${dungji.permission}`);
    console.log(`nation: ${dungji.nation}`);
    
    // 국가에 소속되어 있으므로 officer_level = 1 (일반 관직)
    dungji.officer_level = 1;
    dungji.permission = 0;
    
    if (!dungji.data) dungji.data = {};
    dungji.data.officer_level = 1;
    dungji.data.permission = 0;
    
    await dungji.save();
    
    console.log('\n=== 수정 후 ===');
    console.log(`officer_level: ${dungji.officer_level}`);
    console.log(`permission: ${dungji.permission}`);
    console.log('\n✅ 등지의 관직 정보가 수정되었습니다.');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDungji();
