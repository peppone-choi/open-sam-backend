
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://localhost:27017/sangokushi';

const generalSchema = new mongoose.Schema({
    no: Number,
    name: String,
    nation: Number,
    city: Number
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

const General = mongoose.model('General', generalSchema, 'general');
const City = mongoose.model('City', citySchema, 'city');
const Nation = mongoose.model('Nation', nationSchema, 'nation');

async function checkData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const generals = await General.find({}).limit(5);
        console.log('Generals found:', generals.map(g => ({ no: g.no, name: g.name })));

        const general = await General.findOne({ no: 1001 });
        console.log('General 1001:', general ? {
            name: general.name,
            nation: general.nation,
            city: general.city
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
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkData();
