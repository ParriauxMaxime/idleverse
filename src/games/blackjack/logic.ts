import type { GameLogic } from "../types";
import { createInitialState, incomePerSecond, metrics, restoreState, tick, type BlackjackState } from "./state";

export const logic: GameLogic<BlackjackState> = {
  createInitialState,
  restoreState,
  tick,
  incomePerSecond,
  metrics,
};
