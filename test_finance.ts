
import { NationFinanceService } from './src/services/nation/NationFinance.service';
import { GetNationStratFinanService } from './src/services/nation/GetNationStratFinan.service';

// Mock data
const mockNation = {
    nation: 1,
    rate: 20, // 20% tax
    gold: 1000,
    rice: 1000
};

const mockCities = [
    { pop: 10000, agri: 10000, data: { pop: 10000, agri: 10000 } },
    { pop: 20000, agri: 20000, data: { pop: 20000, agri: 20000 } }
];

const mockGenerals = [
    { officer_level: 5, crew: 1000, data: { officer_level: 5, crew: 1000 } }, // Salary: 100, Rice: 100
    { officer_level: 1, crew: 500, data: { officer_level: 1, crew: 500 } }   // Salary: 20, Rice: 50
];

async function testFinance() {
    console.log('Testing NationFinanceService...');

    const goldStats = await NationFinanceService.calculateGoldIncome(mockNation, mockCities, mockGenerals);
    console.log('Gold Stats:', goldStats);
    // Expected:
    // Income: (10000 * 20/100) + (20000 * 20/100) = 2000 + 4000 = 6000
    // Outcome: (5 * 20) + (1 * 20) = 100 + 20 = 120
    // Net: 5880

    const riceStats = await NationFinanceService.calculateRiceIncome(mockNation, mockCities, mockGenerals);
    console.log('Rice Stats:', riceStats);
    // Expected:
    // Income: (10000 * 20/100) + (20000 * 20/100) = 6000
    // Outcome: (1000/10) + (500/10) = 100 + 50 = 150
    // Net: 5850

    if (goldStats.net === 5880 && riceStats.net === 5850) {
        console.log('✅ Calculation Logic Verified');
    } else {
        console.error('❌ Calculation Logic Failed');
    }
}

testFinance().catch(console.error);
