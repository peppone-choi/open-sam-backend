// @ts-nocheck
import { CityDefenseState, ICityDefenseState } from '../models/city_defense_state.model';

class CityDefenseRepository {
  async findByCity(sessionId: string, cityId: number) {
    return CityDefenseState.findOne({ session_id: sessionId, city_id: cityId });
  }

  async ensure(sessionId: string, cityId: number, cityName: string, defaults?: Partial<ICityDefenseState>) {
    // Race condition 방지: upsert 사용
    return CityDefenseState.findOneAndUpdate(
      { session_id: sessionId, city_id: cityId },
      { 
        $setOnInsert: {
          session_id: sessionId,
          city_id: cityId,
          city_name: cityName,
          ...defaults,
        }
      },
      { new: true, upsert: true }
    );
  }

  async update(sessionId: string, cityId: number, update: Partial<ICityDefenseState>) {
    return CityDefenseState.findOneAndUpdate(
      { session_id: sessionId, city_id: cityId },
      { $set: update },
      { new: true, upsert: true }
    );
  }

  async applyDamage(sessionId: string, cityId: number, { wallDamage = 0, gateDamage = 0 }: { wallDamage?: number; gateDamage?: number; }) {
    const state = await this.findByCity(sessionId, cityId);
    if (!state) {
      throw new Error(`CityDefenseState not found for city ${cityId}`);
    }

    if (wallDamage > 0) {
      state.wall_hp = Math.max(0, state.wall_hp - wallDamage);
    }
    if (gateDamage > 0) {
      state.gate_hp = Math.max(0, state.gate_hp - gateDamage);
    }
    state.last_damage_at = new Date();
    await state.save();
    return state;
  }

  async repair(sessionId: string, cityId: number, { wallRepair = 0, gateRepair = 0 }: { wallRepair?: number; gateRepair?: number; }) {
    const state = await this.findByCity(sessionId, cityId);
    if (!state) {
      throw new Error(`CityDefenseState not found for city ${cityId}`);
    }

    if (wallRepair > 0) {
      state.wall_hp = Math.min(state.wall_max, state.wall_hp + wallRepair);
    }
    if (gateRepair > 0) {
      state.gate_hp = Math.min(state.gate_max, state.gate_hp + gateRepair);
    }
    state.last_repair_at = new Date();
    await state.save();
    return state;
  }
}

export const cityDefenseRepository = new CityDefenseRepository();
