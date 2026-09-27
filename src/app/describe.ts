import { findGame } from "../games/registry";
import type { Modifiers } from "../games/types";
import type { Reward } from "../platform/unlocks";

const MODIFIER_LABELS: Record<keyof Modifiers, string> = {
  production: "production",
  tap: "gain par clic",
};

export function describeReward(reward: Reward): string {
  const game = findGame(reward.gameId)!;
  if (reward.kind === "game") return `Nouveau jeu : ${game.emoji} ${game.name}`;
  return `${game.emoji} ${game.name} : ${MODIFIER_LABELS[reward.modifier]} ×${reward.multiplier}`;
}

export function describeModifiers(modifiers: Modifiers): string {
  return (Object.keys(MODIFIER_LABELS) as (keyof Modifiers)[])
    .filter((key) => modifiers[key] !== 1)
    .map((key) => `${MODIFIER_LABELS[key]} ×${modifiers[key]}`)
    .join(" · ");
}
