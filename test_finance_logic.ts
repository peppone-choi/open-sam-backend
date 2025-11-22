
// Self-contained test to verify the logic intended for NationFinanceService

const mockNation = {
    nation: 1,
    rate: 20, // 20% tax
    gold: 1000,
    rice: 1000
};

const mockCities = [
    { pop: 10000, agri: 10000 },
    { pop: 20000, agri: 20000 }
];

const mockGenerals = [
    { officer_level: 5, crew: 1000 },
    { officer_level: 1, crew: 500 }
];

function calculateGoldIncome(nation: any, cities: any[], generals: any[]) {
    let income = 0;
    let outcome = 0;
    const rate = nation.rate || 10;

    for (const city of cities) {
        const pop = city.pop || 0;
        const cityIncome = Math.floor(pop * rate / 100);
        income += cityIncome;
    }

    for (const general of generals) {
        const officerLevel = general.officer_level || 0;
        const salary = (officerLevel > 0 ? officerLevel : 1) * 20;
        outcome += salary;
    }

    return { income, outcome, net: income - outcome };
}

function calculateRiceIncome(nation: any, cities: any[], generals: any[]) {
    let income = 0;
    let outcome = 0;
    const rate = nation.rate || 10;

    for (const city of cities) {
        const agri = city.agri || 0;
        const cityIncome = Math.floor(agri * rate / 100);
        income += cityIncome;
    }

    for (const general of generals) {
        const crew = general.crew || 0;
        const consumption = Math.ceil(crew / 10);
        outcome += consumption;
    }

    return { income, outcome, net: income - outcome };
}

console.log('Testing Finance Logic Formulas...');

const goldStats = calculateGoldIncome(mockNation, mockCities, mockGenerals);
console.log('Gold Stats:', goldStats);

const riceStats = calculateRiceIncome(mockNation, mockCities, mockGenerals);
console.log('Rice Stats:', riceStats);

if (goldStats.net === 5880 && riceStats.net === 5850) {
    console.log('✅ Logic Verified');
} else {
    console.error('❌ Logic Failed');
}
