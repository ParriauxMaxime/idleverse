import type { GameDefinition } from "../types";
import { logic } from "./logic";
import type { StrongmanState } from "./state";

export const game: GameDefinition<StrongmanState> = {
  id: "strongman",
  name: "L'Hercule Forain",
  genre: "clicker",
  emoji: "🏋️",
  accent: "#e0694f",
  pitch: "Approchez ! Tapez, tapez encore : il soulève l'impossible pour quelques sous.",
  logic,
  loadView: () => import("./view"),
};
