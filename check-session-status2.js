const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/sammo', { 
  serverSelectionTimeoutMS: 3000 
}).then(async () => {
  const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }), 'session');
  const session = await Session.findOne({ session_id: 'sangokushi_default' }).lean();
  
  console.log('session.status:', session?.status || 'undefined');
  console.log('isunited:', session?.data?.game_env?.isunited || session?.data?.isunited || 'undefined');
  
  mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error(err.message);
  process.exit(1);
});
