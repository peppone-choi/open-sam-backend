import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';
import { NationFinanceService } from './NationFinance.service';

export class GetNationStratFinanService {
    static async execute(data: any, user?: any) {
        const sessionId = data.session_id || 'sangokushi_default';
        const generalId = user?.generalId || data.general_id;

        try {
            if (!generalId) {
                return { success: false, message: '장수 ID가 필요합니다' };
            }

            const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
            if (!general) {
                return { success: false, message: '장수를 찾을 수 없습니다' };
            }

            const nationId = general.data?.nation || 0;
            if (nationId === 0) {
                return { success: false, message: '국가에 소속되어 있지 않습니다' };
            }

            const nation = await nationRepository.findByNationNum(sessionId, nationId);
            if (!nation) {
                return { success: false, message: '국가를 찾을 수 없습니다' };
            }

            const cities = await cityRepository.findByFilter({
                session_id: sessionId,
                'data.nation': nationId
            });

            const generals = await generalRepository.findByFilter({
                session_id: sessionId,
                'data.nation': nationId
            });

            const goldStats = await NationFinanceService.calculateGoldIncome(nation, cities, generals);
            const riceStats = await NationFinanceService.calculateRiceIncome(nation, cities, generals);

            return {
                success: true,
                result: true,
                income: {
                    gold: {
                        income: goldStats.income,
                        outcome: goldStats.outcome,
                        net: goldStats.net,
                        breakdown: goldStats.breakdown
                    },
                    rice: {
                        income: riceStats.income,
                        outcome: riceStats.outcome,
                        net: riceStats.net,
                        breakdown: riceStats.breakdown
                    }
                },
                nation: {
                    gold: nation.data?.gold || 0,
                    rice: nation.data?.rice || 0,
                    rate: nation.data?.rate || 0,
                    bill: nation.data?.bill || 0
                }
            };

        } catch (error: any) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}
