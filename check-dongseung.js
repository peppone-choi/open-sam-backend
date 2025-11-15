const mongoose = require('mongoose');

async function checkDongseung() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sangokushi');
    
    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false }), 'generals');
    
    // 동승 찾기
    const dongseung = await General.findOne({ 
      $or: [
        { name: '동승' },
        { 'data.name': '동승' }
      ],
      session_id: 'sangokushi_default' 
    });
    
    if (!dongseung) {
      console.log('동승을 찾을 수 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    const data = dongseung.data || {};
    
    console.log('\n=== 동승 정보 ===');
    console.log(`no: ${dongseung.no}`);
    console.log(`이름: ${data.name || dongseung.name}`);
    console.log(`npc (최상위): ${dongseung.npc}`);
    console.log(`npc (data): ${data.npc ?? 'null'}`);
    console.log(`owner (최상위): ${dongseung.owner || 'null'}`);
    console.log(`owner (data): ${data.owner || 'null'}`);
    console.log(`nation (최상위): ${dongseung.nation}`);
    console.log(`nation (data): ${data.nation}`);
    console.log(`officer_level (최상위): ${dongseung.officer_level ?? 'null'}`);
    console.log(`officer_level (data): ${data.officer_level ?? 'null'}`);
    console.log(`turntime (최상위): ${dongseung.turntime}`);
    console.log(`turntime (data): ${data.turntime}`);
    
    // 커맨드 확인
    const GeneralTurn = mongoose.model('GeneralTurn', new mongoose.Schema({}, { strict: false }), 'general_turns');
    const turn = await GeneralTurn.findOne({
      session_id: 'sangokushi_default',
      'data.general_id': dongseung.no,
      'data.turn_idx': 0
    });
    
    if (turn) {
      console.log('\n=== 예약된 커맨드 ===');
      console.log(`action: ${turn.data?.action || turn.action || '없음'}`);
      console.log(`arg: ${JSON.stringify(turn.data?.arg || turn.arg || {})}`);
    } else {
      console.log('\n=== 예약된 커맨드 ===');
      console.log('커맨드 없음');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDongseung();
