import type { GameLogic } from "../types";
import { createInitialState, incomePerSecond, metrics, restoreState, tick, type PiggyState } from "./state";

export const logic: GameLogic<PiggyState> = {
  createInitialState,
  restoreState,
  tick,
  incomePerSecond,
  metrics,
};
