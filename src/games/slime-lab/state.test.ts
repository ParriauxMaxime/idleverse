import { describe, expect, it } from "vitest";
import { NO_MODIFIERS } from "../types";
import { DOLLARS_PER_GOO, GRID_SIZE, MAX_LEVEL } from "./config";
import { logic } from "./logic";
import {
  buyIncubator,
  buySlime,
  buyTapUpgrade,
  canMerge,
  createInitialState,
  incubatorCost,
  isDiscovered,
  isGridFull,
  isIncubatorUnlocked,
  mergeSlimes,
  productionPerSecond,
  restoreState,
  slimeCost,
  slimeCount,
  tap,
  tapUpgradeCost,
  tick,
  type LegacySlimeLabSave,
  type SlimeLabState,
  type Slot,
} from "./state";

function stateWith(overrides: Partial<SlimeLabState>): SlimeLabState {
  return { ...createInitialState(), ...overrides };
}

function grid(...levels: Slot[]): Slot[] {
  return [...levels, ...Array<Slot>(GRID_SIZE - levels.length).fill(null)];
}

describe("tap", () => {
  it("earns 10 $ at first without changing the state", () => {
    const state = createInitialState();
    const { state: after, earned } = tap(state, NO_MODIFIERS);

    expect(earned).toBe(10);
    expect(after).toBe(state);
  });

  it("doubles after each tap upgrade", () => {
    const upgraded = buyTapUpgrade(createInitialState());

    expect(upgraded.tapLevel).toBe(1);
    expect(tap(upgraded, NO_MODIFIERS).earned).toBe(20);
  });

  it("costs 250 $ for the first upgrade, then four times more", () => {
    expect(tapUpgradeCost(createInitialState())).toBe(250);
    expect(tapUpgradeCost(stateWith({ tapLevel: 1 }))).toBe(1000);
  });
});

describe("buySlime", () => {
  it("makes the first slime affordable within 10 taps", () => {
    let wallet = 0;
    for (let i = 0; i < 10; i++) wallet += tap(createInitialState(), NO_MODIFIERS).earned;

    expect(wallet).toBeGreaterThanOrEqual(slimeCost(createInitialState()));
  });

  it("places a level-1 slime in the first empty slot and raises the price by 15%", () => {
    const state = buySlime(stateWith({ slots: grid(2) }));

    expect(state.slots.slice(0, 2)).toEqual([2, 1]);
    expect(slimeCost(createInitialState())).toBe(100);
    expect(slimeCost(state)).toBe(Math.ceil(100 * 1.15));
  });

  it("does nothing when the grid is full", () => {
    const state = stateWith({ slots: Array<Slot>(GRID_SIZE).fill(1) });

    expect(isGridFull(state)).toBe(true);
    expect(buySlime(state)).toBe(state);
  });

  it("spawns at the incubator level", () => {
    const state = buySlime(stateWith({ spawnLevel: 3, highestLevel: 4 }));

    expect(state.slots[0]).toBe(3);
  });
});

describe("mergeSlimes", () => {
  it("merges two slimes of the same level into the target slot", () => {
    const state = mergeSlimes(stateWith({ slots: grid(1, null, 1) }), 0, 2);

    expect(state.slots.slice(0, 3)).toEqual([null, null, 2]);
  });

  it("rejects slimes of different levels", () => {
    const state = stateWith({ slots: grid(1, 2) });

    expect(canMerge(state, 0, 1)).toBe(false);
    expect(mergeSlimes(state, 0, 1)).toBe(state);
  });

  it("rejects merging a slime with itself or an empty slot", () => {
    const state = stateWith({ slots: grid(1, null) });

    expect(mergeSlimes(state, 0, 0)).toBe(state);
    expect(mergeSlimes(state, 0, 1)).toBe(state);
    expect(mergeSlimes(state, 1, 0)).toBe(state);
  });

  it("rejects merging two slimes of the last species", () => {
    const state = stateWith({ slots: grid(MAX_LEVEL, MAX_LEVEL) });

    expect(mergeSlimes(state, 0, 1)).toBe(state);
  });
});

describe("discovery", () => {
  it("starts with no species discovered", () => {
    expect(isDiscovered(createInitialState(), 1)).toBe(false);
  });

  it("discovers the first species when buying a slime", () => {
    expect(isDiscovered(buySlime(createInitialState()), 1)).toBe(true);
  });

  it("discovers a new species when merging", () => {
    const state = mergeSlimes(stateWith({ slots: grid(1, 1), highestLevel: 1 }), 0, 1);

    expect(isDiscovered(state, 2)).toBe(true);
    expect(isDiscovered(state, 3)).toBe(false);
  });
});

describe("incubator", () => {
  it("is locked until a species two levels above the spawn level is discovered", () => {
    expect(isIncubatorUnlocked(stateWith({ highestLevel: 2 }))).toBe(false);
    expect(isIncubatorUnlocked(stateWith({ highestLevel: 3 }))).toBe(true);
  });

  it("costs 5000 $, then ten times more per level", () => {
    expect(incubatorCost(createInitialState())).toBe(5000);
    expect(incubatorCost(stateWith({ spawnLevel: 2 }))).toBe(50_000);
  });

  it("raises the spawn level when unlocked", () => {
    expect(buyIncubator(stateWith({ highestLevel: 3 })).spawnLevel).toBe(2);
  });

  it("does nothing when locked", () => {
    const state = stateWith({ highestLevel: 2 });

    expect(buyIncubator(state)).toBe(state);
  });
});

describe("production", () => {
  it("triples with each level", () => {
    expect(productionPerSecond(stateWith({ slots: grid(1) }), NO_MODIFIERS)).toBeCloseTo(2);
    expect(productionPerSecond(stateWith({ slots: grid(3) }), NO_MODIFIERS)).toBeCloseTo(18);
  });

  it("sums every slime on the grid", () => {
    expect(productionPerSecond(stateWith({ slots: grid(1, null, 2) }), NO_MODIFIERS)).toBeCloseTo(8);
    expect(slimeCount(stateWith({ slots: grid(1, null, 2) }))).toBe(2);
  });

  it("makes merging worth more than the two slimes it consumes", () => {
    const before = stateWith({ slots: grid(2, 2) });

    expect(productionPerSecond(mergeSlimes(before, 0, 1), NO_MODIFIERS)).toBeGreaterThan(productionPerSecond(before, NO_MODIFIERS));
  });
});

describe("tick", () => {
  it("earns production over elapsed seconds without any cap", () => {
    const state = stateWith({ slots: grid(1, 2) });
    const { state: after, earned } = tick(state, 3600, NO_MODIFIERS);

    expect(earned).toBeCloseTo(8 * 3600);
    expect(after).toBe(state);
  });
});

describe("modifiers", () => {
  it("multiplies production", () => {
    const state = stateWith({ slots: grid(1, 2) });
    const modifiers = { production: 3, tap: 1 };

    expect(productionPerSecond(state, modifiers)).toBeCloseTo(24);
    expect(tick(state, 10, modifiers).earned).toBeCloseTo(240);
  });

  it("multiplies the tap gain", () => {
    expect(tap(stateWith({ tapLevel: 1 }), { production: 1, tap: 5 }).earned).toBe(100);
  });
});

describe("restoreState", () => {
  it("converts a legacy goo balance into money once and drops capacity", () => {
    const legacySave: LegacySlimeLabSave = { goo: 5000, capacityLevel: 6, slots: grid(2), highestLevel: 2, tapLevel: 1 };
    const { state, earned } = restoreState(legacySave);

    expect(earned).toBe(5000 * DOLLARS_PER_GOO);
    expect(state).toEqual(stateWith({ slots: grid(2), highestLevel: 2, tapLevel: 1 }));
    expect(state).not.toHaveProperty("goo");
    expect(state).not.toHaveProperty("capacityLevel");
  });

  it("fills missing fields", () => {
    expect(restoreState({ highestLevel: 3 }).state).toEqual(stateWith({ highestLevel: 3 }));
  });

  it("earns nothing from a current save", () => {
    const saved = stateWith({ slots: grid(1, 3), highestLevel: 3, spawnLevel: 2 });

    expect(restoreState(saved)).toEqual({ state: saved, earned: 0 });
  });
});

describe("logic", () => {
  it("counts discovered species in metrics", () => {
    expect(logic.metrics(createInitialState())).toEqual({ speciesDiscovered: 0 });
    expect(logic.metrics(stateWith({ highestLevel: 5 }))).toEqual({ speciesDiscovered: 5 });
  });

  it("ticks with the modifiers from the context", () => {
    const state = stateWith({ slots: grid(1) });

    expect(logic.tick(state, 10, { modifiers: { production: 2, tap: 1 }, isFocused: false }).earned).toBeCloseTo(40);
  });

  it("reports production with modifiers as income", () => {
    const state = stateWith({ slots: grid(1, 2) });

    expect(logic.incomePerSecond(state, NO_MODIFIERS)).toBeCloseTo(8);
    expect(logic.incomePerSecond(state, { production: 2.5, tap: 1 })).toBeCloseTo(20);
  });
});
