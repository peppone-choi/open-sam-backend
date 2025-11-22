import { NationFinanceService } from '../services/nation/NationFinance.service';
import { getGoldIncome, getRiceIncome, getWallIncome, getWarGoldIncome, getOutcome } from '../utils/income-util';

describe('NationFinanceService', () => {
  const nationDoc = {
    data: {
      nation: 1,
      rate: 20,
      rate_tmp: 20,
      level: 2,
      capital: 1,
      type: 'none',
      bill: 120,
    },
  };

  const cities = [
    {
      data: {
        city: 1,
        nation: 1,
        supply: 1,
        pop: 30000,
        comm: 90,
        comm_max: 110,
        trust: 120,
        secu: 85,
        secu_max: 100,
        agri: 140,
        agri_max: 160,
        wall: 250,
        wall_max: 400,
        def: 320,
      },
    },
    {
      data: {
        city: 2,
        nation: 1,
        supply: 1,
        pop: 18000,
        comm: 80,
        comm_max: 100,
        trust: 100,
        secu: 70,
        secu_max: 100,
        agri: 110,
        agri_max: 140,
        wall: 180,
        wall_max: 320,
        def: 250,
      },
    },
  ];

  const generals = [
    {
      data: {
        officer_level: 3,
        officer_city: 1,
        city: 1,
        dedication: 900,
      },
    },
    {
      data: {
        officer_level: 2,
        officer_city: 2,
        city: 2,
        dedication: 450,
      },
    },
  ];

  const buildOfficerCount = () => {
    const counts: Record<number, number> = {};
    for (const general of generals) {
      const data = general.data;
      if (
        data.officer_level >= 2 &&
        data.officer_level <= 4 &&
        data.officer_city === data.city &&
        data.officer_city > 0
      ) {
        counts[data.officer_city] = (counts[data.officer_city] || 0) + 1;
      }
    }
    return counts;
  };

  it('matches income-util calculations for gold', async () => {
    const goldStats = await NationFinanceService.calculateGoldIncome(nationDoc, cities, generals);
    const nationMeta = nationDoc.data;
    const normalizedCities = cities.map((city) => city.data);
    const officerCounts = buildOfficerCount();
    const expectedCityIncome = getGoldIncome(
      nationMeta.nation,
      nationMeta.level,
      nationMeta.rate,
      nationMeta.capital,
      nationMeta.type,
      normalizedCities,
      officerCounts
    );
    const expectedWarIncome = getWarGoldIncome(nationMeta.type, normalizedCities);
    const expectedOutcome = getOutcome(nationMeta.bill, generals.map((general) => general.data));

    expect(goldStats.breakdown.city).toBe(expectedCityIncome);
    expect(goldStats.breakdown.war).toBe(expectedWarIncome);
    expect(goldStats.outcome).toBe(expectedOutcome);
    expect(goldStats.net).toBe(expectedCityIncome + expectedWarIncome - expectedOutcome);
  });

  it('matches income-util calculations for rice', async () => {
    const riceStats = await NationFinanceService.calculateRiceIncome(nationDoc, cities, generals);
    const nationMeta = nationDoc.data;
    const normalizedCities = cities.map((city) => city.data);
    const officerCounts = buildOfficerCount();
    const expectedCityRice = getRiceIncome(
      nationMeta.nation,
      nationMeta.level,
      nationMeta.rate,
      nationMeta.capital,
      nationMeta.type,
      normalizedCities,
      officerCounts
    );
    const expectedWallRice = getWallIncome(
      nationMeta.nation,
      nationMeta.level,
      nationMeta.rate,
      nationMeta.capital,
      nationMeta.type,
      normalizedCities,
      officerCounts
    );

    expect(riceStats.breakdown.city).toBe(expectedCityRice);
    expect(riceStats.breakdown.wall).toBe(expectedWallRice);
    expect(riceStats.net).toBe(expectedCityRice + expectedWallRice);
  });
});
