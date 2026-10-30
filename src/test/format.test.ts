import { describe, expect, it } from "vitest";
import { fmt } from "@/game/config";

describe("fmt", () => {
  it("uses a dot as thousands separator", () => {
    expect(fmt(4000)).toBe("4.000");
    expect(fmt(1234567)).toBe("1.234.567");
  });
  it("leaves small numbers unchanged", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(999)).toBe("999");
  });
});
