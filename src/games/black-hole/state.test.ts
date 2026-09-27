import { describe, expect, it } from "vitest";
import { NO_MODIFIERS } from "../types";
import { DOLLARS_PER_MASS, GENERATORS, TIERS } from "./config";
import { logic } from "./logic";
import {
  absorb,
  buyGenerator,
  createInitialState,
  currentTier,
  generatorCost,
  holeGrowth,
  incomePerSecond,
  massPerSecond,
  nextTier,
  restoreState,
  tapValue,
  tick,
  tierIndex,
  tierProgress,
  unlockedGenerators,
  type BlackHoleState,
} from "./state";

function stateWith(absorbedMass: number): BlackHoleState {
  return { ...createInitialState(), absorbedMass };
}

const boosted = { production: 2, tap: 3 };

const producing: BlackHoleState = {
  ...createInitialState(),
  generators: { accretionDisk: 2, cometShower: 1, planetCollision: 0, supernova: 0, galaxyMerger: 0 },
};

describe("tiers", () => {
  it("starts as dust", () => {
    expect(currentTier(createInitialState()).name).toBe("Poussière");
  });

  it("evolves exactly at each threshold", () => {
    TIERS.forEach((tier, index) => {
      expect(tierIndex(tier.threshold)).toBe(index);
      if (index > 0) expect(tierIndex(tier.threshold - 1)).toBe(index - 1);
    });
  });

  it("stays at the last tier forever", () => {
    expect(tierIndex(1e30)).toBe(TIERS.length - 1);
    expect(nextTier(stateWith(1e30))).toBeUndefined();
    expect(tierProgress(stateWith(1e30))).toBe(1);
  });

  it("reports progress towards the next tier", () => {
    expect(tierProgress(stateWith(50))).toBeCloseTo(0.5);
  });

  it("multiplies the tap value", () => {
    expect(tapValue(stateWith(0), NO_MODIFIERS)).toBe(1);
    expect(tapValue(stateWith(100), NO_MODIFIERS)).toBe(5);
  });
});

describe("absorb", () => {
  it("grows absorbed mass and earns money for each unit of mass", () => {
    const { state, earned } = absorb(stateWith(150), NO_MODIFIERS);

    expect(state.absorbedMass).toBe(155);
    expect(earned).toBe(5 * DOLLARS_PER_MASS);
  });

  it("earns the first generator within 15 taps", () => {
    let state = createInitialState();
    let wallet = 0;
    for (let tap = 0; tap < 15; tap++) {
      const earning = absorb(state, NO_MODIFIERS);
      state = earning.state;
      wallet += earning.earned;
    }

    expect(wallet).toBeGreaterThanOrEqual(generatorCost(state, "accretionDisk"));
  });

  it("multiplies the gain by the tap modifier", () => {
    const { state, earned } = absorb(stateWith(100), boosted);

    expect(tapValue(stateWith(100), boosted)).toBe(15);
    expect(state.absorbedMass).toBe(115);
    expect(earned).toBe(15 * DOLLARS_PER_MASS);
  });

  it("can make the hole evolve", () => {
    expect(currentTier(absorb(stateWith(99), NO_MODIFIERS).state).name).toBe("Astéroïdes");
  });
});

describe("generators", () => {
  it("unlocks one generator per tier", () => {
    expect(unlockedGenerators(stateWith(0)).map((g) => g.id)).toEqual(["accretionDisk"]);
    expect(unlockedGenerators(stateWith(100)).map((g) => g.id)).toEqual(["accretionDisk", "cometShower"]);
  });

  it("prices the first unit at the base cost in dollars", () => {
    for (const generator of GENERATORS) {
      expect(generatorCost(createInitialState(), generator.id)).toBe(generator.baseCost);
    }
  });

  it("adds one generator and grows the cost by 15%", () => {
    const state = buyGenerator(createInitialState(), "accretionDisk");

    expect(state.generators.accretionDisk).toBe(1);
    expect(generatorCost(state, "accretionDisk")).toBe(Math.ceil(15 * 1.15));
  });

  it("keeps absorbed mass when buying, so spending never devolves the hole", () => {
    expect(buyGenerator(stateWith(100), "cometShower").absorbedMass).toBe(100);
  });

  it("does nothing when the generator is still locked", () => {
    const state = stateWith(99);

    expect(buyGenerator(state, "cometShower")).toBe(state);
  });
});

describe("tick", () => {
  it("absorbs production over elapsed seconds and earns it", () => {
    const { state, earned } = tick(producing, 2.5, NO_MODIFIERS);

    expect(massPerSecond(producing, NO_MODIFIERS)).toBe(4);
    expect(state.absorbedMass).toBeCloseTo(10);
    expect(earned).toBeCloseTo(10 * DOLLARS_PER_MASS);
  });

  it("multiplies production by the production modifier", () => {
    expect(tick(producing, 2.5, boosted).earned).toBeCloseTo(20 * DOLLARS_PER_MASS);
  });

  it("earns nothing without generators", () => {
    const initial = createInitialState();

    expect(tick(initial, 60, NO_MODIFIERS)).toEqual({ state: initial, earned: 0 });
  });

  it("can make the hole evolve", () => {
    expect(currentTier(tick(producing, 25, NO_MODIFIERS).state).name).toBe("Astéroïdes");
  });
});

describe("incomePerSecond", () => {
  it("converts production into dollars and applies the production modifier", () => {
    expect(incomePerSecond(producing, NO_MODIFIERS)).toBe(4 * DOLLARS_PER_MASS);
    expect(incomePerSecond(producing, boosted)).toBe(8 * DOLLARS_PER_MASS);
    expect(incomePerSecond(createInitialState(), boosted)).toBe(0);
  });
});

describe("restoreState", () => {
  it("converts a legacy mass balance into money once and drops legacy fields", () => {
    const { state, earned } = restoreState({
      mass: 5_000,
      absorbedMass: 9_000,
      capacityLevel: 5,
      generators: { accretionDisk: 3 } as BlackHoleState["generators"],
    });

    expect(earned).toBe(5_000 * DOLLARS_PER_MASS);
    expect(state).toEqual({
      absorbedMass: 9_000,
      generators: { ...createInitialState().generators, accretionDisk: 3 },
    });
  });

  it("fills in missing fields", () => {
    expect(restoreState({})).toEqual({ state: createInitialState(), earned: 0 });
  });

  it("earns nothing when restoring a current save", () => {
    const { state, earned } = restoreState(tick(producing, 30, NO_MODIFIERS).state);

    expect(earned).toBe(0);
    expect(restoreState(state).state).toEqual(state);
  });
});

describe("logic", () => {
  it("exposes absorbed mass as the only metric", () => {
    expect(logic.metrics(stateWith(150))).toEqual({ absorbedMass: 150 });
  });

  it("ticks with the modifiers from the context", () => {
    expect(logic.tick(producing, 10, { modifiers: boosted, isFocused: false }).earned).toBeCloseTo(80);
  });

  it("reports income with modifiers", () => {
    expect(logic.incomePerSecond(producing, boosted)).toBe(8 * DOLLARS_PER_MASS);
  });
});

describe("holeGrowth", () => {
  it("grows with the logarithm of absorbed mass and caps at 1", () => {
    expect(holeGrowth(0)).toBe(0);
    expect(holeGrowth(1_000)).toBeGreaterThan(holeGrowth(100));
    expect(holeGrowth(1e30)).toBe(1);
  });
});
