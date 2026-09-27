import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("floors small numbers so displayed points are always spendable", () => {
    expect(formatNumber(14.9)).toBe("14");
  });

  it("keeps requested decimals for small numbers", () => {
    expect(formatNumber(0.25, 1)).toBe("0.2");
  });

  it("uses suffixes for large numbers", () => {
    expect(formatNumber(1234)).toBe("1.2K");
    expect(formatNumber(5_600_000)).toBe("5.6M");
  });

  it("keeps suffixes for idle-game sized numbers", () => {
    expect(formatNumber(1.5e15)).toBe("1.5Qa");
  });

  it("falls back to scientific notation past the last suffix", () => {
    expect(formatNumber(1.5e36)).toBe("1.50e+36");
  });
});
