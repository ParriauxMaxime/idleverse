import { describe, expect, it } from "vitest";
import { createRuntime } from "../../platform/runtime";
import { memoryStorage } from "../../platform/memoryStorage";
import { NO_MODIFIERS, type GameDefinition } from "../types";
import {
  BLACKJACK_PAYOUTS,
  CHAMPAGNE_BONUS_PER_LEVEL,
  FREE_CHIP,
  HANDS_PER_SECOND_PER_REGULAR,
  MIN_BET,
  RESHUFFLE_BELOW,
  SHOE_DECKS,
  TABLES,
  UPGRADES,
  type Rank,
  type Suit,
} from "./config";
import { logic } from "./logic";
import {
  addToStake,
  autoBetOptions,
  availableChips,
  buyTable,
  buyUpgrade,
  canBuyUpgrade,
  canClaimFreeChip,
  canDeal,
  claimFreeChip,
  clearStake,
  createInitialState,
  createShoe,
  deal,
  dealerStep,
  expectedValue,
  finishHand,
  fitStake,
  handsPerSecond,
  handValue,
  hit,
  incomePerSecond,
  isBlackjack,
  isAutomationProfitable,
  restoreState,
  setAutoBet,
  stand,
  tableLimit,
  tick,
  upgradeCost,
  type BlackjackState,
  type Card,
  type Random,
} from "./state";

const never: Random = () => 0.999;
const always: Random = () => 0;
const live = { modifiers: NO_MODIFIERS, isFocused: true };
const away = { modifiers: NO_MODIFIERS, isFocused: false };

function seeded(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function card(rank: Rank, suit: Suit = "spades"): Card {
  return { rank, suit };
}

function cards(...ranks: Rank[]): Card[] {
  return ranks.map((rank) => card(rank));
}

/** Puts the given cards on top of the shoe, in deal order: player, dealer, player, dealer, then hits. */
function stacked(ranks: Rank[], state = createInitialState()): BlackjackState {
  const filler = Array.from({ length: RESHUFFLE_BELOW }, () => card(2, "clubs"));
  return { ...state, shoe: [...cards(...ranks), ...filler] };
}

function withUpgrades(upgrades: Partial<BlackjackState["upgrades"]>, state = createInitialState()): BlackjackState {
  return { ...state, upgrades: { ...state.upgrades, ...upgrades } };
}

function dealt(ranks: Rank[], stake = 100, state = createInitialState()): BlackjackState {
  return deal({ ...stacked(ranks, state), stake }, never);
}

describe("hand values", () => {
  it("adds pip cards and counts faces as ten", () => {
    expect(handValue(cards(2, 9))).toEqual({ total: 11, isSoft: false });
    expect(handValue(cards(11, 12, 13).slice(0, 2))).toEqual({ total: 20, isSoft: false });
    expect(handValue(cards(10, 13, 5))).toEqual({ total: 25, isSoft: false });
  });

  it("counts an ace as eleven while it does not bust the hand", () => {
    expect(handValue(cards(1, 6))).toEqual({ total: 17, isSoft: true });
    expect(handValue(cards(1, 6, 9))).toEqual({ total: 16, isSoft: false });
    expect(handValue(cards(1, 1))).toEqual({ total: 12, isSoft: true });
    expect(handValue(cards(1, 1, 9))).toEqual({ total: 21, isSoft: true });
  });

  it("recognizes a natural blackjack only on the first two cards", () => {
    expect(isBlackjack(cards(1, 13))).toBe(true);
    expect(isBlackjack(cards(10, 1))).toBe(true);
    expect(isBlackjack(cards(7, 7, 7))).toBe(false);
    expect(isBlackjack(cards(9, 1, 1))).toBe(false);
  });
});

describe("the shoe", () => {
  it("holds six complete decks", () => {
    const shoe = createShoe(seeded(1));

    expect(shoe).toHaveLength(52 * SHOE_DECKS);
    expect(shoe.filter((c) => c.rank === 1 && c.suit === "hearts")).toHaveLength(SHOE_DECKS);
  });

  it("shuffles deterministically with the injected random function", () => {
    expect(createShoe(seeded(7))).toEqual(createShoe(seeded(7)));
    expect(createShoe(seeded(7))).not.toEqual(createShoe(seeded(8)));
  });
});

describe("dealing", () => {
  it("deals two cards each in casino order and puts the stake in play", () => {
    const state = dealt([10, 9, 7, 5]);

    expect(state.player).toEqual(cards(10, 7));
    expect(state.dealer).toEqual(cards(9, 5));
    expect(state.bet).toBe(100);
    expect(state.phase).toBe("player");
    expect(state.handsDealt).toBe(1);
    expect(state.shoe).toHaveLength(RESHUFFLE_BELOW);
  });

  it("reshuffles a fresh shoe once the cut card is reached", () => {
    const state = deal({ ...createInitialState(), shoe: cards(10, 10, 10, 10), stake: 100 }, seeded(3));

    expect(state.shoe).toHaveLength(52 * SHOE_DECKS - 4);
  });

  it("refuses to deal below the minimum bet or in the middle of a hand", () => {
    const tiny = { ...stacked([10, 9, 7, 5]), stake: MIN_BET - 1 };
    const playing = dealt([10, 9, 7, 5]);

    expect(deal(tiny, never)).toBe(tiny);
    expect(deal(playing, never)).toBe(playing);
  });

  it("goes straight to the dealer when someone has a natural", () => {
    expect(dealt([1, 9, 13, 5]).phase).toBe("dealer");
    expect(dealt([9, 1, 7, 12]).phase).toBe("dealer");
  });

  it("clears the previous hand when dealing again", () => {
    const settled = finishHand(stand(dealt([10, 9, 7, 8])), never, NO_MODIFIERS).state;
    const next = deal(stacked([5, 6, 7, 8], settled), never);

    expect(next.player).toEqual(cards(5, 7));
    expect(next.outcome).toBeNull();
    expect(next.lastPayout).toBe(0);
  });
});

describe("stake", () => {
  it("stacks chips up to the table limit", () => {
    const state = addToStake(clearStake(createInitialState()), 100);

    expect(state.stake).toBe(100);
    expect(addToStake(state, 10_000).stake).toBe(tableLimit(state));
  });

  it("offers the chips of the current table", () => {
    expect(availableChips(createInitialState())).toEqual([10, 100]);
    expect(availableChips(buyTable(createInitialState()))).toEqual([10, 100, 1_000]);
  });

  it("fits the stake to the wallet in whole minimum bets", () => {
    const state = { ...createInitialState(), stake: 500 };

    expect(fitStake(state, 1_000).stake).toBe(500);
    expect(fitStake(state, 237).stake).toBe(230);
    expect(canDeal(state, 237)).toBe(true);
    expect(canDeal(state, MIN_BET - 1)).toBe(false);
  });
});

describe("the player's turn", () => {
  it("draws a card on hit", () => {
    const state = hit(dealt([5, 9, 6, 7, 4]), never);

    expect(state.player).toEqual(cards(5, 6, 4));
    expect(state.phase).toBe("player");
  });

  it("busts over 21 and hands over to the dealer", () => {
    const state = hit(dealt([10, 9, 6, 7, 8]), never);

    expect(handValue(state.player).total).toBe(24);
    expect(state.phase).toBe("dealer");
  });

  it("stands automatically on 21", () => {
    expect(hit(dealt([5, 9, 6, 7, 13]), never).phase).toBe("dealer");
  });

  it("stands whenever the player wants", () => {
    const state = stand(dealt([10, 9, 2, 7]));

    expect(state.phase).toBe("dealer");
    expect(state.player).toHaveLength(2);
  });

  it("ignores hits and stands outside the player's turn", () => {
    const betting = createInitialState();

    expect(hit(betting, never)).toBe(betting);
    expect(stand(betting)).toBe(betting);
  });

  it("lets the lucky charm blow away a card that would bust", () => {
    const lucky = withUpgrades({ charm: 2 });
    const state = hit(dealt([10, 9, 6, 7, 8, 3], 100, lucky), always);

    expect(state.player).toEqual(cards(10, 6, 3));
    expect(state.blown).toEqual(cards(8));
    expect(state.phase).toBe("player");
  });

  it("keeps the busting card when the charm does not trigger", () => {
    const lucky = withUpgrades({ charm: 2 });
    const state = hit(dealt([10, 9, 6, 7, 8, 3], 100, lucky), never);

    expect(state.player).toEqual(cards(10, 6, 8));
    expect(state.blown).toEqual([]);
  });
});

describe("the dealer's turn", () => {
  it("reveals and draws until 17", () => {
    const { state } = finishHand(stand(dealt([10, 6, 9, 5, 3, 2, 4])), never, NO_MODIFIERS);

    expect(state.dealer).toEqual(cards(6, 5, 3, 2, 4));
    expect(state.phase).toBe("settled");
  });

  it("stands on a soft 17", () => {
    const { state } = finishHand(stand(dealt([10, 1, 9, 6, 5])), never, NO_MODIFIERS);

    expect(state.dealer).toEqual(cards(1, 6));
  });

  it("draws one card at a time", () => {
    const first = dealerStep(stand(dealt([10, 6, 9, 5, 3, 2, 4])), never, NO_MODIFIERS);

    expect(first.state.dealer).toHaveLength(3);
    expect(first.state.phase).toBe("dealer");
    expect(first.earned).toBe(0);
  });

  it("does not draw when the player already busted", () => {
    const busted = hit(dealt([10, 6, 6, 5, 8, 9]), never);
    const { state } = finishHand(busted, never, NO_MODIFIERS);

    expect(state.dealer).toHaveLength(2);
    expect(state.outcome).toBe("bust");
  });

  it("draws one card too many when bribed", () => {
    const bribed = withUpgrades({ bribe: 1 });
    const { state } = finishHand(stand(dealt([10, 10, 9, 8, 5], 100, bribed)), always, NO_MODIFIERS);

    expect(state.dealer).toEqual(cards(10, 8, 5));
    expect(state.dealerFumbled).toBe(true);
    expect(state.outcome).toBe("win");
  });

  it("only fumbles once per hand", () => {
    const bribed = withUpgrades({ bribe: 5 });
    const { state } = finishHand(stand(dealt([10, 10, 9, 7, 1, 2], 100, bribed)), always, NO_MODIFIERS);

    expect(state.dealer).toEqual(cards(10, 7, 1));
  });
});

describe("payouts", () => {
  function play(ranks: Rank[], state = createInitialState(), modifiers = NO_MODIFIERS) {
    return finishHand(stand(dealt(ranks, 100, state)), never, modifiers);
  }

  it("pays twice the bet on a win", () => {
    const { state, earned } = play([10, 10, 10, 8]);

    expect(state.outcome).toBe("win");
    expect(earned).toBe(200);
    expect(state.lastPayout).toBe(200);
    expect(state.handsWon).toBe(1);
    expect(state.biggestWin).toBe(100);
  });

  it("pays twice the bet when the dealer busts", () => {
    const { state, earned } = play([10, 10, 2, 6, 10]);

    expect(state.outcome).toBe("win");
    expect(earned).toBe(200);
  });

  it("returns the bet on a push", () => {
    const { state, earned } = play([10, 10, 8, 8]);

    expect(state.outcome).toBe("push");
    expect(earned).toBe(100);
    expect(state.handsWon).toBe(0);
  });

  it("keeps the bet on a loss", () => {
    const { state, earned } = play([10, 10, 7, 9]);

    expect(state.outcome).toBe("loss");
    expect(earned).toBe(0);
  });

  it("loses a busted hand even if the dealer would have busted", () => {
    const { state, earned } = finishHand(hit(dealt([10, 10, 6, 6, 9, 10]), never), never, NO_MODIFIERS);

    expect(state.outcome).toBe("bust");
    expect(earned).toBe(0);
  });

  it("pays a natural blackjack at the rulebook rate", () => {
    const natural = play([1, 10, 13, 9]);
    const threeToTwo = play([1, 10, 13, 9], withUpgrades({ rulebook: 1 }));

    expect(natural.state.outcome).toBe("blackjack");
    expect(natural.earned).toBe(100 + 100 * BLACKJACK_PAYOUTS[0]);
    expect(threeToTwo.earned).toBe(250);
    expect(threeToTwo.state.blackjacks).toBe(1);
  });

  it("loses to a dealer blackjack and pushes two naturals", () => {
    expect(play([10, 1, 10, 13]).state.outcome).toBe("dealerBlackjack");
    expect(play([10, 1, 10, 13]).earned).toBe(0);
    expect(play([1, 1, 13, 13]).state.outcome).toBe("push");
    expect(play([1, 1, 13, 13]).earned).toBe(100);
  });

  it("turns ties into wins with the cousin", () => {
    const { state, earned } = play([10, 10, 8, 8], withUpgrades({ cousin: 1 }));

    expect(state.outcome).toBe("cousin");
    expect(earned).toBe(200);
  });

  it("adds the champagne bonus and the tap modifier to the winnings only", () => {
    const bubbly = withUpgrades({ champagne: 2 });
    const profit = 100 * (1 + 2 * CHAMPAGNE_BONUS_PER_LEVEL) * 3;

    expect(play([10, 10, 10, 8], bubbly, { production: 1, tap: 3 }).earned).toBeCloseTo(100 + profit);
    expect(play([10, 10, 8, 8], bubbly, { production: 1, tap: 3 }).earned).toBe(100);
  });
});

describe("bets through the shared wallet", () => {
  const game: GameDefinition<BlackjackState> = {
    id: "blackjack",
    name: "Test",
    genre: "simulation",
    emoji: "🃏",
    accent: "#000",
    pitch: "",
    logic,
    loadView: () => import("./view"),
  };

  function tableWith(money: number, ranks: Rank[]) {
    const storage = memoryStorage();
    const runtime = createRuntime([game], storage);
    runtime.setAllGamesUnlocked(true);
    runtime.addMoney(money);
    const session = runtime.session(game);
    session.update((state) => ({ ...stacked(ranks, state), stake: 100 }));
    return { runtime, session };
  }

  it("takes the bet from the wallet on deal and pays the winnings", () => {
    const { runtime, session } = tableWith(1_000, [10, 10, 10, 8]);

    expect(session.buy(session.state().stake, (state) => deal(state, never))).toBe(true);
    expect(runtime.wallet()).toBe(900);

    session.update(stand);
    session.earn((state) => finishHand(state, never, NO_MODIFIERS));
    expect(runtime.wallet()).toBe(1_100);
  });

  it("refuses a bet the wallet cannot cover", () => {
    const { runtime, session } = tableWith(50, [10, 10, 10, 8]);

    expect(session.buy(session.state().stake, (state) => deal(state, never))).toBe(false);
    expect(runtime.wallet()).toBe(50);
    expect(session.state().phase).toBe("betting");
  });
});

describe("the free chip", () => {
  it("is offered only when the wallet cannot cover the minimum bet", () => {
    expect(canClaimFreeChip(createInitialState(), MIN_BET - 1)).toBe(true);
    expect(canClaimFreeChip(createInitialState(), MIN_BET)).toBe(false);
  });

  it("is not offered in the middle of a hand", () => {
    expect(canClaimFreeChip(dealt([10, 9, 7, 5]), 0)).toBe(false);
  });

  it("gives a small chip to the wallet", () => {
    const { state, earned } = claimFreeChip(createInitialState());

    expect(earned).toBe(FREE_CHIP);
    expect(state.freeChips).toBe(1);
    expect(FREE_CHIP).toBeGreaterThanOrEqual(MIN_BET);
  });
});

describe("the shop", () => {
  it("raises the table limit and the auto bet with the tables", () => {
    const state = setAutoBet(createInitialState(), TABLES[0].limit);
    const next = buyTable(state);

    expect(tableLimit(next)).toBe(TABLES[1].limit);
    expect(next.autoBet).toBe(TABLES[1].limit);
  });

  it("keeps a lower auto bet the player chose", () => {
    const state = setAutoBet(createInitialState(), 100);

    expect(buyTable(state).autoBet).toBe(100);
  });

  it("stops at the last table", () => {
    const last = { ...createInitialState(), tableIndex: TABLES.length - 1 };

    expect(buyTable(last)).toBe(last);
  });

  it("clamps the auto bet to the table limit", () => {
    expect(setAutoBet(createInitialState(), 1e12).autoBet).toBe(TABLES[0].limit);
    expect(autoBetOptions(createInitialState())).toEqual([10, 100, 1_000]);
  });

  it("grows upgrade costs and caps limited upgrades", () => {
    const bribe = UPGRADES.find((upgrade) => upgrade.id === "bribe")!;
    const maxed = withUpgrades({ bribe: bribe.maxLevel });

    expect(upgradeCost(withUpgrades({ bribe: 1 }), "bribe")).toBe(bribe.baseCost * bribe.costGrowth);
    expect(canBuyUpgrade(maxed, "bribe")).toBe(false);
    expect(buyUpgrade(maxed, "bribe")).toBe(maxed);
    expect(buyUpgrade(createInitialState(), "rulebook").upgrades.rulebook).toBe(1);
  });
});

describe("expected value of the dealer-mimic automation", () => {
  const edge = withUpgrades({ rulebook: 1, bribe: 3, charm: 2 });

  it("loses about 8 % per hand at a plain table", () => {
    expect(expectedValue(createInitialState())).toBeCloseTo(-0.0793, 3);
  });

  it("loses about 5.7 % per hand with blackjack paying 3 to 2, like a real casino", () => {
    expect(expectedValue(withUpgrades({ rulebook: 1 }))).toBeCloseTo(-0.0567, 3);
  });

  it("turns positive once the edge upgrades stack up", () => {
    expect(expectedValue(edge)).toBeGreaterThan(0.01);
    expect(isAutomationProfitable(createInitialState())).toBe(false);
    expect(isAutomationProfitable(edge)).toBe(true);
  });

  it("grows with every edge upgrade", () => {
    for (const id of ["rulebook", "bribe", "charm", "cousin", "champagne"] as const) {
      expect(expectedValue(buyUpgrade(edge, id))).toBeGreaterThan(expectedValue(edge));
    }
  });

  it("matches a seeded simulation of real hands from the shoe", () => {
    const random = seeded(2026);
    let state = withUpgrades({ rulebook: 1, bribe: 2, charm: 3 }, { ...createInitialState(), stake: MIN_BET });
    let net = 0;
    const hands = 40_000;
    for (let count = 0; count < hands; count++) {
      state = deal(state, random);
      while (state.phase === "player" && handValue(state.player).total < 17) state = hit(state, random);
      const result = finishHand(stand(state), random, NO_MODIFIERS);
      state = result.state;
      net += (result.earned - MIN_BET) / MIN_BET;
    }

    expect(Math.abs(net / hands - expectedValue(state))).toBeLessThan(0.02);
  });
});

describe("automation", () => {
  const edge = withUpgrades({ rulebook: 1, bribe: 3, charm: 2 });

  it("cannot hire a regular while the house keeps the edge", () => {
    expect(canBuyUpgrade(createInitialState(), "regulars")).toBe(false);
    expect(canBuyUpgrade(edge, "regulars")).toBe(true);
  });

  it("plays hands per second with each regular", () => {
    expect(handsPerSecond(withUpgrades({ regulars: 3 }, edge))).toBe(3 * HANDS_PER_SECOND_PER_REGULAR);
  });

  it("earns the expected value of its hands at the auto bet", () => {
    const state = setAutoBet(withUpgrades({ regulars: 2 }, edge), 1_000);
    const perSecond = 2 * HANDS_PER_SECOND_PER_REGULAR * 1_000 * expectedValue(state);

    expect(incomePerSecond(state, NO_MODIFIERS)).toBeCloseTo(perSecond);
    expect(incomePerSecond(state, { production: 3, tap: 1 })).toBeCloseTo(3 * perSecond);
    expect(logic.incomePerSecond(state, NO_MODIFIERS)).toBeCloseTo(perSecond);
  });

  it("earns nothing without regulars", () => {
    expect(incomePerSecond(edge, NO_MODIFIERS)).toBe(0);
    expect(tick(edge, 60, live).earned).toBe(0);
  });

  it("earns the same deterministic income live and offline", () => {
    const state = setAutoBet(withUpgrades({ regulars: 4 }, edge), 1_000);
    const hours = 8 * 60 * 60;
    const offline = tick(state, hours, away);

    expect(offline.earned).toBeCloseTo(incomePerSecond(state, NO_MODIFIERS) * hours);
    expect(offline.earned).toBeGreaterThan(0);
    expect(tick(state, 1, live).earned).toBeCloseTo(incomePerSecond(state, NO_MODIFIERS));
    expect(offline.state.regularHands).toBeCloseTo(4 * HANDS_PER_SECOND_PER_REGULAR * hours);
  });

  it("does not touch a hand in progress", () => {
    const playing = dealt([10, 9, 7, 5], 100, withUpgrades({ regulars: 1 }, edge));
    const { state } = tick(playing, 5, live);

    expect(state.player).toEqual(playing.player);
    expect(state.phase).toBe("player");
  });
});

describe("restoreState", () => {
  it("fills every missing field with defaults", () => {
    const { state, earned } = restoreState({});

    expect(earned).toBe(0);
    expect(state).toEqual(createInitialState());
  });

  it("keeps saved progress and fills new upgrades", () => {
    const saved = { handsWon: 12, tableIndex: 2, upgrades: { bribe: 2 } } as unknown as BlackjackState;
    const { state } = restoreState(saved);

    expect(state.handsWon).toBe(12);
    expect(state.tableIndex).toBe(2);
    expect(state.upgrades.bribe).toBe(2);
    expect(state.upgrades.regulars).toBe(0);
  });

  it("clamps the table and a hand without cards", () => {
    const saved = { tableIndex: 99, phase: "player", player: [], stake: 1e15 } as unknown as BlackjackState;
    const { state } = restoreState(saved);

    expect(state.tableIndex).toBe(TABLES.length - 1);
    expect(state.phase).toBe("betting");
    expect(state.stake).toBe(TABLES.at(-1)!.limit);
  });

  it("keeps a hand in progress", () => {
    const playing = dealt([10, 9, 7, 5]);

    expect(restoreState(playing).state).toEqual(playing);
  });
});

describe("metrics", () => {
  it("reports hands won, the biggest win and the table", () => {
    const { state } = finishHand(stand(dealt([10, 10, 10, 8])), never, NO_MODIFIERS);

    expect(logic.metrics(state)).toEqual({ handsWon: 1, handsPlayed: 1, biggestWin: 100, tableLevel: 1 });
  });
});
