export type UpgradeId = "whatsapp" | "anonymous" | "meme" | "influencer" | "youtube";

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  baseCost: number;
  tapPower: number;
  spreadRate: number;
}

export interface Scope {
  name: string;
  population: number;
  rumor: string;
}

export const COST_GROWTH = 1.15;

export const DOLLARS_PER_BELIEVER_PER_SECOND = 1;
export const DOLLARS_PER_WHISPERED_BELIEVER = 20;

export const BASE_TAP_POWER = 1;
export const BASE_SPREAD_RATE = 0.02;

export const LEVEL_UP_THRESHOLD = 0.9;

export const MAX_LIVE_TICK_SECONDS = 5;

export const UPGRADES: UpgradeDefinition[] = [
  { id: "whatsapp", name: "Groupe WhatsApp", baseCost: 1_000, tapPower: 1, spreadRate: 0 },
  { id: "anonymous", name: "Compte anonyme", baseCost: 1_500, tapPower: 0, spreadRate: 0.004 },
  { id: "meme", name: "Mème viral", baseCost: 30_000, tapPower: 5, spreadRate: 0.004 },
  { id: "influencer", name: "Influenceur complotiste", baseCost: 500_000, tapPower: 0, spreadRate: 0.01 },
  { id: "youtube", name: "Chaîne YouTube", baseCost: 30_000_000, tapPower: 1_000, spreadRate: 0.02 },
];

export const SCOPES: Scope[] = [
  { name: "Classe", population: 30, rumor: "Le prof de maths est un vampire." },
  { name: "Immeuble", population: 250, rumor: "Le concierge aussi : il dort dans le local à poubelles." },
  { name: "Quartier", population: 5_000, rumor: "Le boulanger a banni l'ail. Tout le quartier est vampire." },
  { name: "Ville", population: 300_000, rumor: "La mairie est un cercueil géant et le maire en est le comte." },
  { name: "Pays", population: 67_000_000, rumor: "Le gouvernement va remplacer l'heure d'été par la nuit éternelle." },
  { name: "Monde", population: 8_000_000_000, rumor: "La Lune est un dentier de vampire géant. Ouvrez les yeux." },
];

export const DEBUNK = {
  firstDelaySeconds: 30,
  minDelaySeconds: 25,
  maxDelaySeconds: 50,
  durationSeconds: 5,
  penalty: 0.25,
  minBelievers: 5,
};

export const DEBUNK_MESSAGES = [
  "Un fact-checker publie : « Les vampires n'existent pas. »",
  "Le prof de maths poste une photo en plein soleil.",
  "Ta mère : « Arrête de raconter n'importe quoi. »",
  "Un article Wikipédia contredit la rumeur.",
  "Un scientifique à lunettes explique calmement les faits.",
];
