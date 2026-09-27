import type { Modifiers } from "../games/types";

export interface Requirement {
  gameId: string;
  metric: string;
  amount: number;
  label: string;
}

export type Reward =
  | { kind: "game"; gameId: string }
  | { kind: "bonus"; gameId: string; modifier: keyof Modifiers; multiplier: number };

export interface Unlock {
  id: string;
  requirement: Requirement;
  reward: Reward;
}

export const STARTING_GAME_ID = "black-hole";

export const UNLOCKS: Unlock[] = [
  {
    id: "slime-lab",
    requirement: { gameId: "black-hole", metric: "absorbedMass", amount: 2_500, label: "Absorbe 2.5K de masse dans Trou noir" },
    reward: { kind: "game", gameId: "slime-lab" },
  },
  {
    id: "slimes-feed-black-hole",
    requirement: { gameId: "slime-lab", metric: "speciesDiscovered", amount: 4, label: "Découvre 4 espèces de slimes" },
    reward: { kind: "bonus", gameId: "black-hole", modifier: "production", multiplier: 2 },
  },
  {
    id: "rumor",
    requirement: { gameId: "slime-lab", metric: "speciesDiscovered", amount: 5, label: "Découvre 5 espèces de slimes" },
    reward: { kind: "game", gameId: "rumor" },
  },
  {
    id: "stars-heat-slimes",
    requirement: { gameId: "black-hole", metric: "absorbedMass", amount: 75_000, label: "Absorbe 75K de masse dans Trou noir" },
    reward: { kind: "bonus", gameId: "slime-lab", modifier: "production", multiplier: 2 },
  },
  {
    id: "rumor-hypes-black-hole",
    requirement: { gameId: "rumor", metric: "scopeLevel", amount: 3, label: "Propage la rumeur jusqu'au Quartier" },
    reward: { kind: "bonus", gameId: "black-hole", modifier: "tap", multiplier: 3 },
  },
  {
    id: "galaxies-inspire-rumor",
    requirement: { gameId: "black-hole", metric: "absorbedMass", amount: 3_000_000, label: "Absorbe 3M de masse dans Trou noir" },
    reward: { kind: "bonus", gameId: "rumor", modifier: "tap", multiplier: 5 },
  },
  {
    id: "rumor-sells-slimes",
    requirement: { gameId: "rumor", metric: "scopeLevel", amount: 5, label: "Propage la rumeur jusqu'au Pays" },
    reward: { kind: "bonus", gameId: "slime-lab", modifier: "tap", multiplier: 3 },
  },
  {
    id: "royal-slime-spreads-rumor",
    requirement: { gameId: "slime-lab", metric: "speciesDiscovered", amount: 7, label: "Découvre 7 espèces de slimes" },
    reward: { kind: "bonus", gameId: "rumor", modifier: "production", multiplier: 2 },
  },
  {
    id: "piggy-mob",
    requirement: { gameId: "rumor", metric: "scopeLevel", amount: 4, label: "Propage la rumeur jusqu'à la Ville" },
    reward: { kind: "game", gameId: "piggy-mob" },
  },
  {
    id: "family-funds-rumor",
    requirement: { gameId: "piggy-mob", metric: "contractsCompleted", amount: 8, label: "Remplis 8 contrats pour le Parrain" },
    reward: { kind: "bonus", gameId: "rumor", modifier: "production", multiplier: 2 },
  },
  {
    id: "black-hole-swallows-evidence",
    requirement: { gameId: "black-hole", metric: "absorbedMass", amount: 10_000_000, label: "Absorbe 10M de masse dans Trou noir" },
    reward: { kind: "bonus", gameId: "piggy-mob", modifier: "tap", multiplier: 3 },
  },
  {
    id: "royal-slime-joins-family",
    requirement: { gameId: "slime-lab", metric: "speciesDiscovered", amount: 8, label: "Découvre les 8 espèces de slimes" },
    reward: { kind: "bonus", gameId: "piggy-mob", modifier: "production", multiplier: 2 },
  },
  {
    id: "strongman",
    requirement: { gameId: "piggy-mob", metric: "contractsCompleted", amount: 5, label: "Remplis 5 contrats pour le Parrain" },
    reward: { kind: "game", gameId: "strongman" },
  },
  {
    id: "strongman-throws-comets",
    requirement: { gameId: "strongman", metric: "maxKilograms", amount: 300, label: "Soulève les tonneaux de bière dans L'Hercule Forain" },
    reward: { kind: "bonus", gameId: "black-hole", modifier: "tap", multiplier: 3 },
  },
  {
    id: "strongman-joins-family",
    requirement: { gameId: "strongman", metric: "maxKilograms", amount: 1_800, label: "Soulève le piano à queue dans L'Hercule Forain" },
    reward: { kind: "bonus", gameId: "piggy-mob", modifier: "tap", multiplier: 2 },
  },
  {
    id: "strongman-kneads-slimes",
    requirement: { gameId: "strongman", metric: "liftsCompleted", amount: 1_000, label: "Réussis 1 000 levers dans L'Hercule Forain" },
    reward: { kind: "bonus", gameId: "slime-lab", modifier: "tap", multiplier: 3 },
  },
  {
    id: "family-sponsors-strongman",
    requirement: { gameId: "piggy-mob", metric: "contractsCompleted", amount: 12, label: "Remplis 12 contrats pour le Parrain" },
    reward: { kind: "bonus", gameId: "strongman", modifier: "tap", multiplier: 2 },
  },
  {
    id: "world-cheers-strongman",
    requirement: { gameId: "rumor", metric: "scopeLevel", amount: 6, label: "Propage la rumeur jusqu'au Monde" },
    reward: { kind: "bonus", gameId: "strongman", modifier: "production", multiplier: 2 },
  },
  {
    id: "blackjack",
    requirement: { gameId: "strongman", metric: "maxKilograms", amount: 750, label: "Soulève les enclumes du forgeron dans L'Hercule Forain" },
    reward: { kind: "game", gameId: "blackjack" },
  },
  {
    id: "casino-books-strongman",
    requirement: { gameId: "blackjack", metric: "handsWon", amount: 100, label: "Gagne 100 mains au Vingt-et-Un" },
    reward: { kind: "bonus", gameId: "strongman", modifier: "production", multiplier: 2 },
  },
  {
    id: "family-launders-at-casino",
    requirement: { gameId: "blackjack", metric: "tableLevel", amount: 5, label: "Ouvre la 5e table du casino" },
    reward: { kind: "bonus", gameId: "piggy-mob", modifier: "tap", multiplier: 3 },
  },
  {
    id: "strongman-guards-casino",
    requirement: { gameId: "strongman", metric: "maxKilograms", amount: 4_500, label: "Soulève le cheval de trait dans L'Hercule Forain" },
    reward: { kind: "bonus", gameId: "blackjack", modifier: "tap", multiplier: 2 },
  },
  {
    id: "family-backs-casino",
    requirement: { gameId: "piggy-mob", metric: "contractsCompleted", amount: 15, label: "Remplis 15 contrats pour le Parrain" },
    reward: { kind: "bonus", gameId: "blackjack", modifier: "production", multiplier: 2 },
  },
];
