import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { RumorState } from "./state";

export const game: GameDefinition<RumorState> = {
  id: "rumor",
  name: "Rumeur",
  genre: "simulation",
  emoji: "🗣️",
  accent: "#d9a0b8",
  pitch: "Lance une rumeur absurde et regarde-la contaminer le monde.",
  logic,
  loadView: () => import("./view"),
};
