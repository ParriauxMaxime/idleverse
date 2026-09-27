import { describe, expect, it } from "vitest";
import { NO_MODIFIERS, type Earning } from "../types";
import {
  AUTO_PUSHES_PER_LEVEL,
  BASE_TAP_KILOGRAMS,
  COACH_SINK_MULTIPLIER,
  MAGNESIA_PAYOUT_MULTIPLIER,
  MAX_LIVE_TICK_SECONDS,
  SINK_GRACE_SECONDS,
  SINK_PER_SECOND,
  UPGRADES,
  WEIGHTS,
} from "./config";
import { logic } from "./logic";
import {
  autoKilogramsPerSecond,
  buyUpgrade,
  buyWeight,
  canBuyUpgrade,
  createInitialState,
  currentWeight,
  incomePerSecond,
  isAutomated,
  liftPayout,
  nextWeight,
  restoreState,
  sinkPerSecond,
  tap,
  tapKilograms,
  tapsPerLift,
  tick,
  upgradeCost,
  type StrongmanState,
} from "./state";

const live = { modifiers: NO_MODIFIERS, isFocused: true };
const away = { modifiers: NO_MODIFIERS, isFocused: false };
const boosted = { production: 2, tap: 3 };

function withUpgrades(upgrades: Partial<StrongmanState["upgrades"]>, state = createInitialState()): StrongmanState {
  return { ...state, upgrades: { ...state.upgrades, ...upgrades } };
}

function tapTimes(state: StrongmanState, taps: number, modifiers = NO_MODIFIERS): Earning<StrongmanState> {
  let earned = 0;
  for (let count = 0; count < taps; count++) {
    const earning = tap(state, modifiers);
    state = earning.state;
    earned += earning.earned;
  }
  return { state, earned };
}

describe("tapping", () => {
  it("starts at rest with the bare bar", () => {
    const state = createInitialState();

    expect(state.lift).toBe(0);
    expect(currentWeight(state).name).toBe("Barre à vide");
    expect(state.liftsCompleted).toBe(0);
  });

  it("raises the bar by the tap strength over the weight", () => {
    const { state, earned } = tap(createInitialState(), NO_MODIFIERS);

    expect(state.lift).toBeCloseTo(BASE_TAP_KILOGRAMS / WEIGHTS[0].kilograms);
    expect(earned).toBe(0);
  });

  it("takes between 8 and 10 quick taps to earn the first dollar", () => {
    const taps = tapsPerLift(createInitialState(), NO_MODIFIERS);

    expect(taps).toBeGreaterThanOrEqual(8);
    expect(taps).toBeLessThanOrEqual(10);
    expect(tapTimes(createInitialState(), taps - 1).earned).toBe(0);
    expect(tapTimes(createInitialState(), taps).earned).toBe(1);
  });

  it("resets the idle timer on every tap", () => {
    const idle = { ...createInitialState(), secondsSinceTap: 3 };

    expect(tap(idle, NO_MODIFIERS).state.secondsSinceTap).toBe(0);
  });

  it("multiplies the tap strength by the tap modifier", () => {
    expect(tapKilograms(createInitialState(), boosted)).toBeCloseTo(BASE_TAP_KILOGRAMS * 3);
    expect(tapsPerLift(createInitialState(), boosted)).toBe(3);
  });
});

describe("completing a lift", () => {
  const almostUp = { ...createInitialState(), lift: 0.95 };

  it("pays the weight, counts the lift and drops the bar", () => {
    const { state, earned } = tap(almostUp, NO_MODIFIERS);

    expect(earned).toBe(1);
    expect(state.liftsCompleted).toBe(1);
    expect(state.lift).toBeCloseTo(0.95 + BASE_TAP_KILOGRAMS / 20 - 1);
    expect(state.lift).toBeLessThan(0.1);
  });

  it("completes several lifts in one tap when the strongman outgrows the weight", () => {
    const strong = withUpgrades({ training: 4 });
    const { state, earned } = tap(strong, NO_MODIFIERS);

    expect(tapKilograms(strong, NO_MODIFIERS)).toBeCloseTo(BASE_TAP_KILOGRAMS * 16);
    expect(earned).toBe(1);
    expect(state.liftsCompleted).toBe(1);
    expect(state.lift).toBeCloseTo(38.4 / 20 - 1);

    const second = tap(state, NO_MODIFIERS);
    expect(second.earned).toBe(2);
    expect(second.state.liftsCompleted).toBe(3);
  });

  it("pays the current weight times the magnesia bonus", () => {
    const state = withUpgrades({ magnesia: 2 }, { ...createInitialState(), weightIndex: 1, lift: 0.99 });

    expect(liftPayout(state)).toBeCloseTo(WEIGHTS[1].payout * MAGNESIA_PAYOUT_MULTIPLIER ** 2);
    expect(tap(state, NO_MODIFIERS).earned).toBeCloseTo(WEIGHTS[1].payout * 2.25);
  });
});

describe("sinking", () => {
  const halfway = { ...createInitialState(), lift: 0.5 };

  it("holds the bar during the grace period after a tap", () => {
    const { state, earned } = tick(halfway, SINK_GRACE_SECONDS, live);

    expect(state.lift).toBe(0.5);
    expect(state.secondsSinceTap).toBeCloseTo(SINK_GRACE_SECONDS);
    expect(earned).toBe(0);
  });

  it("slowly sinks once the grace period is over", () => {
    const { state } = tick(halfway, SINK_GRACE_SECONDS + 0.5, live);

    expect(state.lift).toBeCloseTo(0.5 - SINK_PER_SECOND * 0.5);
  });

  it("only sinks for the part of a tick past the grace period", () => {
    const partlyIdle = { ...halfway, secondsSinceTap: SINK_GRACE_SECONDS - 0.1 };

    expect(tick(partlyIdle, 0.3, live).state.lift).toBeCloseTo(0.5 - SINK_PER_SECOND * 0.2);
  });

  it("never sinks below the floor", () => {
    expect(tick(halfway, 4, live).state.lift).toBe(0);
  });

  it("keeps the bar up while tapping in a row", () => {
    let state: StrongmanState = createInitialState();
    for (let count = 0; count < 5; count++) {
      state = tick(tap(state, NO_MODIFIERS).state, 0.2, live).state;
    }

    expect(state.lift).toBeCloseTo((5 * BASE_TAP_KILOGRAMS) / 20);
  });

  it("sinks slower with each coach", () => {
    const coached = withUpgrades({ coach: 2 }, halfway);

    expect(sinkPerSecond(coached)).toBeCloseTo(SINK_PER_SECOND * COACH_SINK_MULTIPLIER ** 2);
    expect(tick(coached, SINK_GRACE_SECONDS + 1, live).state.lift).toBeCloseTo(
      0.5 - SINK_PER_SECOND * COACH_SINK_MULTIPLIER ** 2,
    );
  });
});

describe("weights", () => {
  it("heavier weights always pay more per kilogram", () => {
    WEIGHTS.slice(1).forEach((weight, index) => {
      const lighter = WEIGHTS[index];
      expect(weight.kilograms).toBeGreaterThan(lighter.kilograms);
      expect(weight.payout / weight.kilograms).toBeGreaterThan(lighter.payout / lighter.kilograms);
      expect(weight.cost).toBeGreaterThan(lighter.cost);
    });
  });

  it("buys the next weight and puts the bar down", () => {
    const state = buyWeight({ ...createInitialState(), lift: 0.6 });

    expect(currentWeight(state).name).toBe("Disques en fonte");
    expect(state.lift).toBe(0);
    expect(nextWeight(state)?.name).toBe("Boulets de canon");
  });

  it("needs more taps for a heavier weight", () => {
    const plates = buyWeight(createInitialState());

    expect(tapsPerLift(plates, NO_MODIFIERS)).toBe(Math.ceil(WEIGHTS[1].kilograms / BASE_TAP_KILOGRAMS));
  });

  it("stops at the whole circus tent", () => {
    const tent = { ...createInitialState(), weightIndex: WEIGHTS.length - 1 };

    expect(nextWeight(tent)).toBeUndefined();
    expect(buyWeight(tent)).toBe(tent);
  });
});

describe("upgrades", () => {
  it("prices the first level at the base cost and grows it", () => {
    for (const upgrade of UPGRADES) {
      expect(upgradeCost(createInitialState(), upgrade.id)).toBe(upgrade.baseCost);
      const bought = buyUpgrade(createInitialState(), upgrade.id);
      expect(bought.upgrades[upgrade.id]).toBe(1);
      expect(upgradeCost(bought, upgrade.id)).toBe(Math.ceil(upgrade.baseCost * upgrade.costGrowth));
    }
  });

  it("makes each protein shake add strength", () => {
    expect(tapKilograms(withUpgrades({ protein: 2 }), NO_MODIFIERS)).toBeCloseTo(BASE_TAP_KILOGRAMS * 1.6);
  });

  it("doubles strength with each training", () => {
    expect(tapKilograms(withUpgrades({ protein: 1, training: 2 }), NO_MODIFIERS)).toBeCloseTo(
      BASE_TAP_KILOGRAMS * 1.3 * 4,
    );
  });

  it("caps the coach", () => {
    const maxed = withUpgrades({ coach: 5 });

    expect(canBuyUpgrade(maxed, "coach")).toBe(false);
    expect(buyUpgrade(maxed, "coach")).toBe(maxed);
    expect(canBuyUpgrade(withUpgrades({ coach: 4 }), "coach")).toBe(true);
    expect(canBuyUpgrade(withUpgrades({ protein: 99 }), "protein")).toBe(true);
  });
});

describe("automation", () => {
  const automated = withUpgrades({ autoLift: 2 });

  it("pushes like one tap per second for each level", () => {
    expect(isAutomated(createInitialState())).toBe(false);
    expect(isAutomated(automated)).toBe(true);
    expect(autoKilogramsPerSecond(automated, NO_MODIFIERS)).toBeCloseTo(2 * AUTO_PUSHES_PER_LEVEL * BASE_TAP_KILOGRAMS);
  });

  it("raises the bar on its own without sinking", () => {
    const { state, earned } = tick(automated, 2, live);

    expect(state.lift).toBeCloseTo((2 * 2 * BASE_TAP_KILOGRAMS) / 20);
    expect(earned).toBe(0);
  });

  it("completes lifts on its own", () => {
    const { state, earned } = tick(automated, 10, live);

    expect(state.liftsCompleted).toBe(2);
    expect(earned).toBe(2);
    expect(state.lift).toBeCloseTo(48 / 20 - 2);
  });

  it("uses the production modifier, not the tap modifier", () => {
    expect(autoKilogramsPerSecond(automated, boosted)).toBeCloseTo(2 * BASE_TAP_KILOGRAMS * 2);
  });

  it("reports its income per second", () => {
    const strong = withUpgrades({ autoLift: 5, magnesia: 1 }, { ...createInitialState(), weightIndex: 1 });

    const { kilograms, payout } = WEIGHTS[1];

    expect(incomePerSecond(strong, NO_MODIFIERS)).toBeCloseTo(((5 * BASE_TAP_KILOGRAMS) / kilograms) * payout * 1.5);
    expect(incomePerSecond(strong, boosted)).toBeCloseTo(((10 * BASE_TAP_KILOGRAMS) / kilograms) * payout * 1.5);
    expect(incomePerSecond(createInitialState(), boosted)).toBe(0);
  });
});

describe("tick away from the screen", () => {
  it("only pays the automation", () => {
    const automated = withUpgrades({ autoLift: 3 }, { ...createInitialState(), weightIndex: 2 });
    const hours = 2 * 60 * 60;
    const { state, earned } = tick(automated, hours, away);
    const { kilograms, payout } = WEIGHTS[2];
    const expectedLifts = Math.floor((3 * BASE_TAP_KILOGRAMS * hours) / kilograms);

    expect(state.liftsCompleted).toBe(expectedLifts);
    expect(earned).toBe(expectedLifts * payout);
    expect(earned).toBeCloseTo(incomePerSecond(automated, NO_MODIFIERS) * hours, -2);
  });

  it("neither sinks nor pays without automation", () => {
    const halfway = { ...createInitialState(), lift: 0.5 };

    expect(tick(halfway, 3_600, away)).toEqual({ state: halfway, earned: 0 });
  });

  it("treats a long live gap like time away", () => {
    const halfway = { ...createInitialState(), lift: 0.5 };

    expect(tick(halfway, MAX_LIVE_TICK_SECONDS + 1, live).state.lift).toBe(0.5);
  });
});

describe("restoreState", () => {
  it("fills in missing fields", () => {
    expect(restoreState({})).toEqual({ state: createInitialState(), earned: 0 });
  });

  it("keeps saved progress and adds upgrades from newer versions", () => {
    const { state, earned } = restoreState({
      weightIndex: 3,
      liftsCompleted: 42,
      upgrades: { protein: 4 } as StrongmanState["upgrades"],
    });

    expect(earned).toBe(0);
    expect(state.weightIndex).toBe(3);
    expect(state.liftsCompleted).toBe(42);
    expect(state.upgrades).toEqual({ ...createInitialState().upgrades, protein: 4 });
  });

  it("round-trips a current save", () => {
    const state = tick(tapTimes(withUpgrades({ autoLift: 2 }), 12).state, 1, live).state;

    expect(restoreState(state)).toEqual({ state, earned: 0 });
  });

  it("clamps a weight index from a longer weight list", () => {
    expect(restoreState({ weightIndex: 99 }).state.weightIndex).toBe(WEIGHTS.length - 1);
  });
});

describe("logic", () => {
  it("exposes lifts and the heaviest weight as metrics", () => {
    const state = { ...createInitialState(), weightIndex: 5, liftsCompleted: 12 };

    expect(logic.metrics(state)).toEqual({ liftsCompleted: 12, maxKilograms: WEIGHTS[5].kilograms });
  });

  it("ticks with the context", () => {
    const automated = withUpgrades({ autoLift: 10 });

    expect(logic.tick(automated, 60, { modifiers: boosted, isFocused: false }).earned).toBe(
      Math.floor((10 * BASE_TAP_KILOGRAMS * 2 * 60) / 20),
    );
  });

  it("reports income with modifiers", () => {
    expect(logic.incomePerSecond(withUpgrades({ autoLift: 1 }), boosted)).toBeCloseTo((BASE_TAP_KILOGRAMS * 2) / 20);
  });
});
