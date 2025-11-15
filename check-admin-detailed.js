const mongoose = require('mongoose');

async function checkAdminPermissions() {
  try {
    // MongoDB 연결 (sangokushi 데이터베이스)
    await mongoose.connect('mongodb://localhost:27017/sangokushi');
    console.log('✅ MongoDB 연결 성공 (sangokushi DB)');
    
    // User 모델 정의
    const UserSchema = new mongoose.Schema({
      username: String,
      name: String,
      grade: Number,
      acl: mongoose.Schema.Types.Mixed,
      game_mode: String,
      password: String,
      no: String
    }, { collection: 'users' });
    
    const User = mongoose.model('User', UserSchema);
    
    // 1. 사용자 컬렉션 스키마 확인
    console.log('\n=== 1. 사용자 컬렉션 스키마 확인 ===');
    const totalUsers = await User.countDocuments();
    console.log('전체 사용자 수:', totalUsers);
    
    const users = await User.find({}).limit(5);
    console.log('\n샘플 사용자 데이터:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Name: ${user.name || '없음'}`);
      console.log(`   Grade: ${user.grade || '없음'}`);
      console.log(`   ACL: ${JSON.stringify(user.acl) || '없음'}`);
      console.log(`   Game Mode: ${user.game_mode || '없음'}`);
      console.log('---');
    });
    
    // 2. 어드민 권한 사용자 확인 (grade >= 5)
    console.log('\n=== 2. 어드민 권한 사용자 확인 ===');
    const adminUsers = await User.find({ grade: { $gte: 5 } });
    console.log('총 어드민 수:', adminUsers.length);
    adminUsers.forEach((admin, index) => {
      console.log(`${index + 1}. ID: ${admin._id}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Name: ${admin.name || '없음'}`);
      console.log(`   Grade: ${admin.grade} (어드민)`);
      console.log(`   ACL: ${JSON.stringify(admin.acl) || '없음'}`);
      console.log('---');
    });
    
    // 3. 전체 사용자 등급 분포
    console.log('\n=== 3. 전체 사용자 등급 분포 ===');
    const gradeDistribution = await User.aggregate([
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    console.log('등급 분포:');
    gradeDistribution.forEach(item => {
      const grade = item._id || '미지정';
      const isAdmin = (item._id >= 5) ? ' (어드민)' : '';
      console.log(`Grade ${grade}: ${item.count}명${isAdmin}`);
    });
    
    // 4. 특정 ACL 권한 가진 사용자
    console.log('\n=== 4. 특정 ACL 권한 가진 사용자 ===');
    const specialACLUsers = await User.find({ 
      acl: { $ne: null },
      acl: { $ne: {} }
    });
    console.log('특별 ACL 권한 사용자 수:', specialACLUsers.length);
    specialACLUsers.forEach((user, index) => {
      console.log(`${index + 1}. User: ${user.username} | ACL: ${JSON.stringify(user.acl)}`);
    });
    
    // 5. 어드민 메뉴 표시 조건 확인
    console.log('\n=== 5. 어드민 메뉴 표시 조건 확인 ===');
    console.log('어드민 메뉴 표시 조건:');
    console.log('- Grade >= 5 이상');
    console.log('- 또는 ACL이 "*" (와일드카드) 인 경우');
    console.log('- 현재 어드민 수:', adminUsers.length);
    
    // 6. 로그인한 사용자 권한 확인 (예시)
    console.log('\n=== 6. 현재 로그인 가능한 어드민 계정 ===');
    adminUsers.forEach(admin => {
      console.log(`- ${admin.username} (Grade: ${admin.grade}) - 어드민 메뉴 접근 가능 ✅`);
    });
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB 연결 종료');
  }
}

checkAdminPermissions();