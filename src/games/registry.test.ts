import { describe, expect, it } from "vitest";
import type { GameDefinition } from "./types";

const definitions = import.meta.glob<GameDefinition>("./*/index.ts", {
  eager: true,
  import: "game",
});

describe("game registry", () => {
  it("uses each game folder name as its id", () => {
    for (const [path, game] of Object.entries(definitions)) {
      expect(path).toBe(`./${game.id}/index.ts`);
    }
  });
});
