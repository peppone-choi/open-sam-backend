const mongoose = require('mongoose');

async function checkAdminPermissions() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam');
    console.log('✅ MongoDB 연결 성공');
    
    // 현재 데이터베이스 정보
    console.log('📊 현재 데이터베이스:', mongoose.connection.name);
    
    // 모든 컬렉션 확인
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=== 데이터베이스 컬렉션 목록 ===');
    collections.forEach(collection => {
      console.log('-', collection.name);
    });
    
    // users 컬렉션 문서 수
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    console.log('\n👥 users 컬렉션 문서 수:', userCount);
    
    // member 컬렉션 확인 (레거시)
    const memberCount = await mongoose.connection.db.collection('member').countDocuments();
    console.log('👥 member 컬렉션 문서 수:', memberCount);
    
    if (userCount > 0) {
      // User 모델로도 확인
      const UserSchema = new mongoose.Schema({
        username: String,
        name: String,
        grade: Number,
        acl: mongoose.Schema.Types.Mixed,
        game_mode: String
      }, { collection: 'users' });
      
      const User = mongoose.model('User', UserSchema);
      
      // 1. 사용자 컬렉션 스키마 확인
      console.log('\n=== 1. 사용자 컬렉션 스키마 확인 ===');
      const users = await User.find({}).limit(5);
      console.log('샘플 사용자 데이터:');
      users.forEach(user => {
        console.log('ID:', user._id.toString());
        console.log('Username:', user.username);
        console.log('Name:', user.name || '없음');
        console.log('Grade:', user.grade || '없음');
        console.log('ACL:', user.acl || '없음');
        console.log('---');
      });
      
      // 2. 어드민 권한 사용자 확인 (grade >= 5)
      console.log('\n=== 2. 어드민 권한 사용자 확인 ===');
      const adminUsers = await User.find({ grade: { $gte: 5 } });
      console.log('총 어드민 수:', adminUsers.length);
      adminUsers.forEach(admin => {
        console.log(`어드민 - ID: ${admin._id} | Username: ${admin.username} | Grade: ${admin.grade}`);
      });
      
      // 3. 전체 사용자 등급 분포
      console.log('\n=== 3. 전체 사용자 등급 분포 ===');
      const gradeDistribution = await User.aggregate([
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      console.log('등급 분포:');
      gradeDistribution.forEach(item => {
        console.log(`Grade ${item._id || '미지정'}: ${item.count}명`);
      });
      
      // 4. 특정 ACL 권한 가진 사용자
      console.log('\n=== 4. 특정 ACL 권한 가진 사용자 ===');
      const specialACLUsers = await User.find({ 
        acl: { $ne: null },
        acl: { $ne: {} }
      });
      console.log('특별 ACL 권한 사용자 수:', specialACLUsers.length);
      specialACLUsers.forEach(user => {
        console.log(`User: ${user.username} | ACL: ${JSON.stringify(user.acl)}`);
      });
      
    } else {
      console.log('\n⚠️ users 컬렉션에 데이터가 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB 연결 종료');
  }
}

checkAdminPermissions();