import type { Earning, Modifiers, TickContext } from "../types";
import {
  AUTO_PUSHES_PER_LEVEL,
  BASE_TAP_KILOGRAMS,
  COACH_SINK_MULTIPLIER,
  MAGNESIA_PAYOUT_MULTIPLIER,
  MAX_LIVE_TICK_SECONDS,
  PROTEIN_STRENGTH_BONUS,
  SINK_GRACE_SECONDS,
  SINK_PER_SECOND,
  TRAINING_STRENGTH_MULTIPLIER,
  UPGRADES,
  WEIGHTS,
  type UpgradeDefinition,
  type UpgradeId,
  type Weight,
} from "./config";

export interface StrongmanState {
  /** Share of the current lift already done: 0 is the bar on the floor, 1 is overhead. */
  lift: number;
  secondsSinceTap: number;
  weightIndex: number;
  upgrades: Record<UpgradeId, number>;
  liftsCompleted: number;
}

export function createInitialState(): StrongmanState {
  return {
    lift: 0,
    secondsSinceTap: 0,
    weightIndex: 0,
    upgrades: { protein: 0, training: 0, coach: 0, magnesia: 0, autoLift: 0 },
    liftsCompleted: 0,
  };
}

export function currentWeight(state: StrongmanState): Weight {
  return WEIGHTS[state.weightIndex];
}

export function nextWeight(state: StrongmanState): Weight | undefined {
  return WEIGHTS[state.weightIndex + 1];
}

function upgradeDefinition(id: UpgradeId): UpgradeDefinition {
  return UPGRADES.find((upgrade) => upgrade.id === id)!;
}

function strength(state: StrongmanState): number {
  const { protein, training } = state.upgrades;
  return BASE_TAP_KILOGRAMS * (1 + PROTEIN_STRENGTH_BONUS * protein) * TRAINING_STRENGTH_MULTIPLIER ** training;
}

export function tapKilograms(state: StrongmanState, modifiers: Modifiers): number {
  return strength(state) * modifiers.tap;
}

export function tapsPerLift(state: StrongmanState, modifiers: Modifiers): number {
  return Math.ceil(currentWeight(state).kilograms / tapKilograms(state, modifiers));
}

export function isAutomated(state: StrongmanState): boolean {
  return state.upgrades.autoLift > 0;
}

export function autoKilogramsPerSecond(state: StrongmanState, modifiers: Modifiers): number {
  return state.upgrades.autoLift * AUTO_PUSHES_PER_LEVEL * strength(state) * modifiers.production;
}

export function liftPayout(state: StrongmanState): number {
  return currentWeight(state).payout * MAGNESIA_PAYOUT_MULTIPLIER ** state.upgrades.magnesia;
}

export function sinkPerSecond(state: StrongmanState): number {
  return SINK_PER_SECOND * COACH_SINK_MULTIPLIER ** state.upgrades.coach;
}

export function incomePerSecond(state: StrongmanState, modifiers: Modifiers): number {
  return (autoKilogramsPerSecond(state, modifiers) / currentWeight(state).kilograms) * liftPayout(state);
}

function push(state: StrongmanState, kilograms: number): Earning<StrongmanState> {
  const lift = state.lift + kilograms / currentWeight(state).kilograms;
  const lifts = Math.floor(lift);
  return {
    state: { ...state, lift: lift - lifts, liftsCompleted: state.liftsCompleted + lifts },
    earned: lifts * liftPayout(state),
  };
}

export function tap(state: StrongmanState, modifiers: Modifiers): Earning<StrongmanState> {
  return push({ ...state, secondsSinceTap: 0 }, tapKilograms(state, modifiers));
}

function sink(state: StrongmanState, seconds: number): StrongmanState {
  const secondsSinceTap = state.secondsSinceTap + seconds;
  if (isAutomated(state)) return { ...state, secondsSinceTap };

  const sinkingSeconds = Math.min(seconds, Math.max(0, secondsSinceTap - SINK_GRACE_SECONDS));
  const lift = Math.max(0, state.lift - sinkPerSecond(state) * sinkingSeconds);
  return { ...state, lift, secondsSinceTap };
}

export function tick(
  state: StrongmanState,
  seconds: number,
  { modifiers, isFocused }: TickContext,
): Earning<StrongmanState> {
  const pushed = push(state, autoKilogramsPerSecond(state, modifiers) * seconds);
  const isLive = isFocused && seconds <= MAX_LIVE_TICK_SECONDS;
  return isLive ? { ...pushed, state: sink(pushed.state, seconds) } : pushed;
}

export function buyWeight(state: StrongmanState): StrongmanState {
  if (!nextWeight(state)) return state;
  return { ...state, weightIndex: state.weightIndex + 1, lift: 0 };
}

export function upgradeCost(state: StrongmanState, id: UpgradeId): number {
  const upgrade = upgradeDefinition(id);
  return Math.ceil(upgrade.baseCost * upgrade.costGrowth ** state.upgrades[id]);
}

export function canBuyUpgrade(state: StrongmanState, id: UpgradeId): boolean {
  const { maxLevel = Infinity } = upgradeDefinition(id);
  return state.upgrades[id] < maxLevel;
}

export function buyUpgrade(state: StrongmanState, id: UpgradeId): StrongmanState {
  if (!canBuyUpgrade(state, id)) return state;
  return { ...state, upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 } };
}

export function restoreState(saved: Partial<StrongmanState>): Earning<StrongmanState> {
  const initial = createInitialState();
  const upgrades = Object.fromEntries(UPGRADES.map(({ id }) => [id, saved.upgrades?.[id] ?? initial.upgrades[id]]));
  const state: StrongmanState = {
    lift: saved.lift ?? initial.lift,
    secondsSinceTap: saved.secondsSinceTap ?? initial.secondsSinceTap,
    weightIndex: Math.min(saved.weightIndex ?? initial.weightIndex, WEIGHTS.length - 1),
    upgrades: upgrades as StrongmanState["upgrades"],
    liftsCompleted: saved.liftsCompleted ?? initial.liftsCompleted,
  };
  return { state, earned: 0 };
}
