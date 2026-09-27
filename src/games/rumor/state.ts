import {
  BASE_SPREAD_RATE,
  BASE_TAP_POWER,
  COST_GROWTH,
  DEBUNK,
  DOLLARS_PER_BELIEVER_PER_SECOND,
  DOLLARS_PER_WHISPERED_BELIEVER,
  DEBUNK_MESSAGES,
  LEVEL_UP_THRESHOLD,
  MAX_LIVE_TICK_SECONDS,
  SCOPES,
  UPGRADES,
  type UpgradeId,
} from "./config";
import type { Earning, Modifiers, TickContext } from "../types";

export type Random = () => number;

export interface Debunk {
  messageIndex: number;
  secondsLeft: number;
}

export interface RumorState {
  believers: number;
  scopeIndex: number;
  upgrades: Record<UpgradeId, number>;
  debunk: Debunk | null;
  secondsUntilDebunk: number;
}

export function createInitialState(): RumorState {
  return {
    believers: 0,
    scopeIndex: 0,
    upgrades: { whatsapp: 0, anonymous: 0, meme: 0, influencer: 0, youtube: 0 },
    debunk: null,
    secondsUntilDebunk: DEBUNK.firstDelaySeconds,
  };
}

export function population(state: RumorState): number {
  return SCOPES[state.scopeIndex].population;
}

export function tapPower(state: RumorState, modifiers: Modifiers): number {
  const base = UPGRADES.reduce((total, u) => total + u.tapPower * state.upgrades[u.id], BASE_TAP_POWER);
  return base * modifiers.tap;
}

export function spreadRate(state: RumorState, modifiers: Modifiers): number {
  const base = UPGRADES.reduce((total, u) => total + u.spreadRate * state.upgrades[u.id], BASE_SPREAD_RATE);
  return base * modifiers.production;
}

export function spreadPerSecond(state: RumorState, modifiers: Modifiers): number {
  return spreadRate(state, modifiers) * state.believers * (1 - state.believers / population(state));
}

export function upgradeCost(state: RumorState, id: UpgradeId): number {
  const upgrade = UPGRADES.find((u) => u.id === id)!;
  return Math.ceil(upgrade.baseCost * COST_GROWTH ** state.upgrades[id]);
}

export function incomePerSecond(state: RumorState, modifiers: Modifiers): number {
  return state.believers * DOLLARS_PER_BELIEVER_PER_SECOND * modifiers.production;
}

export function whisperEarning(state: RumorState, modifiers: Modifiers): number {
  return tapPower(state, modifiers) * DOLLARS_PER_WHISPERED_BELIEVER;
}

export function whisper(state: RumorState, modifiers: Modifiers): Earning<RumorState> {
  const believers = Math.min(population(state), state.believers + tapPower(state, modifiers));
  return { state: { ...state, believers }, earned: whisperEarning(state, modifiers) };
}

export function buyUpgrade(state: RumorState, id: UpgradeId): RumorState {
  return { ...state, upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 } };
}

export function isLastScope(state: RumorState): boolean {
  return state.scopeIndex === SCOPES.length - 1;
}

export function canLevelUp(state: RumorState): boolean {
  return !isLastScope(state) && state.believers >= population(state) * LEVEL_UP_THRESHOLD;
}

export function levelUp(state: RumorState): RumorState {
  if (!canLevelUp(state)) return state;
  return { ...state, scopeIndex: state.scopeIndex + 1 };
}

export function spread(state: RumorState, seconds: number, modifiers: Modifiers): RumorState {
  const cap = population(state);
  if (state.believers <= 0 || state.believers >= cap) return state;

  const rate = spreadRate(state, modifiers);
  const believers = cap / (1 + (cap / state.believers - 1) * Math.exp(-rate * seconds));
  return { ...state, believers: cap - believers < 1 ? cap : believers };
}

/** Exact integral of the logistic curve followed by `spread`, so long offline gaps pay what the believers produced. */
export function believerSeconds(state: RumorState, seconds: number, modifiers: Modifiers): number {
  const cap = population(state);
  if (state.believers <= 0) return 0;
  if (state.believers >= cap) return state.believers * seconds;

  const rate = spreadRate(state, modifiers);
  const unconvinced = cap / state.believers - 1;
  return cap * seconds + (cap / rate) * (Math.log1p(unconvinced * Math.exp(-rate * seconds)) - Math.log1p(unconvinced));
}

function nextDebunkDelay(random: Random): number {
  return DEBUNK.minDelaySeconds + random() * (DEBUNK.maxDelaySeconds - DEBUNK.minDelaySeconds);
}

function advanceDebunk(state: RumorState, seconds: number, random: Random): RumorState {
  if (state.debunk) {
    const secondsLeft = state.debunk.secondsLeft - seconds;
    if (secondsLeft > 0) return { ...state, debunk: { ...state.debunk, secondsLeft } };

    return {
      ...state,
      believers: state.believers * (1 - DEBUNK.penalty),
      debunk: null,
      secondsUntilDebunk: nextDebunkDelay(random),
    };
  }

  if (state.believers < DEBUNK.minBelievers) return state;

  const secondsUntilDebunk = state.secondsUntilDebunk - seconds;
  if (secondsUntilDebunk > 0) return { ...state, secondsUntilDebunk };

  return {
    ...state,
    secondsUntilDebunk: 0,
    debunk: {
      messageIndex: Math.floor(random() * DEBUNK_MESSAGES.length),
      secondsLeft: DEBUNK.durationSeconds,
    },
  };
}

export function crushDebunk(state: RumorState, random: Random): RumorState {
  if (!state.debunk) return state;
  return { ...state, debunk: null, secondsUntilDebunk: nextDebunkDelay(random) };
}

export function applyOfflineProgress(state: RumorState, seconds: number, modifiers: Modifiers): RumorState {
  return {
    ...spread(state, seconds, modifiers),
    debunk: null,
    secondsUntilDebunk: Math.max(state.secondsUntilDebunk, DEBUNK.minDelaySeconds),
  };
}

export function tick(
  state: RumorState,
  seconds: number,
  { modifiers, isFocused }: TickContext,
  random: Random,
): Earning<RumorState> {
  const earned = believerSeconds(state, seconds, modifiers) * DOLLARS_PER_BELIEVER_PER_SECOND * modifiers.production;
  const next =
    !isFocused || seconds > MAX_LIVE_TICK_SECONDS
      ? applyOfflineProgress(state, seconds, modifiers)
      : advanceDebunk(spread(state, seconds, modifiers), seconds, random);
  return { state: next, earned };
}

export function restoreState(saved: Partial<RumorState>): Earning<RumorState> {
  const initial = createInitialState();
  const upgrades = Object.fromEntries(UPGRADES.map(({ id }) => [id, saved.upgrades?.[id] ?? initial.upgrades[id]]));
  const state: RumorState = {
    believers: saved.believers ?? initial.believers,
    scopeIndex: saved.scopeIndex ?? initial.scopeIndex,
    upgrades: upgrades as RumorState["upgrades"],
    debunk: saved.debunk ?? initial.debunk,
    secondsUntilDebunk: saved.secondsUntilDebunk ?? initial.secondsUntilDebunk,
  };
  return { state, earned: 0 };
}
