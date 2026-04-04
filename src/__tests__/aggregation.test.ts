import { describe, it, expect } from "vitest";
import { getCountryName } from "@/lib/aggregation";

describe("getCountryName", () => {
  it("returns full name for known country codes", () => {
    expect(getCountryName("US")).toBe("United States");
    expect(getCountryName("GB")).toBe("United Kingdom");
    expect(getCountryName("JP")).toBe("Japan");
    expect(getCountryName("BR")).toBe("Brazil");
    expect(getCountryName("KR")).toBe("South Korea");
    expect(getCountryName("DE")).toBe("Germany");
  });

  it("returns the code itself for unknown codes", () => {
    expect(getCountryName("ZZ")).toBe("ZZ");
    expect(getCountryName("XX")).toBe("XX");
    expect(getCountryName("")).toBe("");
  });

  it("is case-sensitive (uses uppercase ISO codes)", () => {
    // ISO codes should be uppercase
    expect(getCountryName("us")).toBe("us");
    expect(getCountryName("Us")).toBe("Us");
  });
});
