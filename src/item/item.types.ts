export interface IItem {
  _id?: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  effects: Record<string, number>;
  ownerId: string | null;
}
