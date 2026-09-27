import { describe, expect, it } from "vitest";
import { GAMES } from "../games/registry";
import {
  isGameAvailable,
  modifiersFor,
  newlyUnlocked,
  requirementProgress,
} from "./progression";
import { STARTING_GAME_ID, UNLOCKS } from "./unlocks";

describe("unlock configuration", () => {
  const gameIds = GAMES.map((game) => game.id);

  it("targets existing games and metrics", () => {
    for (const { requirement, reward } of UNLOCKS) {
      const source = GAMES.find((game) => game.id === requirement.gameId)!;
      expect(gameIds).toContain(reward.gameId);
      expect(source.logic.metrics(source.logic.createInitialState())).toHaveProperty(requirement.metric);
    }
  });

  it("makes every game reachable", () => {
    const everything = new Set(UNLOCKS.map((unlock) => unlock.id));
    for (const id of gameIds) {
      expect(isGameAvailable(id, everything)).toBe(true);
    }
  });

  it("has unique ids", () => {
    expect(new Set(UNLOCKS.map((unlock) => unlock.id)).size).toBe(UNLOCKS.length);
  });
});

describe("isGameAvailable", () => {
  it("only opens the starting game at first", () => {
    expect(isGameAvailable(STARTING_GAME_ID, new Set())).toBe(true);
    expect(isGameAvailable("slime-lab", new Set())).toBe(false);
    expect(isGameAvailable("slime-lab", new Set(["slime-lab"]))).toBe(true);
  });
});

describe("modifiersFor", () => {
  it("multiplies unlocked bonuses targeting the game", () => {
    const unlocked = new Set(["slimes-feed-black-hole", "rumor-hypes-black-hole", "stars-heat-slimes"]);

    expect(modifiersFor("black-hole", unlocked)).toEqual({ production: 2, tap: 3 });
  });

  it("returns neutral modifiers without bonuses", () => {
    expect(modifiersFor("black-hole", new Set())).toEqual({ production: 1, tap: 1 });
  });
});

describe("newlyUnlocked", () => {
  it("returns met requirements not unlocked yet", () => {
    const metrics = { "black-hole": { absorbedMass: 80_000 } };
    const ids = newlyUnlocked(new Set(["slime-lab"]), metrics).map((unlock) => unlock.id);

    expect(ids).toEqual(["stars-heat-slimes"]);
  });

  it("ignores games without metrics", () => {
    expect(newlyUnlocked(new Set(), {})).toEqual([]);
  });
});

describe("requirementProgress", () => {
  it("caps at 1", () => {
    const requirement = { gameId: "rumor", metric: "scopeLevel", amount: 3, label: "" };

    expect(requirementProgress(requirement, { rumor: { scopeLevel: 1.5 } })).toBe(0.5);
    expect(requirementProgress(requirement, { rumor: { scopeLevel: 9 } })).toBe(1);
  });
});
