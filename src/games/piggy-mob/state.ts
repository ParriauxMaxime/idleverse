import {
  BOARD_SIZE,
  COST_GROWTH,
  GOONS,
  RANKS,
  REPUTATION_BONUS_PER_CONTRACT,
  ROUTINE_BRIEFS,
  ROUTINE_GROWTH,
  STORY_CONTRACTS,
  TIERS,
  TOOLS,
  type Contract,
  type Goon,
  type GoonId,
  type Rank,
  type Tier,
  type Tool,
} from "./config";
import type { Earning, Modifiers, TickContext } from "../types";

export interface ActiveContract {
  id: number;
  progress: number;
}

export interface PiggyState {
  unlockedTiers: number;
  tierIndex: number;
  damage: number;
  hits: number;
  toolLevel: number;
  goons: Record<GoonId, number>;
  board: ActiveContract[];
  nextContract: number;
  contractsCompleted: number;
  broken: number;
  looted: number;
}

const LAST_TIER = TIERS.length - 1;

function roundToTwoDigits(value: number): number {
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

export function contractAt(id: number): Contract {
  if (id < STORY_CONTRACTS.length) return STORY_CONTRACTS[id];

  const routine = id - STORY_CONTRACTS.length;
  const growth = ROUTINE_GROWTH ** Math.floor(routine / 2);
  const brief = ROUTINE_BRIEFS[routine % ROUTINE_BRIEFS.length];
  const top = TIERS[LAST_TIER];
  if (routine % 2 === 0) {
    const count = Math.ceil(5 * growth);
    return { goal: { kind: "break", tier: LAST_TIER, count }, reward: roundToTwoDigits(count * top.payout * 2), brief };
  }
  const amount = roundToTwoDigits(top.payout * 100 * growth);
  return { goal: { kind: "loot", amount }, reward: roundToTwoDigits(amount * 0.4), brief };
}

function freshContract(id: number): ActiveContract {
  return { id, progress: 0 };
}

export function createInitialState(): PiggyState {
  return {
    unlockedTiers: 1,
    tierIndex: 0,
    damage: 0,
    hits: 0,
    toolLevel: 0,
    goons: { punk: 0, muscle: 0, safecracker: 0, movers: 0, cousins: 0 },
    board: Array.from({ length: BOARD_SIZE }, (_, id) => freshContract(id)),
    nextContract: BOARD_SIZE,
    contractsCompleted: 0,
    broken: 0,
    looted: 0,
  };
}

export function currentTier(state: PiggyState): Tier {
  return TIERS[state.tierIndex];
}

/** Share of the current bank still standing, from 1 (intact) down to 0. */
export function integrity(state: PiggyState): number {
  return 1 - state.damage / currentTier(state).hp;
}

export function reputationMultiplier(state: PiggyState): number {
  return 1 + state.contractsCompleted * REPUTATION_BONUS_PER_CONTRACT;
}

export function rank(state: PiggyState): Rank {
  return RANKS.filter((r) => state.contractsCompleted >= r.contracts).at(-1)!;
}

export function nextRank(state: PiggyState): Rank | undefined {
  return RANKS.find((r) => state.contractsCompleted < r.contracts);
}

export function payout(state: PiggyState, tierIndex = state.tierIndex): number {
  return TIERS[tierIndex].payout * reputationMultiplier(state);
}

export function tapDamage(state: PiggyState, modifiers: Modifiers): number {
  return TOOLS[state.toolLevel].damage * modifiers.tap;
}

export function goonCount(state: PiggyState): number {
  return GOONS.reduce((total, goon) => total + state.goons[goon.id], 0);
}

export function damagePerSecond(state: PiggyState, modifiers: Modifiers): number {
  const base = GOONS.reduce((total, goon) => total + goon.damagePerSecond * state.goons[goon.id], 0);
  return base * modifiers.production;
}

export function incomePerSecond(state: PiggyState, modifiers: Modifiers): number {
  return (damagePerSecond(state, modifiers) / currentTier(state).hp) * payout(state);
}

export function availableGoons(state: PiggyState): Goon[] {
  return GOONS.filter((goon) => goon.unlockTier < state.unlockedTiers);
}

export function goonCost(state: PiggyState, id: GoonId): number {
  const goon = GOONS.find((g) => g.id === id)!;
  return Math.ceil(goon.baseCost * COST_GROWTH ** state.goons[id]);
}

export function hireGoon(state: PiggyState, id: GoonId): PiggyState {
  return { ...state, goons: { ...state.goons, [id]: state.goons[id] + 1 } };
}

export function nextTool(state: PiggyState): Tool | undefined {
  return TOOLS[state.toolLevel + 1];
}

export function buyNextTool(state: PiggyState): PiggyState {
  if (!nextTool(state)) return state;
  return { ...state, toolLevel: state.toolLevel + 1 };
}

export function selectTier(state: PiggyState, tierIndex: number): PiggyState {
  if (tierIndex === state.tierIndex || tierIndex < 0 || tierIndex >= state.unlockedTiers) return state;
  return { ...state, tierIndex, damage: 0, hits: 0 };
}

export function contractTarget(contract: Contract): number {
  const { goal } = contract;
  switch (goal.kind) {
    case "break":
      return goal.count;
    case "loot":
      return goal.amount;
    case "hire":
      return goal.count;
    case "tool":
      return goal.level;
    case "quick":
      return 1;
  }
}

export function contractProgress(state: PiggyState, active: ActiveContract): number {
  const contract = contractAt(active.id);
  const progress =
    contract.goal.kind === "hire" ? goonCount(state) : contract.goal.kind === "tool" ? state.toolLevel : active.progress;
  return Math.min(progress, contractTarget(contract));
}

export function isContractDone(state: PiggyState, active: ActiveContract): boolean {
  return contractProgress(state, active) >= contractTarget(contractAt(active.id));
}

interface BreakEvent {
  tierIndex: number;
  breaks: number;
  loot: number;
  quickHits: number | null;
}

function recordBreaks(board: ActiveContract[], event: BreakEvent): ActiveContract[] {
  return board.map((active) => {
    const { goal } = contractAt(active.id);
    if (goal.kind === "break" && goal.tier === event.tierIndex) {
      return { ...active, progress: Math.min(goal.count, active.progress + event.breaks) };
    }
    if (goal.kind === "loot") {
      return { ...active, progress: Math.min(goal.amount, active.progress + event.loot) };
    }
    if (goal.kind === "quick" && goal.tier === event.tierIndex && event.quickHits !== null && event.quickHits <= goal.maxHits) {
      return { ...active, progress: 1 };
    }
    return active;
  });
}

function dealDamage(state: PiggyState, amount: number, taps: number): Earning<PiggyState> {
  const { hp } = currentTier(state);
  const remaining = hp - state.damage;
  if (amount < remaining) {
    return { state: { ...state, damage: state.damage + amount, hits: state.hits + taps }, earned: 0 };
  }

  const overflow = amount - remaining;
  const breaks = 1 + Math.floor(overflow / hp);
  const earned = breaks * payout(state);
  const board = recordBreaks(state.board, {
    tierIndex: state.tierIndex,
    breaks,
    loot: earned,
    quickHits: taps > 0 ? state.hits + taps : null,
  });
  return {
    state: {
      ...state,
      damage: overflow - (breaks - 1) * hp,
      hits: 0,
      board,
      broken: state.broken + breaks,
      looted: state.looted + earned,
    },
    earned,
  };
}

export function smash(state: PiggyState, modifiers: Modifiers): Earning<PiggyState> {
  return dealDamage(state, tapDamage(state, modifiers), 1);
}

export function tick(state: PiggyState, seconds: number, { modifiers }: TickContext): Earning<PiggyState> {
  const damage = damagePerSecond(state, modifiers) * seconds;
  if (damage <= 0) return { state, earned: 0 };
  return dealDamage(state, damage, 0);
}

export function claimContract(state: PiggyState, slot: number): Earning<PiggyState> {
  const active = state.board[slot];
  if (!active || !isContractDone(state, active)) return { state, earned: 0 };

  const contract = contractAt(active.id);
  const unlockedTiers = Math.max(state.unlockedTiers, (contract.unlocksTier ?? -1) + 1);
  const board = state.board.map((entry, index) => (index === slot ? freshContract(state.nextContract) : entry));
  const next: PiggyState = {
    ...state,
    unlockedTiers,
    board,
    nextContract: state.nextContract + 1,
    contractsCompleted: state.contractsCompleted + 1,
  };
  const withNewTier = contract.unlocksTier === undefined ? next : selectTier(next, contract.unlocksTier);
  return { state: withNewTier, earned: contract.reward };
}

export function restoreState(saved: Partial<PiggyState>): Earning<PiggyState> {
  const initial = createInitialState();
  const goons = Object.fromEntries(GOONS.map(({ id }) => [id, saved.goons?.[id] ?? 0])) as PiggyState["goons"];
  const unlockedTiers = Math.min(TIERS.length, Math.max(1, saved.unlockedTiers ?? initial.unlockedTiers));
  const tierIndex = Math.min(unlockedTiers - 1, Math.max(0, saved.tierIndex ?? initial.tierIndex));
  const damage = saved.damage ?? initial.damage;
  const state: PiggyState = {
    unlockedTiers,
    tierIndex,
    damage: damage < TIERS[tierIndex].hp ? damage : 0,
    hits: saved.hits ?? initial.hits,
    toolLevel: Math.min(TOOLS.length - 1, saved.toolLevel ?? initial.toolLevel),
    goons,
    board: saved.board?.length ? saved.board : initial.board,
    nextContract: saved.nextContract ?? initial.nextContract,
    contractsCompleted: saved.contractsCompleted ?? initial.contractsCompleted,
    broken: saved.broken ?? initial.broken,
    looted: saved.looted ?? initial.looted,
  };
  return { state, earned: 0 };
}

export function metrics(state: PiggyState) {
  return {
    contractsCompleted: state.contractsCompleted,
    tiersUnlocked: state.unlockedTiers,
    banksBroken: state.broken,
  };
}
