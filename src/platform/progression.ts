import { NO_MODIFIERS, type Modifiers } from "../games/types";
import { STARTING_GAME_ID, UNLOCKS, type Requirement, type Unlock } from "./unlocks";

export type MetricsByGame = Record<string, Record<string, number>>;

export function gameUnlock(gameId: string): Unlock | undefined {
  return UNLOCKS.find((unlock) => unlock.reward.kind === "game" && unlock.reward.gameId === gameId);
}

export function isGameAvailable(gameId: string, unlocked: ReadonlySet<string>): boolean {
  if (gameId === STARTING_GAME_ID) return true;
  const unlock = gameUnlock(gameId);
  return unlock !== undefined && unlocked.has(unlock.id);
}

/** Position of the game in the unlock chain, used to sort the catalog. */
export function progressionRank(gameId: string): number {
  if (gameId === STARTING_GAME_ID) return 0;
  const index = UNLOCKS.findIndex((unlock) => unlock.reward.kind === "game" && unlock.reward.gameId === gameId);
  return index === -1 ? Infinity : index + 1;
}

export function modifiersFor(gameId: string, unlocked: ReadonlySet<string>): Modifiers {
  const modifiers = { ...NO_MODIFIERS };
  for (const { id, reward } of UNLOCKS) {
    if (reward.kind === "bonus" && reward.gameId === gameId && unlocked.has(id)) {
      modifiers[reward.modifier] *= reward.multiplier;
    }
  }
  return modifiers;
}

export function requirementProgress(requirement: Requirement, metrics: MetricsByGame): number {
  const value = metrics[requirement.gameId]?.[requirement.metric] ?? 0;
  return Math.min(1, value / requirement.amount);
}

export function newlyUnlocked(unlocked: ReadonlySet<string>, metrics: MetricsByGame): Unlock[] {
  return UNLOCKS.filter(
    (unlock) => !unlocked.has(unlock.id) && requirementProgress(unlock.requirement, metrics) >= 1,
  );
}
