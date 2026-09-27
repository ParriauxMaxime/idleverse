import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { BlackHoleState } from "./state";

export const game: GameDefinition<BlackHoleState> = {
  id: "black-hole",
  name: "Trou noir",
  genre: "clicker",
  emoji: "🕳️",
  accent: "#e2a672",
  pitch: "Absorbe la matière, grossis, avale des galaxies.",
  logic,
  loadView: () => import("./view"),
};
