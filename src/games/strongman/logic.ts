import type { GameLogic } from "../types";
import {
  createInitialState,
  currentWeight,
  incomePerSecond,
  restoreState,
  tick,
  type StrongmanState,
} from "./state";

export const logic: GameLogic<StrongmanState> = {
  createInitialState,
  restoreState,
  tick,
  incomePerSecond,
  metrics: (state) => ({ liftsCompleted: state.liftsCompleted, maxKilograms: currentWeight(state).kilograms }),
};
