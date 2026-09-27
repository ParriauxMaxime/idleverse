export type GeneratorId = "accretionDisk" | "cometShower" | "planetCollision" | "supernova" | "galaxyMerger";

export interface Tier {
  name: string;
  emoji: string;
  flavor: string;
  threshold: number;
  tapMultiplier: number;
}

export interface GeneratorDefinition {
  id: GeneratorId;
  name: string;
  baseCost: number;
  massPerSecond: number;
  unlockTier: number;
}

export const BASE_TAP_VALUE = 1;

export const DOLLARS_PER_MASS = 1;

export const COST_GROWTH = 1.15;

export const HOLE_MAX_SIZE_MASS_LOG10 = 9;

export const TIERS: Tier[] = [
  { name: "Poussière", emoji: "✨", flavor: "Vous aspirez de la poussière cosmique.", threshold: 0, tapMultiplier: 1 },
  { name: "Astéroïdes", emoji: "🪨", flavor: "Les astéroïdes dérivent vers vous.", threshold: 100, tapMultiplier: 5 },
  { name: "Planètes", emoji: "🪐", flavor: "Des planètes entières sont happées.", threshold: 2_500, tapMultiplier: 25 },
  { name: "Étoiles", emoji: "⭐", flavor: "Les étoiles s'effilochent dans votre disque.", threshold: 75_000, tapMultiplier: 150 },
  { name: "Galaxies", emoji: "🌌", flavor: "Des galaxies spiralent vers l'horizon.", threshold: 3_000_000, tapMultiplier: 1_000 },
];

export const GENERATORS: GeneratorDefinition[] = [
  { id: "accretionDisk", name: "Disque d'accrétion", baseCost: 15, massPerSecond: 0.5, unlockTier: 0 },
  { id: "cometShower", name: "Pluie de comètes", baseCost: 100, massPerSecond: 3, unlockTier: 1 },
  { id: "planetCollision", name: "Collision de planètes", baseCost: 1_500, massPerSecond: 25, unlockTier: 2 },
  { id: "supernova", name: "Supernova", baseCost: 40_000, massPerSecond: 300, unlockTier: 3 },
  { id: "galaxyMerger", name: "Fusion de galaxies", baseCost: 1_500_000, massPerSecond: 5_000, unlockTier: 4 },
];

