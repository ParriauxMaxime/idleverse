import type { GameDefinition } from "./types";

const definitions = import.meta.glob<GameDefinition>("./*/index.ts", {
  eager: true,
  import: "game",
});

export const GAMES = Object.values(definitions).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
