import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { SlimeLabState } from "./state";

export const game: GameDefinition<SlimeLabState> = {
  id: "slime-lab",
  name: "Labo de slimes",
  genre: "merge",
  emoji: "🧪",
  accent: "#98c99c",
  pitch: "Fusionne des slimes pour découvrir des espèces de plus en plus étranges.",
  logic,
  loadView: () => import("./view"),
};
