
import mongoose from 'mongoose';
import { generalRepository } from './src/repositories/general.repository';
import { cityRepository } from './src/repositories/city.repository';
import { nationRepository } from './src/repositories/nation.repository';
import { connectToDatabase } from './src/utils/db';

async function checkData() {
    await connectToDatabase('sangokushi_default');

    // Assuming user ID is 1001 or we can find by owner
    // But since I don't have the owner ID easily, I'll list all generals to find the one I'm using.
    // Actually, I can just check general 1001 as it's likely the test user.

    const general = await generalRepository.findByGeneralNum('sangokushi_default', 1001);
    console.log('General 1001:', general ? {
        name: general.name,
        nation: general.nation,
        city: general.city
    } : 'Not found');

    if (general) {
        const cityId = general.city;
        const city = await cityRepository.findByCityNum('sangokushi_default', cityId);
        console.log(`City ${cityId}:`, city ? {
            name: city.name,
            nation: city.nation
        } : 'Not found');

        const myNationId = general.nation;
        const cityNationId = city?.nation;

        console.log(`Is My Nation: ${myNationId} === ${cityNationId} => ${myNationId === cityNationId}`);
        console.log(`Is Neutral: ${cityNationId} === 0 => ${cityNationId === 0}`);

        if (myNationId > 0) {
            const nation = await nationRepository.findByNationNum('sangokushi_default', myNationId);
            console.log('Nation Spy Data:', nation?.spy);
        }
    }

    process.exit(0);
}

checkData();
