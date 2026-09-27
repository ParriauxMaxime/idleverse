export type UpgradeId = "protein" | "training" | "coach" | "magnesia" | "autoLift";

export type WeightLook =
  | "bar"
  | "plates"
  | "cannonballs"
  | "barrels"
  | "anvils"
  | "piano"
  | "horse"
  | "elephant"
  | "locomotive"
  | "tent";

export interface Weight {
  name: string;
  look: WeightLook;
  kilograms: number;
  payout: number;
  cost: number;
  boast: string;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  blurb: string;
  baseCost: number;
  costGrowth: number;
  maxLevel?: number;
}

/** Strength of one tap in kilograms: the bare 20 kg bar takes 9 quick taps. */
export const BASE_TAP_KILOGRAMS = 2.4;

/** Share of the full lift the bar loses per second once the strongman stops being pushed. */
export const SINK_PER_SECOND = 0.45;
export const SINK_GRACE_SECONDS = 0.35;

export const PROTEIN_STRENGTH_BONUS = 0.3;
export const TRAINING_STRENGTH_MULTIPLIER = 2;
export const COACH_SINK_MULTIPLIER = 0.6;
export const MAGNESIA_PAYOUT_MULTIPLIER = 1.5;
/** Each level pushes the bar on its own like one tap per second. */
export const AUTO_PUSHES_PER_LEVEL = 1;

/** Fifth game of the progression: each weight is about ×2.5 heavier and pays about ×7 more per lift. */
export const WEIGHTS: Weight[] = [
  { name: "Barre à vide", look: "bar", kilograms: 20, payout: 1, cost: 0, boast: "Un échauffement, mesdames et messieurs !" },
  { name: "Disques en fonte", look: "plates", kilograms: 50, payout: 7, cost: 40, boast: "De la vraie fonte, garantie par la maison !" },
  { name: "Boulets de canon", look: "cannonballs", kilograms: 120, payout: 50, cost: 900, boast: "Pris à l'armée de Napoléon, rien que ça !" },
  { name: "Tonneaux de bière", look: "barrels", kilograms: 300, payout: 330, cost: 20_000, boast: "Pleins ! Personne ne touche aux tonneaux !" },
  { name: "Enclumes du forgeron", look: "anvils", kilograms: 750, payout: 2_200, cost: 400_000, boast: "Le forgeron pleure, le public exulte !" },
  { name: "Piano à queue", look: "piano", kilograms: 1_800, payout: 15_000, cost: 8_000_000, boast: "Avec le pianiste dessus, s'il vous plaît !" },
  { name: "Cheval de trait", look: "horse", kilograms: 4_500, payout: 110_000, cost: 180_000_000, boast: "Il s'appelle Gaston. Gaston est ravi." },
  { name: "Éléphant du cirque", look: "elephant", kilograms: 11_000, payout: 750_000, cost: 4e9, boast: "La trompe en l'air ! Quel spectacle !" },
  { name: "Locomotive à vapeur", look: "locomotive", kilograms: 27_000, payout: 5_000_000, cost: 1e11, boast: "Tchou-tchou ! Et hop, au-dessus de la tête !" },
  { name: "Le chapiteau entier", look: "tent", kilograms: 65_000, payout: 35_000_000, cost: 3e12, boast: "L'HOMME LE PLUS FORT DU MONDE, c'est prouvé !" },
];

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "protein",
    name: "Shaker de protéines",
    blurb: "Œufs crus, lait de jument et un secret de famille.",
    baseCost: 12,
    costGrowth: 1.45,
  },
  {
    id: "coach",
    name: "Coach moustachu",
    blurb: "Il hurle « Tiens bon ! » et la barre retombe moins vite.",
    baseCost: 25,
    costGrowth: 4,
    maxLevel: 5,
  },
  {
    id: "autoLift",
    name: "Mémoire musculaire",
    blurb: "Il soulève tout seul, même quand vous regardez ailleurs.",
    baseCost: 150,
    costGrowth: 1.28,
  },
  {
    id: "training",
    name: "Entraînement au cirque",
    blurb: "Pompes sur le dos de l'éléphant. Les trapézistes en pleurent.",
    baseCost: 350,
    costGrowth: 20,
  },
  {
    id: "magnesia",
    name: "Magnésie",
    blurb: "Les mains blanches, la foule en délire, la recette qui grimpe.",
    baseCost: 2_000,
    costGrowth: 10,
  },
];

export const MAX_LIVE_TICK_SECONDS = 5;
