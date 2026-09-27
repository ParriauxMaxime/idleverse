export interface Tier {
  id: string;
  name: string;
  /** Completes « une tirelire … » */
  one: string;
  /** Completes « des tirelires … » */
  many: string;
  hp: number;
  payout: number;
  flavor: string;
}

export interface Rank {
  name: string;
  contracts: number;
}

export interface Tool {
  name: string;
  withArticle: string;
  damage: number;
  cost: number;
}

export type GoonId = "punk" | "muscle" | "safecracker" | "movers" | "cousins";

export interface Goon {
  id: GoonId;
  name: string;
  damagePerSecond: number;
  baseCost: number;
  unlockTier: number;
  motto: string;
}

export type ContractGoal =
  | { kind: "break"; tier: number; count: number }
  | { kind: "loot"; amount: number }
  | { kind: "quick"; tier: number; maxHits: number }
  | { kind: "hire"; count: number }
  | { kind: "tool"; level: number };

export interface Contract {
  goal: ContractGoal;
  reward: number;
  unlocksTier?: number;
  brief: string;
}

export const BOARD_SIZE = 3;
export const COST_GROWTH = 1.15;
export const REPUTATION_BONUS_PER_CONTRACT = 0.05;

export const TIERS: Tier[] = [
  {
    id: "ceramic",
    name: "Céramique",
    one: "en céramique",
    many: "en céramique",
    hp: 5,
    payout: 5_000,
    flavor: "Fragile, naïve, pleine de pièces jaunes. Elle n'a rien vu venir.",
  },
  {
    id: "metal",
    name: "Métal",
    one: "en métal",
    many: "en métal",
    hp: 60,
    payout: 90_000,
    flavor: "Récupérée chez un ferrailleur qui ne pose jamais de questions.",
  },
  {
    id: "armored",
    name: "Blindée",
    one: "blindée",
    many: "blindées",
    hp: 1_000,
    payout: 2_500_000,
    flavor: "Propriété de la Banque Nationale. Enfin, jusqu'à ce soir.",
  },
  {
    id: "gold",
    name: "Or",
    one: "en or",
    many: "en or",
    hp: 20_000,
    payout: 100_000_000,
    flavor: "Vingt-quatre carats de mauvaise foi. Elle se croit intouchable.",
  },
  {
    id: "godfather",
    name: "Parrain",
    one: "du Parrain",
    many: "du Parrain",
    hp: 400_000,
    payout: 4_000_000_000,
    flavor: "Ne la regarde pas dans les yeux. Elle, elle te regarde.",
  },
];

export const RANKS: Rank[] = [
  { name: "Gamin des rues", contracts: 0 },
  { name: "Picciotto", contracts: 2 },
  { name: "Soldat", contracts: 5 },
  { name: "Capo", contracts: 9 },
  { name: "Consigliere", contracts: 14 },
  { name: "Bras droit", contracts: 20 },
  { name: "Don", contracts: 30 },
];

export const TOOLS: Tool[] = [
  { name: "Marteau", withArticle: "un marteau", damage: 1, cost: 0 },
  { name: "Pied-de-biche", withArticle: "un pied-de-biche", damage: 4, cost: 100_000 },
  { name: "Masse", withArticle: "une masse", damage: 20, cost: 5_000_000 },
  { name: "Marteau-piqueur", withArticle: "un marteau-piqueur", damage: 100, cost: 60_000_000 },
  { name: "Chalumeau", withArticle: "un chalumeau", damage: 600, cost: 4_000_000_000 },
  { name: "Dynamite", withArticle: "de la dynamite", damage: 4_000, cost: 150_000_000_000 },
];

export const GOONS: Goon[] = [
  { id: "punk", name: "Petite frappe", damagePerSecond: 0.5, baseCost: 15_000, unlockTier: 0, motto: "Une batte, un cure-dent, aucun avenir." },
  { id: "muscle", name: "Gros bras", damagePerSecond: 4, baseCost: 300_000, unlockTier: 0, motto: "Parle peu. Frappe beaucoup." },
  {
    id: "safecracker",
    name: "Perceur de coffres",
    damagePerSecond: 30,
    baseCost: 12_000_000,
    unlockTier: 2,
    motto: "Doigts de pianiste, patience de moine.",
  },
  {
    id: "movers",
    name: "Les Déménageurs",
    damagePerSecond: 250,
    baseCost: 600_000_000,
    unlockTier: 3,
    motto: "Ils emportent la tirelire. Et le buffet.",
  },
  {
    id: "cousins",
    name: "Les cousins de Palerme",
    damagePerSecond: 2_500,
    baseCost: 40_000_000_000,
    unlockTier: 4,
    motto: "Débarqués cette nuit. Personne n'a vu leurs papiers.",
  },
];

export const STORY_CONTRACTS: Contract[] = [
  {
    goal: { kind: "break", tier: 0, count: 20 },
    reward: 20_000,
    brief: "Commence petit. Vingt cochons, et pas un bruit.",
  },
  {
    goal: { kind: "hire", count: 1 },
    reward: 20_000,
    brief: "Un homme seul est un homme mort. Trouve-toi quelqu'un.",
  },
  {
    goal: { kind: "loot", amount: 250_000 },
    reward: 50_000,
    unlocksTier: 1,
    brief: "La Famille a des frais. Fais-moi rentrer de l'argent.",
  },
  {
    goal: { kind: "tool", level: 1 },
    reward: 40_000,
    brief: "Tu tapes comme mon neveu. Va t'équiper.",
  },
  {
    goal: { kind: "break", tier: 1, count: 10 },
    reward: 200_000,
    brief: "Le métal, ça résiste. Toi aussi, j'espère.",
  },
  {
    goal: { kind: "quick", tier: 1, maxHits: 15 },
    reward: 250_000,
    brief: "Vite et proprement. Les voisins dorment.",
  },
  {
    goal: { kind: "loot", amount: 15_000_000 },
    reward: 2_000_000,
    unlocksTier: 2,
    brief: "Un ami d'un ami a entendu parler de tirelires blindées…",
  },
  {
    goal: { kind: "hire", count: 10 },
    reward: 1_000_000,
    brief: "Une famille, ça s'agrandit. Recrute.",
  },
  {
    goal: { kind: "break", tier: 2, count: 5 },
    reward: 5_000_000,
    brief: "Blindées, qu'ils disent. On va voir.",
  },
  {
    goal: { kind: "tool", level: 3 },
    reward: 30_000_000,
    brief: "Le marteau-piqueur. Fais du bruit, je paie le dentiste.",
  },
  {
    goal: { kind: "quick", tier: 2, maxHits: 10 },
    reward: 40_000_000,
    brief: "Une blindée en moins de dix coups. Montre-moi du talent.",
  },
  {
    goal: { kind: "loot", amount: 1_000_000_000 },
    reward: 200_000_000,
    unlocksTier: 3,
    brief: "Il existe des cochons en or. Je veux les voir pleurer.",
  },
  {
    goal: { kind: "break", tier: 3, count: 10 },
    reward: 500_000_000,
    brief: "L'or, ça ne se casse pas. Ça se négocie. À coups de masse.",
  },
  {
    goal: { kind: "hire", count: 40 },
    reward: 1_000_000_000,
    brief: "Quarante gars loyaux. Ou au moins bien payés.",
  },
  {
    goal: { kind: "tool", level: 4 },
    reward: 3_000_000_000,
    brief: "Un chalumeau. Pour les grandes occasions.",
  },
  {
    goal: { kind: "quick", tier: 3, maxHits: 40 },
    reward: 5_000_000_000,
    brief: "Une tirelire en or, quarante coups maximum. Le temps, c'est de l'argent.",
  },
  {
    goal: { kind: "loot", amount: 20_000_000_000 },
    reward: 4_000_000_000,
    unlocksTier: 4,
    brief: "Il est temps que tu saches. Moi aussi, j'ai une tirelire.",
  },
  {
    goal: { kind: "break", tier: 4, count: 3 },
    reward: 30_000_000_000,
    brief: "Casse-la. Il ne doit jamais savoir que c'était moi… ni toi.",
  },
  {
    goal: { kind: "tool", level: 5 },
    reward: 50_000_000_000,
    brief: "La dynamite. On ne fait plus dans la dentelle.",
  },
  {
    goal: { kind: "loot", amount: 2_000_000_000_000 },
    reward: 400_000_000_000,
    brief: "Mille milliards. Après ça, on part en Sicile.",
  },
];

export const ROUTINE_GROWTH = 1.5;

export const ROUTINE_BRIEFS = [
  "Le boulot, c'est le boulot. Au travail.",
  "La Famille ne dort jamais. Toi non plus.",
  "Un petit service entre amis.",
  "Ne pose pas de questions. Casse.",
  "C'est une offre que tu ne peux pas refuser.",
];
