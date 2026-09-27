import { describe, expect, it } from "vitest";
import { NO_MODIFIERS, type TickContext } from "../types";
import { BOARD_SIZE, GOONS, RANKS, REPUTATION_BONUS_PER_CONTRACT, STORY_CONTRACTS, TIERS, TOOLS } from "./config";
import { logic } from "./logic";
import {
  availableGoons,
  buyNextTool,
  claimContract,
  contractAt,
  contractProgress,
  createInitialState,
  currentTier,
  damagePerSecond,
  goonCost,
  goonCount,
  hireGoon,
  incomePerSecond,
  integrity,
  isContractDone,
  nextRank,
  nextTool,
  payout,
  rank,
  reputationMultiplier,
  restoreState,
  selectTier,
  smash,
  tapDamage,
  tick,
  type PiggyState,
} from "./state";

const focused: TickContext = { modifiers: NO_MODIFIERS, isFocused: true };
const offline: TickContext = { modifiers: NO_MODIFIERS, isFocused: false };

function stateWith(overrides: Partial<PiggyState>): PiggyState {
  return { ...createInitialState(), ...overrides };
}

function smashTimes(state: PiggyState, taps: number) {
  let earned = 0;
  for (let tap = 0; tap < taps; tap++) {
    const earning = smash(state, NO_MODIFIERS);
    state = earning.state;
    earned += earning.earned;
  }
  return { state, earned };
}

function boardWith(...ids: number[]) {
  return ids.map((id) => ({ id, progress: 0 }));
}

describe("smashing a piggy bank", () => {
  it("starts on an intact ceramic bank with a hammer", () => {
    const state = createInitialState();

    expect(currentTier(state).id).toBe("ceramic");
    expect(tapDamage(state, NO_MODIFIERS)).toBe(1);
    expect(integrity(state)).toBe(1);
  });

  it("chips away the bank without paying until it breaks", () => {
    const { state, earned } = smashTimes(createInitialState(), TIERS[0].hp - 1);

    expect(earned).toBe(0);
    expect(state.damage).toBe(TIERS[0].hp - 1);
    expect(state.hits).toBe(TIERS[0].hp - 1);
    expect(integrity(state)).toBeCloseTo(1 / TIERS[0].hp);
  });

  it("pays the tier payout on the breaking hit and brings a fresh bank", () => {
    const { state, earned } = smashTimes(createInitialState(), TIERS[0].hp);

    expect(earned).toBe(TIERS[0].payout);
    expect(state.damage).toBe(0);
    expect(state.hits).toBe(0);
    expect(state.broken).toBe(1);
    expect(state.looted).toBe(TIERS[0].payout);
  });

  it("carries overflow damage into the next banks", () => {
    const state = stateWith({ toolLevel: 2 });
    const { state: next, earned } = smash(state, NO_MODIFIERS);

    expect(TOOLS[2].damage).toBe(20);
    expect(next.broken).toBe(4);
    expect(earned).toBe(4 * TIERS[0].payout);
    expect(next.damage).toBe(0);
  });

  it("multiplies tap damage by the tap modifier", () => {
    const boosted = { production: 1, tap: 5 };

    expect(tapDamage(createInitialState(), boosted)).toBe(5);
    expect(smash(createInitialState(), boosted).state.broken).toBe(1);
  });

  it("earns the first contract in a hundred taps", () => {
    const { state, earned } = smashTimes(createInitialState(), 100);

    expect(isContractDone(state, state.board[0])).toBe(true);
    expect(earned).toBe(20 * TIERS[0].payout);
  });
});

describe("payouts", () => {
  it("grows much faster than the toughness from tier to tier", () => {
    TIERS.slice(1).forEach((tier, index) => {
      const previous = TIERS[index];
      expect(tier.payout / tier.hp).toBeGreaterThan(previous.payout / previous.hp);
    });
  });

  it("gains reputation with every completed contract", () => {
    const state = stateWith({ contractsCompleted: 4 });

    expect(reputationMultiplier(state)).toBeCloseTo(1 + 4 * REPUTATION_BONUS_PER_CONTRACT);
    expect(payout(state)).toBeCloseTo(TIERS[0].payout * reputationMultiplier(state));
    expect(smashTimes(state, TIERS[0].hp).earned).toBeCloseTo(payout(state));
  });

  it("climbs the family ranks with contracts", () => {
    expect(rank(createInitialState())).toBe(RANKS[0]);
    expect(nextRank(createInitialState())).toBe(RANKS[1]);
    expect(rank(stateWith({ contractsCompleted: RANKS[2].contracts }))).toBe(RANKS[2]);
    expect(nextRank(stateWith({ contractsCompleted: 1_000 }))).toBeUndefined();
  });
});

describe("tiers", () => {
  it("only switches to unlocked tiers and starts on an intact bank", () => {
    const damaged = stateWith({ unlockedTiers: 2, damage: 3, hits: 3 });

    expect(selectTier(damaged, 2)).toBe(damaged);
    expect(selectTier(damaged, -1)).toBe(damaged);
    const metal = selectTier(damaged, 1);
    expect(currentTier(metal).id).toBe("metal");
    expect(metal.damage).toBe(0);
    expect(metal.hits).toBe(0);
  });
});

describe("tools", () => {
  it("upgrades one tool at a time", () => {
    const state = buyNextTool(createInitialState());

    expect(state.toolLevel).toBe(1);
    expect(tapDamage(state, NO_MODIFIERS)).toBe(TOOLS[1].damage);
    expect(nextTool(state)).toBe(TOOLS[2]);
  });

  it("stops at the last tool", () => {
    const state = stateWith({ toolLevel: TOOLS.length - 1 });

    expect(nextTool(state)).toBeUndefined();
    expect(buyNextTool(state)).toBe(state);
  });

  it("gets pricier with every tool", () => {
    TOOLS.slice(1).forEach((tool, index) => expect(tool.cost).toBeGreaterThan(TOOLS[index].cost));
  });
});

describe("goons", () => {
  it("hires goons with growing costs", () => {
    const state = hireGoon(createInitialState(), "punk");

    expect(state.goons.punk).toBe(1);
    expect(goonCount(state)).toBe(1);
    expect(goonCost(createInitialState(), "punk")).toBe(GOONS[0].baseCost);
    expect(goonCost(state, "punk")).toBeGreaterThan(GOONS[0].baseCost);
  });

  it("offers the tougher crews once their tier is unlocked", () => {
    const ids = (state: PiggyState) => availableGoons(state).map((goon) => goon.id);

    expect(ids(createInitialState())).toEqual(["punk", "muscle"]);
    expect(ids(stateWith({ unlockedTiers: 3 }))).toEqual(["punk", "muscle", "safecracker"]);
    expect(ids(stateWith({ unlockedTiers: TIERS.length }))).toEqual(GOONS.map((goon) => goon.id));
  });

  it("breaks banks automatically over time", () => {
    const state = hireGoon(hireGoon(createInitialState(), "muscle"), "punk");
    const { state: next, earned } = tick(state, 10, focused);

    expect(damagePerSecond(state, NO_MODIFIERS)).toBe(4.5);
    expect(next.broken).toBe(9);
    expect(earned).toBe(9 * TIERS[0].payout);
    expect(next.hits).toBe(0);
  });

  it("does nothing without goons", () => {
    const state = createInitialState();

    expect(tick(state, 60, focused)).toEqual({ state, earned: 0 });
    expect(incomePerSecond(state, NO_MODIFIERS)).toBe(0);
  });

  it("reports income from the damage on the current tier", () => {
    const state = stateWith({ goons: { ...createInitialState().goons, muscle: 1 } });

    expect(incomePerSecond(state, NO_MODIFIERS)).toBe((4 / TIERS[0].hp) * TIERS[0].payout);
    expect(incomePerSecond(state, { production: 3, tap: 1 })).toBe(3 * incomePerSecond(state, NO_MODIFIERS));
    expect(logic.incomePerSecond(state, NO_MODIFIERS)).toBe(incomePerSecond(state, NO_MODIFIERS));
  });

  it("matches the advertised income over a long offline stretch", () => {
    const state = stateWith({ goons: { ...createInitialState().goons, punk: 3, muscle: 2 } });
    const hours = 8 * 60 * 60;
    const { state: next, earned } = logic.tick(state, hours, offline);

    expect(earned).toBeCloseTo(incomePerSecond(state, NO_MODIFIERS) * hours, -4);
    expect(next.broken).toBe(Math.floor((9.5 * hours) / TIERS[0].hp));
    expect(next.damage).toBeLessThan(TIERS[0].hp);
  });

  it("does not count goon breaks as hits for quick contracts", () => {
    const state = stateWith({ unlockedTiers: 2, tierIndex: 1, board: boardWith(5, 6, 7) });
    const withGoons = { ...state, goons: { ...state.goons, muscle: 20 } };

    expect(tick(withGoons, 1, focused).state.board[0].progress).toBe(0);
  });
});

describe("contracts", () => {
  it("starts with the first story contracts on the board", () => {
    const state = createInitialState();

    expect(state.board.map((active) => active.id)).toEqual([0, 1, 2]);
    expect(state.board).toHaveLength(BOARD_SIZE);
    expect(state.nextContract).toBe(BOARD_SIZE);
  });

  it("tracks broken banks of the right tier only", () => {
    const state = stateWith({ unlockedTiers: 2, board: boardWith(0, 4, 2) });
    const ceramic = smashTimes(state, TIERS[0].hp).state;

    expect(contractProgress(ceramic, ceramic.board[0])).toBe(1);
    expect(contractProgress(ceramic, ceramic.board[1])).toBe(0);
    expect(contractProgress(ceramic, ceramic.board[2])).toBe(TIERS[0].payout);
  });

  it("caps progress at the target", () => {
    const state = stateWith({ toolLevel: 5 });
    const { state: next } = smash(state, NO_MODIFIERS);

    expect(next.broken).toBeGreaterThan(20);
    expect(contractProgress(next, next.board[0])).toBe(20);
  });

  it("counts the whole crew and the current tool", () => {
    const hire = contractAt(1);
    const tool = contractAt(3);
    const state = stateWith({ board: boardWith(1, 3, 2), toolLevel: 1 });

    expect(hire.goal).toEqual({ kind: "hire", count: 1 });
    expect(isContractDone(state, state.board[0])).toBe(false);
    expect(isContractDone(hireGoon(state, "muscle"), state.board[0])).toBe(true);
    expect(tool.goal).toEqual({ kind: "tool", level: 1 });
    expect(isContractDone(state, state.board[1])).toBe(true);
  });

  it("completes a quick contract only within the hit limit", () => {
    const quick = contractAt(5);
    expect(quick.goal).toEqual({ kind: "quick", tier: 1, maxHits: 15 });
    const state = stateWith({ unlockedTiers: 2, tierIndex: 1, board: boardWith(5, 6, 7) });

    const slow = smashTimes(state, TIERS[1].hp).state;
    expect(slow.broken).toBe(1);
    expect(isContractDone(slow, slow.board[0])).toBe(false);

    const fast = smashTimes({ ...state, toolLevel: 1 }, 15).state;
    expect(fast.broken).toBe(1);
    expect(isContractDone(fast, fast.board[0])).toBe(true);
  });

  it("pays nothing for an unfinished contract", () => {
    const state = createInitialState();

    expect(claimContract(state, 0)).toEqual({ state, earned: 0 });
    expect(claimContract(state, 7)).toEqual({ state, earned: 0 });
  });

  it("pays the reward, gains reputation and deals the next contract", () => {
    const done = smashTimes(createInitialState(), 100).state;
    const { state, earned } = claimContract(done, 0);

    expect(earned).toBe(STORY_CONTRACTS[0].reward);
    expect(state.contractsCompleted).toBe(1);
    expect(state.board.map((active) => active.id)).toEqual([3, 1, 2]);
    expect(state.board[0].progress).toBe(0);
    expect(state.nextContract).toBe(BOARD_SIZE + 1);
    expect(reputationMultiplier(state)).toBeGreaterThan(1);
  });

  it("unlocks and moves to the next tier", () => {
    const unlocking = STORY_CONTRACTS.findIndex((contract) => contract.unlocksTier === 1);
    const state = stateWith({ board: [{ id: unlocking, progress: 250_000 }, ...boardWith(0, 1)], damage: 2 });
    const { state: next } = claimContract(state, 0);

    expect(next.unlockedTiers).toBe(2);
    expect(currentTier(next).id).toBe("metal");
    expect(next.damage).toBe(0);
  });

  it("unlocks every tier through the story", () => {
    const unlocked = STORY_CONTRACTS.flatMap((contract) => contract.unlocksTier ?? []);

    expect(unlocked).toEqual([1, 2, 3, 4]);
  });

  it("never asks for a tier before the contract that unlocks it", () => {
    STORY_CONTRACTS.forEach((contract, id) => {
      const { goal } = contract;
      if (goal.kind !== "break" && goal.kind !== "quick") return;
      const unlocker = STORY_CONTRACTS.findIndex((c) => (c.unlocksTier ?? 0) >= goal.tier);
      expect(goal.tier === 0 || unlocker < id).toBe(true);
    });
  });

  it("deals endless routine contracts after the story", () => {
    const first = contractAt(STORY_CONTRACTS.length);
    const later = contractAt(STORY_CONTRACTS.length + 10);

    expect(first.goal).toEqual({ kind: "break", tier: TIERS.length - 1, count: 5 });
    expect(first.reward).toBeGreaterThan(0);
    expect(contractAt(STORY_CONTRACTS.length + 1).goal.kind).toBe("loot");
    expect(later.goal.kind).toBe("break");
    expect(later.reward).toBeGreaterThan(first.reward);
  });
});

describe("saves", () => {
  it("fills every missing field with defaults", () => {
    const { state, earned } = restoreState({});

    expect(state).toEqual(createInitialState());
    expect(earned).toBe(0);
  });

  it("keeps saved progress and adds new goons", () => {
    const saved = { ...createInitialState(), toolLevel: 2, goons: { punk: 3 } } as unknown as PiggyState;
    const { state } = restoreState(saved);

    expect(state.toolLevel).toBe(2);
    expect(state.goons).toEqual({ punk: 3, muscle: 0, safecracker: 0, movers: 0, cousins: 0 });
  });

  it("clamps out of range tiers and tools", () => {
    const { state } = restoreState({ unlockedTiers: 99, tierIndex: 99, toolLevel: 99 });

    expect(state.unlockedTiers).toBe(TIERS.length);
    expect(state.tierIndex).toBe(TIERS.length - 1);
    expect(state.toolLevel).toBe(TOOLS.length - 1);
    expect(restoreState({ unlockedTiers: 1, tierIndex: 3 }).state.tierIndex).toBe(0);
  });

  it("repairs a bank damaged beyond its toughness", () => {
    expect(restoreState({ tierIndex: 0, damage: 50 }).state.damage).toBe(0);
  });
});

describe("metrics", () => {
  it("exposes contracts, tiers and broken banks", () => {
    const state = stateWith({ contractsCompleted: 4, unlockedTiers: 2, broken: 30 });

    expect(logic.metrics(state)).toEqual({ contractsCompleted: 4, tiersUnlocked: 2, banksBroken: 30 });
  });
});
