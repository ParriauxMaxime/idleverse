import { describe, expect, it } from "vitest";
import { gameHref, parseRoute } from "./router";

describe("parseRoute", () => {
  it("opens the catalog by default", () => {
    expect(parseRoute("")).toEqual({ page: "catalog" });
    expect(parseRoute("#/unknown/path")).toEqual({ page: "catalog" });
  });

  it("round-trips a game link", () => {
    expect(parseRoute(gameHref("black-hole"))).toEqual({ page: "game", gameId: "black-hole" });
  });
});
