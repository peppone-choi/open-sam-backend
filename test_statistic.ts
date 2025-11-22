// @ts-nocheck
import { ExecuteEngineService } from './src/services/global/ExecuteEngine.service';
import { nationRepository } from './src/repositories/nation.repository';
import { cityRepository } from './src/repositories/city.repository';
import { generalRepository } from './src/repositories/general.repository';
import mongoose from 'mongoose';

// Mock Repositories
nationRepository.findByFilter = async () => [
    { nation: 1, data: { name: 'Test Nation', color: '#FF0000', gold: 1000, rice: 1000 } }
] as any;

cityRepository.findByFilter = async () => [
    { city: 1, data: { nation: 1, pop: 10000 } },
    { city: 2, data: { nation: 1, pop: 20000 } }
] as any;

generalRepository.findByFilter = async () => [
    { no: 1, name: 'General A', nation: 1, data: { leadership: 90, strength: 80, intellect: 70, experience: 1000 } },
    { no: 2, name: 'General B', nation: 1, data: { leadership: 80, strength: 90, intellect: 60, experience: 800 } }
] as any;

// Mock Mongoose Model to intercept dynamic import
const mockStatistic = {
    create: async (data: any) => {
        console.log('📝 [Mock] Statistic.create called with:', JSON.stringify(data, null, 2));
        return true;
    }
};

// Hijack mongoose.model to return our mock
mongoose.model = ((name: string) => {
    if (name === 'Statistic') return mockStatistic;
    return {};
}) as any;

// Also hijack models object
(mongoose as any).models = {
    Statistic: mockStatistic
};

async function testStatistic() {
    console.log('🧪 Testing Statistics Logic...');

    // Mock Game Environment (Quarter 1: Month 1)
    const gameEnv = { year: 184, month: 1 };
    const sessionId = 'test_session';

    try {
        // Access private method
        await (ExecuteEngineService as any).checkStatistic(sessionId, gameEnv);
        console.log('✅ checkStatistic executed successfully');
    } catch (error) {
        console.error('❌ Error calling checkStatistic:', error);
    }
}

// Run test
testStatistic();
