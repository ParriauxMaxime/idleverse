import { describe, expect, it } from "vitest";
import { NO_MODIFIERS, type TickContext } from "../types";
import {
  DEBUNK,
  DOLLARS_PER_BELIEVER_PER_SECOND,
  DOLLARS_PER_WHISPERED_BELIEVER,
  SCOPES,
  UPGRADES,
} from "./config";
import { logic } from "./logic";
import {
  applyOfflineProgress,
  believerSeconds,
  buyUpgrade,
  canLevelUp,
  createInitialState,
  crushDebunk,
  incomePerSecond,
  levelUp,
  population,
  restoreState,
  spread,
  spreadRate,
  tapPower,
  tick,
  upgradeCost,
  whisper,
  whisperEarning,
  type RumorState,
} from "./state";

const alwaysZero = () => 0;
const focused: TickContext = { modifiers: NO_MODIFIERS, isFocused: true };
const background: TickContext = { modifiers: NO_MODIFIERS, isFocused: false };

function stateWith(overrides: Partial<RumorState>): RumorState {
  return { ...createInitialState(), ...overrides };
}

function tickState(state: RumorState, seconds: number, context: TickContext): RumorState {
  return tick(state, seconds, context, alwaysZero).state;
}

describe("whisper", () => {
  it("adds tap power believers and earns a little money", () => {
    const { state, earned } = whisper(createInitialState(), NO_MODIFIERS);

    expect(state.believers).toBe(1);
    expect(earned).toBe(DOLLARS_PER_WHISPERED_BELIEVER);
  });

  it("is multiplied by the tap modifier", () => {
    const boosted = { production: 1, tap: 3 };
    const { state, earned } = whisper(stateWith({ scopeIndex: 1 }), boosted);

    expect(state.believers).toBe(3);
    expect(earned).toBe(3 * DOLLARS_PER_WHISPERED_BELIEVER);
  });

  it("never exceeds the population but still pays", () => {
    const { state, earned } = whisper(stateWith({ believers: 30 }), { production: 1, tap: 100 });

    expect(state.believers).toBe(30);
    expect(earned).toBe(whisperEarning(stateWith({ believers: 30 }), { production: 1, tap: 100 }));
    expect(earned).toBeGreaterThan(0);
  });
});

describe("income", () => {
  it("is produced by believers", () => {
    const state = stateWith({ scopeIndex: 2, believers: 1_000 });

    expect(incomePerSecond(state, NO_MODIFIERS)).toBe(1_000 * DOLLARS_PER_BELIEVER_PER_SECOND);
    expect(logic.incomePerSecond(state, NO_MODIFIERS)).toBe(incomePerSecond(state, NO_MODIFIERS));
  });

  it("is multiplied by the production modifier", () => {
    const state = stateWith({ scopeIndex: 2, believers: 1_000 });

    expect(incomePerSecond(state, { production: 2.5, tap: 1 })).toBe(2.5 * incomePerSecond(state, NO_MODIFIERS));
  });

  it("is zero without believers", () => {
    expect(incomePerSecond(createInitialState(), NO_MODIFIERS)).toBe(0);
    expect(tick(createInitialState(), 10, focused, alwaysZero).earned).toBe(0);
  });

  it("pays believers times seconds once the population is reached", () => {
    const state = stateWith({ believers: 30 });

    expect(tick(state, 2, focused, alwaysZero).earned).toBeCloseTo(60 * DOLLARS_PER_BELIEVER_PER_SECOND);
  });

  it("pays the income per second over a short tick", () => {
    const state = stateWith({ scopeIndex: 3, believers: 1_000 });
    const boosted: TickContext = { modifiers: { production: 2, tap: 1 }, isFocused: true };

    expect(tick(state, 0.1, boosted, alwaysZero).earned).toBeCloseTo(incomePerSecond(state, boosted.modifiers) * 0.1, 0);
  });

  it("follows the spreading believers over a long gap", () => {
    const state = stateWith({ scopeIndex: 2, believers: 100 });
    const hours = 8 * 3600;
    const { earned } = tick(state, hours, background, alwaysZero);

    expect(earned).toBeGreaterThan(100 * hours);
    expect(earned).toBeLessThan(population(state) * hours);
    expect(Number.isFinite(believerSeconds(state, 1e9, NO_MODIFIERS))).toBe(true);
  });

  it("matches a fine numerical integration of the spread", () => {
    const state = stateWith({ scopeIndex: 2, believers: 50 });
    let current = state;
    let summed = 0;
    for (let step = 0; step < 6_000; step++) {
      const next = spread(current, 0.01, NO_MODIFIERS);
      summed += ((current.believers + next.believers) / 2) * 0.01;
      current = next;
    }

    expect(believerSeconds(state, 60, NO_MODIFIERS)).toBeCloseTo(summed, 1);
  });
});

describe("spread", () => {
  it("does nothing without believers", () => {
    const state = createInitialState();

    expect(spread(state, 100, NO_MODIFIERS).believers).toBe(0);
  });

  it("grows believers following the logistic rate", () => {
    const state = stateWith({ scopeIndex: 2, believers: 100 });
    const expected = spreadRate(state, NO_MODIFIERS) * 100 * (1 - 100 / population(state));

    expect(spread(state, 0.01, NO_MODIFIERS).believers - 100).toBeCloseTo(expected * 0.01, 3);
  });

  it("is multiplied by the production modifier", () => {
    const state = stateWith({ scopeIndex: 2, believers: 100 });
    const boosted = { production: 2, tap: 1 };

    expect(spreadRate(state, boosted)).toBeCloseTo(spreadRate(state, NO_MODIFIERS) * 2);
    expect(spread(state, 10, boosted).believers).toBeGreaterThan(spread(state, 10, NO_MODIFIERS).believers);
  });

  it("fills the population exactly once less than one believer is missing", () => {
    const state = stateWith({ believers: 29.5 });

    expect(spread(state, 60, NO_MODIFIERS).believers).toBe(population(state));
  });

  it("never exceeds the population, even over a huge duration", () => {
    const state = stateWith({ believers: 1, upgrades: { ...createInitialState().upgrades, anonymous: 500 } });

    for (const seconds of [1, 60, 1e6, 1e12]) {
      expect(spread(state, seconds, NO_MODIFIERS).believers).toBeLessThanOrEqual(population(state));
    }
    expect(spread(state, 1e6, NO_MODIFIERS).believers).toBeCloseTo(population(state));
  });
});

describe("scopes", () => {
  it("cannot level up below the threshold", () => {
    const state = stateWith({ believers: 20 });

    expect(canLevelUp(state)).toBe(false);
    expect(levelUp(state)).toBe(state);
  });

  it("unlocks the next scope and keeps believers", () => {
    const state = levelUp(stateWith({ believers: 27 }));

    expect(state.scopeIndex).toBe(1);
    expect(state.believers).toBe(27);
    expect(population(state)).toBe(SCOPES[1].population);
  });

  it("cannot go past the last scope", () => {
    const last = SCOPES.length - 1;
    const state = stateWith({ scopeIndex: last, believers: SCOPES[last].population });

    expect(canLevelUp(state)).toBe(false);
  });
});

describe("upgrades", () => {
  it("keep believers and raise tap power", () => {
    const state = buyUpgrade(stateWith({ believers: 25 }), "whatsapp");

    expect(state.believers).toBe(25);
    expect(state.upgrades.whatsapp).toBe(1);
    expect(tapPower(state, NO_MODIFIERS)).toBe(2);
    expect(whisperEarning(state, NO_MODIFIERS)).toBe(2 * DOLLARS_PER_WHISPERED_BELIEVER);
  });

  it("raise the spread rate", () => {
    const initial = stateWith({ believers: 25 });

    expect(spreadRate(buyUpgrade(initial, "anonymous"), NO_MODIFIERS)).toBeGreaterThan(spreadRate(initial, NO_MODIFIERS));
  });

  it("cost money that grows with each purchase", () => {
    const initial = createInitialState();

    expect(upgradeCost(initial, "whatsapp")).toBe(1_000);
    expect(upgradeCost(buyUpgrade(initial, "whatsapp"), "whatsapp")).toBe(Math.ceil(1_000 * 1.15));
    expect(upgradeCost(initial, "youtube")).toBe(30_000_000);
  });

  it("are priced in increasing order", () => {
    const costs = UPGRADES.map(({ id }) => upgradeCost(createInitialState(), id));

    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });
});

describe("debunks", () => {
  it("do not appear below the minimum believers", () => {
    const state = stateWith({ believers: 0, secondsUntilDebunk: 0.1 });

    expect(tickState(state, 1, focused).debunk).toBeNull();
  });

  it("appear when the timer runs out", () => {
    const state = tickState(stateWith({ believers: 10, secondsUntilDebunk: 0.5 }), 1, focused);

    expect(state.debunk).toEqual({ messageIndex: 0, secondsLeft: DEBUNK.durationSeconds });
  });

  it("remove a share of believers when ignored", () => {
    const state = stateWith({ believers: 20, debunk: { messageIndex: 0, secondsLeft: 0.5 } });
    const next = tickState(state, 1, focused);
    const believersWithoutPenalty = spread(state, 1, NO_MODIFIERS).believers;

    expect(next.debunk).toBeNull();
    expect(next.believers).toBeCloseTo(believersWithoutPenalty * (1 - DEBUNK.penalty));
    expect(next.secondsUntilDebunk).toBe(DEBUNK.minDelaySeconds);
  });

  it("cost believers, never money", () => {
    const state = stateWith({ believers: 30, debunk: { messageIndex: 0, secondsLeft: 0.5 } });
    const { state: next, earned } = tick(state, 1, focused, alwaysZero);

    expect(next.believers).toBeCloseTo(30 * (1 - DEBUNK.penalty));
    expect(earned).toBeCloseTo(30 * DOLLARS_PER_BELIEVER_PER_SECOND);
  });

  it("cost nothing when crushed in time", () => {
    const state = stateWith({ believers: 20, debunk: { messageIndex: 0, secondsLeft: 3 } });
    const crushed = crushDebunk(state, () => 1);

    expect(crushed.debunk).toBeNull();
    expect(crushed.believers).toBe(20);
    expect(crushed.secondsUntilDebunk).toBe(DEBUNK.maxDelaySeconds);
  });
});

describe("offline progress", () => {
  it("spreads without debunk penalties", () => {
    const state = stateWith({ scopeIndex: 1, believers: 50, debunk: { messageIndex: 0, secondsLeft: 1 } });
    const next = applyOfflineProgress(state, 3600, NO_MODIFIERS);

    expect(next.debunk).toBeNull();
    expect(next.believers).toBeGreaterThan(50);
    expect(next.believers).toBeLessThanOrEqual(population(state));
  });

  it("is used by tick for long gaps such as a hidden tab", () => {
    const state = stateWith({ believers: 20, debunk: { messageIndex: 0, secondsLeft: 1 } });

    expect(tickState(state, 600, focused).believers).toBeGreaterThan(20);
  });
});

describe("background ticks", () => {
  it("never show a debunk", () => {
    const state = tickState(stateWith({ believers: 10, secondsUntilDebunk: 0.5 }), 1, background);

    expect(state.debunk).toBeNull();
    expect(state.secondsUntilDebunk).toBeGreaterThanOrEqual(DEBUNK.minDelaySeconds);
  });

  it("drop a pending debunk without penalty", () => {
    const state = stateWith({ believers: 20, debunk: { messageIndex: 0, secondsLeft: 0.5 } });
    const next = tickState(state, 1, background);

    expect(next.debunk).toBeNull();
    expect(next.believers).toBeCloseTo(spread(state, 1, NO_MODIFIERS).believers);
  });

  it("still spread with the production modifier", () => {
    const state = stateWith({ scopeIndex: 2, believers: 100 });
    const boosted: TickContext = { modifiers: { production: 3, tap: 1 }, isFocused: false };

    expect(tickState(state, 1, boosted).believers).toBeGreaterThan(tickState(state, 1, background).believers);
  });
});

describe("restoreState", () => {
  it("fills missing fields from the initial state and earns nothing", () => {
    const { state, earned } = restoreState({ believers: 12, upgrades: { whatsapp: 2 } as RumorState["upgrades"] });

    expect(earned).toBe(0);
    expect(state.believers).toBe(12);
    expect(state.upgrades).toEqual({ ...createInitialState().upgrades, whatsapp: 2 });
    expect(state.scopeIndex).toBe(0);
  });

  it("keeps believers as a stat and drops obsolete fields", () => {
    const legacy = { believers: 7, scopeIndex: 2, capacity: 99, upgrades: { whatsapp: 1, megaphone: 4 } };
    const { state, earned } = logic.restoreState(legacy as unknown as RumorState);

    expect(earned).toBe(0);
    expect(state).toEqual({
      ...createInitialState(),
      believers: 7,
      scopeIndex: 2,
      upgrades: { ...createInitialState().upgrades, whatsapp: 1 },
    });
  });
});

describe("logic", () => {
  it("ticks with the platform context and returns the money earned", () => {
    const { state, earned } = logic.tick(stateWith({ believers: 30 }), 1, background);

    expect(state.believers).toBe(30);
    expect(earned).toBeCloseTo(30 * DOLLARS_PER_BELIEVER_PER_SECOND);
  });

  it("exposes a 1-based scope level and believers as metrics", () => {
    expect(logic.metrics(createInitialState())).toEqual({ scopeLevel: 1, believers: 0 });
    expect(logic.metrics(stateWith({ scopeIndex: 5, believers: 1234 }))).toEqual({ scopeLevel: 6, believers: 1234 });
  });

  it("starts from the initial state", () => {
    expect(logic.createInitialState()).toEqual(createInitialState());
  });
});
