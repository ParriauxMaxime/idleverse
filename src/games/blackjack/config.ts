export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

/** 1 is the ace, 11 to 13 are the jack (valet), queen (dame) and king (roi). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const RANK_LABELS: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "V",
  12: "D",
  13: "R",
};

export const BLACKJACK = 21;
export const DEALER_STANDS_ON = 17;
export const SHOE_DECKS = 6;
/** The cut card: the shoe is reshuffled before a deal once fewer cards remain. */
export const RESHUFFLE_BELOW = 78;

export const MIN_BET = 10;
export const FREE_CHIP = 50;

/** Clay chips below 100K, rectangular plaques from 100K up, like in the salons of Monte-Carlo. */
export const CHIP_VALUES = [10, 100, 1_000, 10_000, 100_000, 1e6, 1e7, 1e8, 1e9, 1e10];
export const PLAQUE_FROM = 100_000;

export interface Table {
  name: string;
  /** Highest bet allowed on the table. The biggest chip is a tenth of it. */
  limit: number;
  cost: number;
  blurb: string;
}

export const TABLES: Table[] = [
  { name: "Table des curieux", limit: 1_000, cost: 0, blurb: "Des touristes en espadrilles et un croupier patient." },
  { name: "Salle Europe", limit: 10_000, cost: 50_000, blurb: "Lustres, moquette épaisse et jetons noirs." },
  { name: "Salle des Amériques", limit: 100_000, cost: 1_000_000, blurb: "On y parle bas et on y mise haut." },
  { name: "Salle Blanche", limit: 1e6, cost: 25e6, blurb: "Les premières plaques. Les serveurs portent des gants." },
  { name: "Salons Touzet", limit: 1e7, cost: 6e8, blurb: "Plafonds peints, rideaux de velours, pas d'horloge." },
  { name: "Salons Privés", limit: 1e8, cost: 1.5e10, blurb: "Sur invitation. Le champagne arrive sans le demander." },
  { name: "Le Yacht du Prince", limit: 1e9, cost: 4e11, blurb: "Une table de jeu au large du Rocher." },
  { name: "La Banque de Monaco", limit: 1e10, cost: 1e13, blurb: "Vous ne jouez plus contre la banque. Vous êtes la banque." },
];

export type UpgradeId = "rulebook" | "bribe" | "charm" | "cousin" | "champagne" | "regulars";

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  blurb: string;
  baseCost: number;
  costGrowth: number;
  maxLevel?: number;
}

/** Profit paid on a natural blackjack for each level of the house rulebook. */
export const BLACKJACK_PAYOUTS = [1, 1.5, 2, 3];
export const BLACKJACK_PAYOUT_LABELS = ["1 contre 1", "3 contre 2", "2 contre 1", "3 contre 1"];

/** Chance, once per hand, that the bribed dealer draws a card when he should stand. */
export const BRIBE_CHANCE_PER_LEVEL = 0.06;
/** Chance that a card which would bust the player is blown away and replaced. */
export const CHARM_CHANCE_PER_LEVEL = 0.06;
export const CHAMPAGNE_BONUS_PER_LEVEL = 0.1;
export const HANDS_PER_SECOND_PER_REGULAR = 0.5;

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "rulebook",
    name: "Le règlement de la maison",
    blurb: "Un mot glissé au directeur de salle, et le blackjack paie mieux.",
    baseCost: 5_000,
    costGrowth: 100,
    maxLevel: BLACKJACK_PAYOUTS.length - 1,
  },
  {
    id: "bribe",
    name: "Le croupier soudoyé",
    blurb: "Une enveloppe sous le sabot : il tire parfois une carte de trop.",
    baseCost: 2_000,
    costGrowth: 7,
    maxLevel: 5,
  },
  {
    id: "charm",
    name: "Le trèfle à quatre feuilles",
    blurb: "Quand une carte vous ferait sauter, il la souffle parfois.",
    baseCost: 3_000,
    costGrowth: 7,
    maxLevel: 5,
  },
  {
    id: "regulars",
    name: "Un habitué",
    blurb: "Il joue comme la banque : il tire jusqu'à 16 et reste à 17.",
    baseCost: 10_000,
    costGrowth: 1.6,
  },
  {
    id: "cousin",
    name: "Le chef de partie, votre cousin",
    blurb: "Les égalités ? Il les compte pour vous, avec un clin d'œil.",
    baseCost: 2.5e8,
    costGrowth: 1,
    maxLevel: 1,
  },
  {
    id: "champagne",
    name: "Le champagne du directeur",
    blurb: "Chaque gain est arrosé, et la maison ajoute sa part.",
    baseCost: 1e6,
    costGrowth: 5,
  },
];
