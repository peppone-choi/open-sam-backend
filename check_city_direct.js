
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/opensam';

const generalSchema = new mongoose.Schema({
    no: Number,
    name: String,
    nation: Number,
    city: Number,
    session_id: String
});

const citySchema = new mongoose.Schema({
    city: Number,
    name: String,
    nation: Number
});

const nationSchema = new mongoose.Schema({
    nation: Number,
    name: String,
    spy: mongoose.Schema.Types.Mixed
});

const General = mongoose.model('General', generalSchema, 'generals');
const City = mongoose.model('City', citySchema, 'city');
const Nation = mongoose.model('Nation', nationSchema, 'nation');

async function checkData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(`Collection ${col.name}: ${count}`);
        }



        const nations = await mongoose.connection.db.collection('nations').find({}).limit(5).toArray();
        console.log('Nations:', JSON.stringify(nations, null, 2));

        const generals = await General.find({}).limit(5);
        console.log('Generals found:', generals.map(g => ({ no: g.no, name: g.name, session: g.session_id })));

        const general = await General.findOne({ owner: '6922c88234ead275d3f546bf' });
        console.log('General for qauser:', general ? {
            no: general.no,
            name: general.name,
            nation: general.nation,
            city: general.city,
            session: general.session_id
        } : 'Not found');

        if (general) {
            const cityId = general.city;
            const city = await City.findOne({ city: cityId });
            console.log(`City ${cityId}:`, city ? {
                name: city.name,
                nation: city.nation
            } : 'Not found');

            const myNationId = general.nation;
            const cityNationId = city?.nation;

            console.log(`Is My Nation: ${myNationId} === ${cityNationId} => ${myNationId === cityNationId}`);
            console.log(`Is Neutral: ${cityNationId} === 0 => ${cityNationId === 0}`);

            if (myNationId > 0) {
                const nation = await Nation.findOne({ nation: myNationId });
                console.log('Nation Spy Data:', nation?.spy);
            }
        }

        const users = await mongoose.connection.db.collection('users').find({}).limit(5).toArray();
        console.log('Users:', JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkData();
