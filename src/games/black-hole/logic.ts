import type { GameLogic } from "../types";
import { createInitialState, incomePerSecond, restoreState, tick, type BlackHoleState } from "./state";

export const logic: GameLogic<BlackHoleState> = {
  createInitialState,
  restoreState,
  tick: (state, seconds, { modifiers }) => tick(state, seconds, modifiers),
  incomePerSecond,
  metrics: (state) => ({ absorbedMass: state.absorbedMass }),
};
