import { describe, expect, it } from "vitest";
import type { GameDefinition, GameLogic } from "../games/types";
import { memoryStorage } from "./memoryStorage";
import { MAX_OFFLINE_SECONDS, createRuntime } from "./runtime";
import { saveState } from "./save";

interface CounterState {
  amount: number;
  legacyCash?: number;
}

const INCOME_PER_SECOND = 100;

const counterLogic: GameLogic<CounterState> = {
  createInitialState: () => ({ amount: 0 }),
  restoreState: ({ legacyCash = 0, ...state }) => ({ state, earned: legacyCash }),
  tick: (state, seconds, { modifiers }) => {
    const earned = INCOME_PER_SECOND * seconds * modifiers.production;
    return { state: { amount: state.amount + earned }, earned };
  },
  incomePerSecond: (_state, modifiers) => INCOME_PER_SECOND * modifiers.production,
  metrics: (state) => ({ absorbedMass: state.amount, speciesDiscovered: 0 }),
};

function counterGame(id: string): GameDefinition<CounterState> {
  return {
    id,
    name: id,
    genre: "clicker",
    emoji: "",
    accent: "",
    pitch: "",
    logic: counterLogic,
    loadView: () => Promise.reject(new Error("no view in tests")),
  };
}

const games = [counterGame("black-hole"), counterGame("slime-lab")];

describe("runtime", () => {
  it("starts with only the starting game and an empty wallet", () => {
    const runtime = createRuntime(games, memoryStorage());

    expect(runtime.isAvailable("black-hole")).toBe(true);
    expect(runtime.isAvailable("slime-lab")).toBe(false);
    expect(runtime.wallet()).toBe(0);
  });

  it("credits every game's production to the shared wallet", () => {
    const runtime = createRuntime(games, memoryStorage());

    runtime.tick(25);
    runtime.tick(1);

    expect(runtime.wallet()).toBe(2_500 + 2 * INCOME_PER_SECOND);
    expect(runtime.totalIncome()).toBe(2 * INCOME_PER_SECOND);
  });

  it("unlocks the next game when the requirement is met", () => {
    const runtime = createRuntime(games, memoryStorage());
    const unlocked: string[] = [];
    runtime.onUnlock((unlock) => unlocked.push(unlock.id));

    runtime.tick(25);

    expect(unlocked).toEqual(["slime-lab"]);
    expect(runtime.isAvailable("slime-lab")).toBe(true);
  });

  it("restores progression, wallet and offline progress from storage", () => {
    const storage = memoryStorage();
    const runtime = createRuntime(games, storage);
    runtime.tick(25);
    runtime.save();

    const restored = createRuntime(games, storage);

    expect(restored.isAvailable("slime-lab")).toBe(true);
    expect(restored.wallet()).toBeGreaterThanOrEqual(2_500);
  });

  it("caps offline progress", () => {
    const storage = memoryStorage();
    saveState(storage, "incremental:black-hole", { amount: 0 }, 0);

    const runtime = createRuntime(games, storage);

    expect(runtime.wallet()).toBe(INCOME_PER_SECOND * MAX_OFFLINE_SECONDS);
  });

  it("converts a legacy per-game balance into money once", () => {
    const storage = memoryStorage();
    saveState(storage, "incremental:black-hole", { amount: 0, legacyCash: 700 });

    const runtime = createRuntime(games, storage);
    runtime.save();
    const reloaded = createRuntime(games, storage);

    expect(runtime.wallet()).toBeCloseTo(700);
    expect(reloaded.wallet()).toBeCloseTo(700);
  });

  it("spends the wallet on purchases and refuses when it is too low", () => {
    const runtime = createRuntime(games, memoryStorage());
    const session = runtime.session(games[0]);
    runtime.tick(1);

    expect(session.buy(60, (state) => ({ amount: state.amount + 1 }))).toBe(true);
    expect(session.buy(60, (state) => ({ amount: state.amount + 1 }))).toBe(false);
    expect(runtime.wallet()).toBe(40);
    expect(session.state().amount).toBe(101);
  });

  it("credits earning actions and notifies listeners", () => {
    const runtime = createRuntime(games, memoryStorage());
    const session = runtime.session(games[0]);
    const seen: number[] = [];
    session.onChange((state) => seen.push(state.amount));

    session.earn((state) => ({ state: { amount: state.amount + 1 }, earned: 5 }));

    expect(seen).toEqual([1]);
    expect(session.wallet()).toBe(5);
  });

  it("resets everything back to the starting game", () => {
    const runtime = createRuntime(games, memoryStorage());
    runtime.tick(25);

    runtime.resetAll();

    expect(runtime.isAvailable("slime-lab")).toBe(false);
    expect(runtime.wallet()).toBe(0);
  });

  it("adds money to the wallet and keeps it after a save", () => {
    const storage = memoryStorage();
    const runtime = createRuntime(games, storage);

    runtime.addMoney(10_000);
    runtime.save();

    expect(createRuntime(games, storage).wallet()).toBe(10_000);
  });

  describe("all games unlocked", () => {
    it("opens every game without granting its unlock", () => {
      const runtime = createRuntime(games, memoryStorage());

      runtime.setAllGamesUnlocked(true);

      expect(runtime.isAvailable("slime-lab")).toBe(true);
      expect(runtime.isUnlocked("slime-lab")).toBe(false);
    });

    it("stays on after a reload", () => {
      const storage = memoryStorage();
      const runtime = createRuntime(games, storage);
      runtime.setAllGamesUnlocked(true);
      runtime.save();

      const reloaded = createRuntime(games, storage);

      expect(reloaded.allGamesUnlocked()).toBe(true);
      expect(reloaded.isAvailable("slime-lab")).toBe(true);
    });

    it("hides games not earned yet once switched off, keeping their progress", () => {
      const storage = memoryStorage();
      const runtime = createRuntime(games, storage);
      runtime.setAllGamesUnlocked(true);
      runtime.session(games[1]).update(() => ({ amount: 42 }));

      runtime.setAllGamesUnlocked(false);
      runtime.setAllGamesUnlocked(true);

      expect(runtime.session(games[1]).state().amount).toBe(42);
      runtime.setAllGamesUnlocked(false);
      expect(runtime.isAvailable("slime-lab")).toBe(false);
    });
  });
});
