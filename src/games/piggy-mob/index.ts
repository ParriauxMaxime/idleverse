import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { PiggyState } from "./state";

export const game: GameDefinition<PiggyState> = {
  id: "piggy-mob",
  name: "Tirelire Nostra",
  genre: "missions",
  emoji: "🐷",
  accent: "#c9a45c",
  pitch: "Le Parrain a des contrats. Toi, tu as un marteau. Casse des tirelires pour la Famille.",
  logic,
  loadView: () => import("./view"),
};
