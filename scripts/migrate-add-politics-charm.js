const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect('mongodb://localhost:27017/sangokushi');
  
  const db = mongoose.connection.db;
  const generals = db.collection('generals');
  
  // politics와 charm이 없는 장수들 찾기
  const result = await generals.updateMany(
    {
      $or: [
        { 'data.politics': { $exists: false } },
        { 'data.charm': { $exists: false } }
      ]
    },
    [
      {
        $set: {
          'data.politics': {
            $ifNull: [
              '$data.politics',
              { $avg: ['$data.leadership', '$data.strength', '$data.intel'] }
            ]
          },
          'data.charm': {
            $ifNull: [
              '$data.charm',
              { $avg: ['$data.leadership', '$data.strength', '$data.intel'] }
            ]
          },
          'data.politics_exp': { $ifNull: ['$data.politics_exp', 0] },
          'data.charm_exp': { $ifNull: ['$data.charm_exp', 0] }
        }
      }
    ]
  );
  
  console.log(`Updated ${result.modifiedCount} generals`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
