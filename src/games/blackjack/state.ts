import type { Earning, Modifiers, TickContext } from "../types";
import {
  BLACKJACK,
  BLACKJACK_PAYOUTS,
  BRIBE_CHANCE_PER_LEVEL,
  CHAMPAGNE_BONUS_PER_LEVEL,
  CHARM_CHANCE_PER_LEVEL,
  CHIP_VALUES,
  DEALER_STANDS_ON,
  FREE_CHIP,
  HANDS_PER_SECOND_PER_REGULAR,
  MIN_BET,
  RANKS,
  RESHUFFLE_BELOW,
  SHOE_DECKS,
  SUITS,
  TABLES,
  UPGRADES,
  type Rank,
  type Suit,
  type Table,
  type UpgradeDefinition,
  type UpgradeId,
} from "./config";
import { expectedReturn, type HouseRules } from "./odds";

export type Random = () => number;

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** betting: nothing dealt yet · player: hit or stand · dealer: the bank plays and settles · settled: hand over. */
export type Phase = "betting" | "player" | "dealer" | "settled";

export type Outcome = "blackjack" | "win" | "cousin" | "push" | "loss" | "bust" | "dealerBlackjack";

export interface BlackjackState {
  shoe: Card[];
  phase: Phase;
  player: Card[];
  dealer: Card[];
  /** Cards the lucky charm blew away during the current hand. */
  blown: Card[];
  dealerFumbled: boolean;
  /** Bet chosen for the next hand. */
  stake: number;
  /** Bet in play, already paid from the wallet. */
  bet: number;
  outcome: Outcome | null;
  lastPayout: number;
  tableIndex: number;
  upgrades: Record<UpgradeId, number>;
  autoBet: number;
  handsDealt: number;
  handsWon: number;
  blackjacks: number;
  biggestWin: number;
  regularHands: number;
  freeChips: number;
}

export function createInitialState(): BlackjackState {
  return {
    shoe: [],
    phase: "betting",
    player: [],
    dealer: [],
    blown: [],
    dealerFumbled: false,
    stake: 100,
    bet: 0,
    outcome: null,
    lastPayout: 0,
    tableIndex: 0,
    upgrades: { rulebook: 0, bribe: 0, charm: 0, cousin: 0, champagne: 0, regulars: 0 },
    autoBet: TABLES[0].limit,
    handsDealt: 0,
    handsWon: 0,
    blackjacks: 0,
    biggestWin: 0,
    regularHands: 0,
    freeChips: 0,
  };
}

// Cards and hands

export function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

export function handValue(cards: Card[]): { total: number; isSoft: boolean } {
  const hard = cards.reduce((sum, card) => sum + cardValue(card), 0);
  const isSoft = cards.some((card) => card.rank === 1) && hard + 10 <= BLACKJACK;
  return { total: isSoft ? hard + 10 : hard, isSoft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === BLACKJACK;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > BLACKJACK;
}

export function createShoe(random: Random): Card[] {
  const shoe: Card[] = [];
  for (let deck = 0; deck < SHOE_DECKS; deck++) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  }
  for (let index = shoe.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shoe[index], shoe[other]] = [shoe[other], shoe[index]];
  }
  return shoe;
}

function draw(shoe: Card[], random: Random): { card: Card; shoe: Card[] } {
  const source = shoe.length > 0 ? shoe : createShoe(random);
  return { card: source[0], shoe: source.slice(1) };
}

// Tables and stakes

export function currentTable(state: BlackjackState): Table {
  return TABLES[state.tableIndex];
}

export function nextTable(state: BlackjackState): Table | undefined {
  return TABLES[state.tableIndex + 1];
}

export function tableLimit(state: BlackjackState): number {
  return currentTable(state).limit;
}

export function availableChips(state: BlackjackState): number[] {
  return CHIP_VALUES.filter((value) => value < tableLimit(state));
}

export function isBetting(state: BlackjackState): boolean {
  return state.phase === "betting" || state.phase === "settled";
}

export function addToStake(state: BlackjackState, amount: number): BlackjackState {
  if (!isBetting(state)) return state;
  return { ...state, stake: Math.min(tableLimit(state), state.stake + amount) };
}

export function clearStake(state: BlackjackState): BlackjackState {
  if (!isBetting(state)) return state;
  return { ...state, stake: 0 };
}

export function setStake(state: BlackjackState, amount: number): BlackjackState {
  if (!isBetting(state)) return state;
  return { ...state, stake: Math.max(0, Math.min(tableLimit(state), amount)) };
}

/** Lowers the stake to what the wallet can pay, in whole minimum bets. */
export function fitStake(state: BlackjackState, wallet: number): BlackjackState {
  if (state.stake <= wallet) return state;
  return { ...state, stake: Math.floor(wallet / MIN_BET) * MIN_BET };
}

export function canDeal(state: BlackjackState, wallet: number): boolean {
  return isBetting(state) && fitStake(state, wallet).stake >= MIN_BET;
}

// House rules and cheats

export function blackjackPays(state: BlackjackState): number {
  return BLACKJACK_PAYOUTS[state.upgrades.rulebook];
}

export function bribeChance(state: BlackjackState): number {
  return state.upgrades.bribe * BRIBE_CHANCE_PER_LEVEL;
}

export function charmChance(state: BlackjackState): number {
  return state.upgrades.charm * CHARM_CHANCE_PER_LEVEL;
}

export function winMultiplier(state: BlackjackState): number {
  return 1 + state.upgrades.champagne * CHAMPAGNE_BONUS_PER_LEVEL;
}

export function houseRules(state: BlackjackState): HouseRules {
  return {
    blackjackPays: blackjackPays(state),
    bribeChance: bribeChance(state),
    charmChance: charmChance(state),
    tiesWin: state.upgrades.cousin > 0,
    winMultiplier: winMultiplier(state),
  };
}

/** Net money per unit bet of a hand played like the dealer: negative means the house keeps the edge. */
export function expectedValue(state: BlackjackState): number {
  return expectedReturn(houseRules(state));
}

export function isAutomationProfitable(state: BlackjackState): boolean {
  return expectedValue(state) > 0;
}

// The hand

export function deal(state: BlackjackState, random: Random): BlackjackState {
  if (!isBetting(state) || state.stake < MIN_BET) return state;

  let shoe = state.shoe.length < RESHUFFLE_BELOW ? createShoe(random) : state.shoe;
  const dealt: Card[] = [];
  for (let count = 0; count < 4; count++) {
    const next = draw(shoe, random);
    dealt.push(next.card);
    shoe = next.shoe;
  }
  const player = [dealt[0], dealt[2]];
  const dealer = [dealt[1], dealt[3]];
  const hasNatural = isBlackjack(player) || isBlackjack(dealer);
  return {
    ...state,
    shoe,
    phase: hasNatural ? "dealer" : "player",
    player,
    dealer,
    blown: [],
    dealerFumbled: false,
    bet: state.stake,
    outcome: null,
    lastPayout: 0,
    handsDealt: state.handsDealt + 1,
  };
}

export function hit(state: BlackjackState, random: Random): BlackjackState {
  if (state.phase !== "player") return state;

  let { card, shoe } = draw(state.shoe, random);
  let blown = state.blown;
  if (isBust([...state.player, card]) && random() < charmChance(state)) {
    blown = [...blown, card];
    ({ card, shoe } = draw(shoe, random));
  }
  const player = [...state.player, card];
  const isDone = handValue(player).total >= BLACKJACK;
  return { ...state, shoe, player, blown, phase: isDone ? "dealer" : "player" };
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.phase !== "player") return state;
  return { ...state, phase: "dealer" };
}

function isPlayerDone(state: BlackjackState): boolean {
  return isBust(state.player) || isBlackjack(state.player) || isBlackjack(state.dealer);
}

function outcomeOf(state: BlackjackState): Outcome {
  const player = handValue(state.player).total;
  const dealer = handValue(state.dealer).total;
  if (isBlackjack(state.player)) return isBlackjack(state.dealer) ? "push" : "blackjack";
  if (isBlackjack(state.dealer)) return "dealerBlackjack";
  if (player > BLACKJACK) return "bust";
  if (dealer > BLACKJACK || player > dealer) return "win";
  if (player === dealer) return state.upgrades.cousin > 0 ? "cousin" : "push";
  return "loss";
}

function payoutFor(state: BlackjackState, outcome: Outcome, modifiers: Modifiers): number {
  const profit = winMultiplier(state) * modifiers.tap * state.bet;
  switch (outcome) {
    case "blackjack":
      return state.bet + profit * blackjackPays(state);
    case "win":
    case "cousin":
      return state.bet + profit;
    case "push":
      return state.bet;
    default:
      return 0;
  }
}

function settle(state: BlackjackState, modifiers: Modifiers): Earning<BlackjackState> {
  const outcome = outcomeOf(state);
  const payout = payoutFor(state, outcome, modifiers);
  const profit = payout - state.bet;
  return {
    state: {
      ...state,
      phase: "settled",
      outcome,
      lastPayout: payout,
      handsWon: state.handsWon + (profit > 0 ? 1 : 0),
      blackjacks: state.blackjacks + (outcome === "blackjack" ? 1 : 0),
      biggestWin: Math.max(state.biggestWin, profit),
    },
    earned: payout,
  };
}

/** Plays one move of the bank: draws a card, or settles the hand and pays the winnings. */
export function dealerStep(state: BlackjackState, random: Random, modifiers: Modifiers): Earning<BlackjackState> {
  if (state.phase !== "dealer") return { state, earned: 0 };
  if (isPlayerDone(state)) return settle(state, modifiers);

  const total = handValue(state.dealer).total;
  const mustDraw = total < DEALER_STANDS_ON;
  const fumbles = !mustDraw && !state.dealerFumbled && total <= BLACKJACK && random() < bribeChance(state);
  if (!mustDraw && !fumbles) return settle(state, modifiers);

  const { card, shoe } = draw(state.shoe, random);
  return {
    state: { ...state, shoe, dealer: [...state.dealer, card], dealerFumbled: state.dealerFumbled || fumbles },
    earned: 0,
  };
}

export function finishHand(state: BlackjackState, random: Random, modifiers: Modifiers): Earning<BlackjackState> {
  let earned = 0;
  while (state.phase === "dealer") {
    const step = dealerStep(state, random, modifiers);
    state = step.state;
    earned += step.earned;
  }
  return { state, earned };
}

// The free chip

export function canClaimFreeChip(state: BlackjackState, wallet: number): boolean {
  return isBetting(state) && wallet < MIN_BET;
}

export function claimFreeChip(state: BlackjackState): Earning<BlackjackState> {
  return { state: { ...state, freeChips: state.freeChips + 1 }, earned: FREE_CHIP };
}

// Shop

function upgradeDefinition(id: UpgradeId): UpgradeDefinition {
  return UPGRADES.find((upgrade) => upgrade.id === id)!;
}

export function upgradeCost(state: BlackjackState, id: UpgradeId): number {
  const upgrade = upgradeDefinition(id);
  return Math.ceil(upgrade.baseCost * upgrade.costGrowth ** state.upgrades[id]);
}

export function isMaxed(state: BlackjackState, id: UpgradeId): boolean {
  const { maxLevel = Infinity } = upgradeDefinition(id);
  return state.upgrades[id] >= maxLevel;
}

export function canBuyUpgrade(state: BlackjackState, id: UpgradeId): boolean {
  if (id === "regulars" && !isAutomationProfitable(state)) return false;
  return !isMaxed(state, id);
}

export function buyUpgrade(state: BlackjackState, id: UpgradeId): BlackjackState {
  if (isMaxed(state, id)) return state;
  return { ...state, upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 } };
}

export function buyTable(state: BlackjackState): BlackjackState {
  const next = nextTable(state);
  if (!next) return state;
  const followsLimit = state.autoBet >= tableLimit(state);
  return { ...state, tableIndex: state.tableIndex + 1, autoBet: followsLimit ? next.limit : state.autoBet };
}

// Automation

export function autoBetOptions(state: BlackjackState): number[] {
  return [...availableChips(state), tableLimit(state)];
}

export function setAutoBet(state: BlackjackState, amount: number): BlackjackState {
  return { ...state, autoBet: Math.max(MIN_BET, Math.min(tableLimit(state), amount)) };
}

export function handsPerSecond(state: BlackjackState): number {
  return state.upgrades.regulars * HANDS_PER_SECOND_PER_REGULAR;
}

export function incomePerSecond(state: BlackjackState, modifiers: Modifiers): number {
  const edge = expectedValue(state);
  if (edge <= 0) return 0;
  return handsPerSecond(state) * state.autoBet * edge * modifiers.production;
}

export function tick(state: BlackjackState, seconds: number, { modifiers }: TickContext): Earning<BlackjackState> {
  const hands = handsPerSecond(state) * seconds;
  if (hands <= 0) return { state, earned: 0 };
  return {
    state: { ...state, regularHands: state.regularHands + hands },
    earned: incomePerSecond(state, modifiers) * seconds,
  };
}

// Saves

export function restoreState(saved: Partial<BlackjackState>): Earning<BlackjackState> {
  const initial = createInitialState();
  const upgrades = Object.fromEntries(
    UPGRADES.map(({ id, maxLevel = Infinity }) => [id, Math.min(maxLevel, saved.upgrades?.[id] ?? 0)]),
  ) as BlackjackState["upgrades"];
  const tableIndex = Math.max(0, Math.min(TABLES.length - 1, saved.tableIndex ?? initial.tableIndex));
  const limit = TABLES[tableIndex].limit;
  const player = saved.player ?? initial.player;
  const dealer = saved.dealer ?? initial.dealer;
  const hasHand = player.length >= 2 && dealer.length >= 2;
  const phase = hasHand ? (saved.phase ?? initial.phase) : initial.phase;

  const state: BlackjackState = {
    shoe: saved.shoe ?? initial.shoe,
    phase,
    player: hasHand ? player : [],
    dealer: hasHand ? dealer : [],
    blown: saved.blown ?? initial.blown,
    dealerFumbled: saved.dealerFumbled ?? initial.dealerFumbled,
    stake: Math.min(limit, saved.stake ?? initial.stake),
    bet: saved.bet ?? initial.bet,
    outcome: saved.outcome ?? initial.outcome,
    lastPayout: saved.lastPayout ?? initial.lastPayout,
    tableIndex,
    upgrades,
    autoBet: Math.max(MIN_BET, Math.min(limit, saved.autoBet ?? initial.autoBet)),
    handsDealt: saved.handsDealt ?? initial.handsDealt,
    handsWon: saved.handsWon ?? initial.handsWon,
    blackjacks: saved.blackjacks ?? initial.blackjacks,
    biggestWin: saved.biggestWin ?? initial.biggestWin,
    regularHands: saved.regularHands ?? initial.regularHands,
    freeChips: saved.freeChips ?? initial.freeChips,
  };
  return { state, earned: 0 };
}

export function metrics(state: BlackjackState) {
  return {
    handsWon: state.handsWon,
    handsPlayed: state.handsDealt,
    biggestWin: state.biggestWin,
    tableLevel: state.tableIndex + 1,
  };
}
