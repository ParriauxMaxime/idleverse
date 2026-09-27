import type { Earning, Modifiers } from "../types";
import {
  BASE_PRODUCTION,
  BASE_TAP_VALUE,
  DOLLARS_PER_GOO,
  GRID_SIZE,
  INCUBATOR_BASE_COST,
  INCUBATOR_COST_GROWTH,
  MAX_LEVEL,
  PRODUCTION_GROWTH,
  SLIME_BASE_COST,
  SLIME_COST_GROWTH,
  TAP_UPGRADE_BASE_COST,
  TAP_UPGRADE_COST_GROWTH,
} from "./config";

export type Slot = number | null;

export interface SlimeLabState {
  tapLevel: number;
  slots: Slot[];
  slimesBought: number;
  spawnLevel: number;
  highestLevel: number;
}

/** Saves from before the shared wallet kept their own goo balance and capacity. */
export type LegacySlimeLabSave = Partial<SlimeLabState> & { goo?: number; capacityLevel?: number };

export function createInitialState(): SlimeLabState {
  return {
    tapLevel: 0,
    slots: Array<Slot>(GRID_SIZE).fill(null),
    slimesBought: 0,
    spawnLevel: 1,
    highestLevel: 0,
  };
}

export function restoreState(saved: LegacySlimeLabSave): Earning<SlimeLabState> {
  const { goo = 0, capacityLevel: _capacityLevel, ...current } = saved;
  return { state: { ...createInitialState(), ...current }, earned: goo * DOLLARS_PER_GOO };
}

export function tapValue(state: SlimeLabState, modifiers: Modifiers): number {
  return BASE_TAP_VALUE * 2 ** state.tapLevel * modifiers.tap;
}

export function tap(state: SlimeLabState, modifiers: Modifiers): Earning<SlimeLabState> {
  return { state, earned: tapValue(state, modifiers) };
}

export function slimeProduction(level: number): number {
  return BASE_PRODUCTION * PRODUCTION_GROWTH ** (level - 1);
}

export function productionPerSecond(state: SlimeLabState, modifiers: Modifiers): number {
  const base = state.slots.reduce<number>((total, level) => total + (level === null ? 0 : slimeProduction(level)), 0);
  return base * modifiers.production;
}

export function tick(state: SlimeLabState, seconds: number, modifiers: Modifiers): Earning<SlimeLabState> {
  return { state, earned: productionPerSecond(state, modifiers) * seconds };
}

export function slimeCount(state: SlimeLabState): number {
  return state.slots.filter((level) => level !== null).length;
}

export function isDiscovered(state: SlimeLabState, level: number): boolean {
  return level <= state.highestLevel;
}

export function slimeCost(state: SlimeLabState): number {
  return Math.ceil(SLIME_BASE_COST * SLIME_COST_GROWTH ** state.slimesBought);
}

export function firstEmptySlot(state: SlimeLabState): number {
  return state.slots.indexOf(null);
}

export function isGridFull(state: SlimeLabState): boolean {
  return firstEmptySlot(state) === -1;
}

export function buySlime(state: SlimeLabState): SlimeLabState {
  const slot = firstEmptySlot(state);
  if (slot === -1) return state;

  return {
    ...state,
    slots: state.slots.map((level, index) => (index === slot ? state.spawnLevel : level)),
    slimesBought: state.slimesBought + 1,
    highestLevel: Math.max(state.highestLevel, state.spawnLevel),
  };
}

export function canMerge(state: SlimeLabState, from: number, to: number): boolean {
  const level = state.slots[from];
  return from !== to && level != null && level === state.slots[to] && level < MAX_LEVEL;
}

export function mergeSlimes(state: SlimeLabState, from: number, to: number): SlimeLabState {
  if (!canMerge(state, from, to)) return state;

  const mergedLevel = state.slots[to]! + 1;
  return {
    ...state,
    slots: state.slots.map((level, index) => {
      if (index === from) return null;
      if (index === to) return mergedLevel;
      return level;
    }),
    highestLevel: Math.max(state.highestLevel, mergedLevel),
  };
}

export function tapUpgradeCost(state: SlimeLabState): number {
  return TAP_UPGRADE_BASE_COST * TAP_UPGRADE_COST_GROWTH ** state.tapLevel;
}

export function buyTapUpgrade(state: SlimeLabState): SlimeLabState {
  return { ...state, tapLevel: state.tapLevel + 1 };
}

export function incubatorCost(state: SlimeLabState): number {
  return INCUBATOR_BASE_COST * INCUBATOR_COST_GROWTH ** (state.spawnLevel - 1);
}

export function isIncubatorUnlocked(state: SlimeLabState): boolean {
  return state.spawnLevel + 1 < state.highestLevel;
}

export function buyIncubator(state: SlimeLabState): SlimeLabState {
  if (!isIncubatorUnlocked(state)) return state;

  return { ...state, spawnLevel: state.spawnLevel + 1 };
}
