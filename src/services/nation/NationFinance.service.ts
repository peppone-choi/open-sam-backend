import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';
import { getGoldIncome, getRiceIncome, getWallIncome, getWarGoldIncome, getOutcome } from '../../utils/income-util';

export class NationFinanceService {
    /**
     * Calculate estimated gold income for a nation
     */
    static async calculateGoldIncome(nation: any, cities: any[], generals: any[]): Promise<{ income: number, outcome: number, net: number, breakdown: { city: number; war: number } }> {
        const nationMeta = this.getNationMeta(nation);
        const normalizedCities = this.normalizeCities(cities);
        const normalizedGenerals = this.normalizeGenerals(generals);
        const officerCounts = this.buildOfficerCityCount(normalizedGenerals);

        const cityGoldIncome = getGoldIncome(
            nationMeta.nationId,
            nationMeta.nationLevel,
            nationMeta.taxRate,
            nationMeta.capitalId,
            nationMeta.nationType,
            normalizedCities,
            officerCounts
        );
        const warGoldIncome = getWarGoldIncome(nationMeta.nationType, normalizedCities);
        const goldOutcome = getOutcome(nationMeta.billRate, normalizedGenerals);

        const totalIncome = cityGoldIncome + warGoldIncome;
        return {
            income: totalIncome,
            outcome: goldOutcome,
            net: totalIncome - goldOutcome,
            breakdown: {
                city: cityGoldIncome,
                war: warGoldIncome
            }
        };
    }

    /**
     * Calculate estimated rice income for a nation
     */
    static async calculateRiceIncome(nation: any, cities: any[], generals: any[]): Promise<{ income: number, outcome: number, net: number, breakdown: { city: number; wall: number } }> {
        const nationMeta = this.getNationMeta(nation);
        const normalizedCities = this.normalizeCities(cities);
        const normalizedGenerals = this.normalizeGenerals(generals);
        const officerCounts = this.buildOfficerCityCount(normalizedGenerals);

        const cityRiceIncome = getRiceIncome(
            nationMeta.nationId,
            nationMeta.nationLevel,
            nationMeta.taxRate,
            nationMeta.capitalId,
            nationMeta.nationType,
            normalizedCities,
            officerCounts
        );
        const wallRiceIncome = getWallIncome(
            nationMeta.nationId,
            nationMeta.nationLevel,
            nationMeta.taxRate,
            nationMeta.capitalId,
            nationMeta.nationType,
            normalizedCities,
            officerCounts
        );

        const totalIncome = cityRiceIncome + wallRiceIncome;
        return {
            income: totalIncome,
            outcome: 0,
            net: totalIncome,
            breakdown: {
                city: cityRiceIncome,
                wall: wallRiceIncome
            }
        };
    }

    /**
     * Apply finance update for a specific nation (Monthly Turn)
     */
    static async applyFinanceUpdate(sessionId: string, nationId: number, year: number, month: number): Promise<void> {
        try {
            const nation = await nationRepository.findByNationNum(sessionId, nationId);
            if (!nation) return;

            const cities = await cityRepository.findByFilter({
                session_id: sessionId,
                'data.nation': nationId
            });

            const generals = await generalRepository.findByFilter({
                session_id: sessionId,
                'data.nation': nationId
            });

            const goldStats = await this.calculateGoldIncome(nation, cities, generals);
            const riceStats = await this.calculateRiceIncome(nation, cities, generals);

            // Update Nation Resources
            await nationRepository.updateByNationNum(sessionId, nationId, {
                $inc: {
                    'data.gold': goldStats.net,
                    'data.rice': riceStats.net
                }
            });

            // Log the finance update
            // We might want a nation-wide log or a log for the ruler
            // For now, let's just log to console/system logger
            logger.info(`[NationFinance] Applied update for Nation ${nationId} (Session: ${sessionId})`, {
                year,
                month,
                gold: goldStats,
                rice: riceStats
            });

            // Optional: Send a report to the ruler?
            // TODO: Implement report to ruler

        } catch (error: any) {
            logger.error(`[NationFinance] Error applying update for Nation ${nationId}`, {
                error: error.message,
                stack: error.stack
            });
        }
    }

    private static getNationMeta(nation: any): {
        nationId: number;
        nationLevel: number;
        taxRate: number;
        capitalId: number;
        nationType: string;
        billRate: number;
    } {
        const raw = nation?.data || nation || {};
        return {
            nationId: raw.nation ?? nation?.nation ?? 0,
            nationLevel: raw.level ?? nation?.level ?? 0,
            taxRate: raw.rate_tmp ?? raw.rate ?? nation?.rate ?? 10,
            capitalId: raw.capital ?? nation?.capital ?? 0,
            nationType: raw.type ?? nation?.type ?? 'none',
            billRate: raw.bill ?? nation?.bill ?? 100,
        };
    }

    private static normalizeCities(cities: any[]): any[] {
        return cities.map(city => {
            if (!city) {
                return {};
            }
            return city.data ? { ...city.data } : { ...city };
        });
    }

    private static normalizeGenerals(generals: any[]): any[] {
        return generals.map(general => {
            if (!general) {
                return {};
            }
            return general.data ? { ...general.data } : { ...general };
        });
    }

    private static buildOfficerCityCount(generals: any[]): Record<number, number> {
        const officerCounts: Record<number, number> = {};
        for (const general of generals) {
            const officerLevel = general.officer_level ?? 0;
            const officerCity = general.officer_city ?? 0;
            const generalCity = general.city ?? 0;
            if (officerLevel >= 2 && officerLevel <= 4 && officerCity === generalCity && officerCity > 0) {
                officerCounts[officerCity] = (officerCounts[officerCity] || 0) + 1;
            }
        }
        return officerCounts;
    }
}
