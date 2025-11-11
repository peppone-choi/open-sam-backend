const mongoose = require('mongoose');

async function checkStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sam');
    
    const Session = mongoose.model('Session', new mongoose.Schema({
      session_id: String,
      status: String,
      data: mongoose.Schema.Types.Mixed
    }, { collection: 'sessions', strict: false }));
    
    const sessions = await Session.find({}).select('session_id status data.game_env').lean();
    
    console.log('=== Session Status ===');
    for (const session of sessions) {
      console.log(`Session: ${session.session_id}`);
      console.log(`  Status: ${session.status || 'undefined'}`);
      console.log(`  isunited: ${session.data?.game_env?.isunited || 'undefined'}`);
      console.log('');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStatus();
