export interface IBattle {
  _id?: string;
  attackerNationId: string;
  defenderNationId: string;
  cityId: string;
  status: 'ongoing' | 'attacker_won' | 'defender_won';
  startedAt: Date;
  endedAt: Date | null;
}
