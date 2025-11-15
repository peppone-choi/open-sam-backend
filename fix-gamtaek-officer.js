const mongoose = require('mongoose');

async function fixGamtaekOfficer() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    // 감택 찾기
    const gamtaek = await General.findOne({ 
      session_id: 'sangokushi_default',
      no: 1014
    });
    
    if (!gamtaek) {
      console.log('감택을 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    console.log('=== 수정 전 ===');
    console.log(`이름: ${gamtaek.data?.name || gamtaek.name}`);
    console.log(`Nation: ${gamtaek.data?.nation || gamtaek.nation}`);
    console.log(`officer_level (data): ${gamtaek.data?.officer_level}`);
    console.log(`officer_level (최상위): ${gamtaek.officer_level}`);
    console.log(`permission: ${gamtaek.data?.permission || gamtaek.permission}`);
    
    // 수정: 국가에 소속되어 있으므로 officer_level을 1로 설정
    if (!gamtaek.data) gamtaek.data = {};
    gamtaek.data.officer_level = 1;
    gamtaek.officer_level = 1;
    
    // permission도 설정
    if (!gamtaek.data.permission) {
      gamtaek.data.permission = 0; // 일반 관직
    }
    
    gamtaek.markModified('data');
    await gamtaek.save();
    
    console.log('\n=== 수정 후 ===');
    console.log(`officer_level: ${gamtaek.data.officer_level}`);
    console.log(`permission: ${gamtaek.data.permission}`);
    console.log('\n수정 완료!');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixGamtaekOfficer();
