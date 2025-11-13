const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';

async function checkDB() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  
  const generalCount = await db.collection('generals').countDocuments();
  const nationCount = await db.collection('nations').countDocuments();
  const sessionCount = await db.collection('sessions').countDocuments();
  
  console.log('DB 상태:');
  console.log(`  세션: ${sessionCount}개`);
  console.log(`  국가: ${nationCount}개`);
  console.log(`  장수: ${generalCount}개`);
  
  if (generalCount > 0) {
    const sample = await db.collection('generals').findOne({});
    console.log('\n샘플 장수:', JSON.stringify(sample, null, 2).substring(0, 500));
  }
  
  if (nationCount > 0) {
    const nations = await db.collection('nations').find({}).limit(5).toArray();
    console.log('\n국가 목록:');
    nations.forEach(n => {
      console.log(`  - ${n.data?.name || n.name}: gennum=${n.data?.gennum || 0}`);
    });
  }
  
  await mongoose.disconnect();
}

checkDB();
