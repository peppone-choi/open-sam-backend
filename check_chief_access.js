const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/opensam';

async function checkChiefAccess() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // 군주 계정 찾기 (peppone, grade 12)  
        const users = await db.collection('users').find({ grade: { $gte: 10 } }).toArray();
        console.log('\n=== High grade users ===');
        users.forEach(u => {
            console.log(`${u.username} (grade: ${u.grade})`);
        });

        // 군주 장수 찾기
        const generals = await db.collection('generals').find({
            session_id: 'sangokushi_default',
            'data.officer_level': 12
        }).toArray();

        console.log('\n=== Monarch generals (level 12) ===');
        generals.forEach(g => {
            console.log(`${g.data?.name || g.name} (no: ${g.data?.no || g.no}, owner: ${g.owner}, nation: ${g.data?.nation || g.nation})`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkChiefAccess();
