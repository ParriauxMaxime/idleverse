import { describe, expect, it } from "vitest";
import { loadState, saveState } from "./save";
import { memoryStorage } from "./memoryStorage";

describe("loadState", () => {
  it("returns null without a save", () => {
    expect(loadState(memoryStorage(), "key")).toBeNull();
  });

  it("returns null when the save is corrupted", () => {
    const storage = memoryStorage();
    storage.setItem("key", "{not json");

    expect(loadState(storage, "key")).toBeNull();
  });

  it("restores the state with the elapsed time", () => {
    const storage = memoryStorage();
    saveState(storage, "key", { points: 5 }, 0);

    expect(loadState(storage, "key", 10_000)).toEqual({
      state: { points: 5 },
      elapsedSeconds: 10,
    });
  });
});
