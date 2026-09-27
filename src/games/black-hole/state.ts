import type { Earning, Modifiers } from "../types";
import {
  BASE_TAP_VALUE,
  COST_GROWTH,
  DOLLARS_PER_MASS,
  GENERATORS,
  HOLE_MAX_SIZE_MASS_LOG10,
  TIERS,
  type GeneratorDefinition,
  type GeneratorId,
  type Tier,
} from "./config";

export interface BlackHoleState {
  absorbedMass: number;
  generators: Record<GeneratorId, number>;
}

/** Saves written before the shared wallet kept a spendable `mass` balance and a capacity. */
export type SavedBlackHoleState = Partial<BlackHoleState> & { mass?: number; capacityLevel?: number };

export function createInitialState(): BlackHoleState {
  return {
    absorbedMass: 0,
    generators: { accretionDisk: 0, cometShower: 0, planetCollision: 0, supernova: 0, galaxyMerger: 0 },
  };
}

export function tierIndex(absorbedMass: number): number {
  return TIERS.filter((tier) => absorbedMass >= tier.threshold).length - 1;
}

export function currentTier(state: BlackHoleState): Tier {
  return TIERS[tierIndex(state.absorbedMass)];
}

export function nextTier(state: BlackHoleState): Tier | undefined {
  return TIERS[tierIndex(state.absorbedMass) + 1];
}

export function tierProgress(state: BlackHoleState): number {
  const next = nextTier(state);
  if (!next) return 1;

  const start = currentTier(state).threshold;
  return (state.absorbedMass - start) / (next.threshold - start);
}

export function tapValue(state: BlackHoleState, modifiers: Modifiers): number {
  return BASE_TAP_VALUE * currentTier(state).tapMultiplier * modifiers.tap;
}

export function unlockedGenerators(state: BlackHoleState): GeneratorDefinition[] {
  const reachedTier = tierIndex(state.absorbedMass);
  return GENERATORS.filter((generator) => generator.unlockTier <= reachedTier);
}

export function generatorCost(state: BlackHoleState, id: GeneratorId): number {
  const generator = GENERATORS.find((g) => g.id === id)!;
  return Math.ceil(generator.baseCost * COST_GROWTH ** state.generators[id]);
}

export function massPerSecond(state: BlackHoleState, modifiers: Modifiers): number {
  const base = GENERATORS.reduce((total, g) => total + g.massPerSecond * state.generators[g.id], 0);
  return base * modifiers.production;
}

export function incomePerSecond(state: BlackHoleState, modifiers: Modifiers): number {
  return massPerSecond(state, modifiers) * DOLLARS_PER_MASS;
}

export function holeGrowth(absorbedMass: number): number {
  return Math.min(1, Math.log10(1 + absorbedMass) / HOLE_MAX_SIZE_MASS_LOG10);
}

function absorbMass(state: BlackHoleState, amount: number): Earning<BlackHoleState> {
  return {
    state: { ...state, absorbedMass: state.absorbedMass + amount },
    earned: amount * DOLLARS_PER_MASS,
  };
}

export function absorb(state: BlackHoleState, modifiers: Modifiers): Earning<BlackHoleState> {
  return absorbMass(state, tapValue(state, modifiers));
}

export function buyGenerator(state: BlackHoleState, id: GeneratorId): BlackHoleState {
  const isUnlocked = unlockedGenerators(state).some((g) => g.id === id);
  if (!isUnlocked) return state;

  return { ...state, generators: { ...state.generators, [id]: state.generators[id] + 1 } };
}

export function tick(state: BlackHoleState, seconds: number, modifiers: Modifiers): Earning<BlackHoleState> {
  return absorbMass(state, massPerSecond(state, modifiers) * seconds);
}

export function restoreState(saved: SavedBlackHoleState): Earning<BlackHoleState> {
  const initial = createInitialState();
  return {
    state: {
      absorbedMass: saved.absorbedMass ?? initial.absorbedMass,
      generators: { ...initial.generators, ...saved.generators },
    },
    earned: (saved.mass ?? 0) * DOLLARS_PER_MASS,
  };
}
