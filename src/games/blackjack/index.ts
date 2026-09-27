import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { BlackjackState } from "./state";

export const game: GameDefinition<BlackjackState> = {
  id: "blackjack",
  name: "Vingt-et-Un",
  genre: "cards",
  emoji: "🃏",
  accent: "#4aa37c",
  pitch: "Faites vos jeux ! Tirez, restez, battez la banque… et soudoyez un peu le croupier.",
  logic,
  loadView: () => import("./view"),
};
