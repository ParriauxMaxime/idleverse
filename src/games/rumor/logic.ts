import type { GameLogic } from "../types";
import { createInitialState, incomePerSecond, restoreState, tick, type RumorState } from "./state";

export const logic: GameLogic<RumorState> = {
  createInitialState,
  restoreState,
  tick: (state, seconds, context) => tick(state, seconds, context, Math.random),
  incomePerSecond,
  metrics: (state) => ({ scopeLevel: state.scopeIndex + 1, believers: state.believers }),
};
