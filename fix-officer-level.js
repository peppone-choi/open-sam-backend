const mongoose = require('mongoose');

async function fixOfficerLevel() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    // 감택(no: 1014) 장수 조회
    const general = await General.findOne({ 
      session_id: 'sangokushi_default',
      no: 1014 
    });
    
    if (!general) {
      console.log('장수를 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n=== 수정 전 ===');
    console.log(`이름: ${general.data?.name || general.name}`);
    console.log(`nation: ${general.data?.nation || general.nation}`);
    console.log(`officer_level: ${general.data?.officer_level ?? general.officer_level ?? '없음'}`);
    console.log(`permission: ${general.data?.permission ?? general.permission ?? '없음'}`);
    
    // nation이 2인데 officer_level이 0이면 수정
    const nation = general.data?.nation ?? general.nation ?? 0;
    if (nation > 0) {
      if (!general.data) general.data = {};
      
      // 일반 장수로 설정 (officer_level = 1)
      general.data.officer_level = 1;
      general.officer_level = 1;
      
      // permission도 설정
      general.data.permission = 0; // 일반 장수
      general.permission = 0;
      
      general.markModified('data');
      await general.save();
      
      console.log('\n=== 수정 후 ===');
      console.log(`officer_level: ${general.data.officer_level}`);
      console.log(`permission: ${general.data.permission}`);
      console.log('\n✅ 수정 완료! 이제 회의실에 접근할 수 있습니다.');
    } else {
      console.log('\n재야 장수입니다. 국가에 가입해주세요.');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixOfficerLevel();
