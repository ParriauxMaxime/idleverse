import type { GameLogic } from "../types";
import {
  createInitialState,
  productionPerSecond,
  restoreState,
  tick,
  type SlimeLabState,
} from "./state";

export const logic: GameLogic<SlimeLabState> = {
  createInitialState,
  restoreState,
  tick: (state, seconds, { modifiers }) => tick(state, seconds, modifiers),
  incomePerSecond: productionPerSecond,
  metrics: (state) => ({ speciesDiscovered: state.highestLevel }),
};
