const mongoose = require('mongoose');

async function fixDongseung() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sangokushi');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    const dongseung = await General.findOne({ 
      no: 1081,
      session_id: 'sangokushi_default' 
    });
    
    if (!dongseung) {
      console.log('동승을 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n=== 수정 전 ===');
    console.log(`officer_level: ${dongseung.officer_level}`);
    console.log(`turntime: ${dongseung.turntime}`);
    
    // 1. officer_level 수정 (국가 소속이므로 1)
    dongseung.officer_level = 1;
    if (!dongseung.data) dongseung.data = {};
    dongseung.data.officer_level = 1;
    
    // 2. turntime을 현재 시간으로 리셋
    const now = new Date();
    dongseung.turntime = now;
    dongseung.data.turntime = now.toISOString();
    
    await dongseung.save();
    
    console.log('\n=== 수정 후 ===');
    console.log(`officer_level: ${dongseung.officer_level}`);
    console.log(`turntime: ${dongseung.turntime}`);
    console.log('\n✅ 동승의 데이터가 수정되었습니다.');
    console.log('다음 턴부터 정상적으로 실행됩니다.');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDongseung();
