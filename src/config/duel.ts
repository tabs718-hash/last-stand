export const DUEL_DISTANCES=[3,6,12,15,25] as const;
export type DuelDistance=typeof DUEL_DISTANCES[number];
export const DEFAULT_DUEL_DISTANCE:DuelDistance=12;
export function validateDuelDistance(distance:number):DuelDistance{if(!(DUEL_DISTANCES as readonly number[]).includes(distance))throw new RangeError('Unsupported duel distance');return distance as DuelDistance}
