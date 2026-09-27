export interface Species {
  name: string;
  emoji: string;
  color: string;
}

export const GRID_COLUMNS = 4;
export const GRID_SIZE = 12;

/** Slime lab comes second in the progression, so its economy is scaled ×10 over the first game. */
export const DOLLARS_PER_GOO = 10;

export const BASE_TAP_VALUE = DOLLARS_PER_GOO;

export const SLIME_BASE_COST = 10 * DOLLARS_PER_GOO;
export const SLIME_COST_GROWTH = 1.15;

export const BASE_PRODUCTION = 0.2 * DOLLARS_PER_GOO;
export const PRODUCTION_GROWTH = 3;

export const TAP_UPGRADE_BASE_COST = 25 * DOLLARS_PER_GOO;
export const TAP_UPGRADE_COST_GROWTH = 4;

export const INCUBATOR_BASE_COST = 500 * DOLLARS_PER_GOO;
export const INCUBATOR_COST_GROWTH = 10;

export const SPECIES: Species[] = [
  { name: "Gluant", emoji: "💧", color: "#8fd460" },
  { name: "Gélatineux", emoji: "🍮", color: "#f3bf5f" },
  { name: "Slime pailleté", emoji: "✨", color: "#f59ad0" },
  { name: "Slime ronchon", emoji: "😤", color: "#4ec9b0" },
  { name: "Slime flambé", emoji: "🔥", color: "#f26a5b" },
  { name: "Slime cosmique", emoji: "🌌", color: "#5aa9f0" },
  { name: "Slime existentiel", emoji: "🤔", color: "#a58bf0" },
  { name: "Roi des slimes", emoji: "👑", color: "#ffe14d" },
];

export const MAX_LEVEL = SPECIES.length;
