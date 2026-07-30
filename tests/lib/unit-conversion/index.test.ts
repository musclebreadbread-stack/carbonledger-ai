import { describe, it, expect } from "vitest";
import { convertUnit, getAvailableUnits, getSupportedCategories } from "@/lib/unit-conversion";

describe("Unit Conversion Service", () => {
  describe("Energy conversions", () => {
    it("converts kWh to MJ correctly", () => {
      // 1 kWh = 3.6 MJ
      const result = convertUnit(1, "kWh", "MJ");
      expect(result).toBeCloseTo(3.6, 4);
    });

    it("converts MJ to kWh correctly", () => {
      // 1 MJ = 0.2778 kWh
      const result = convertUnit(1, "MJ", "kWh");
      expect(result).toBeCloseTo(0.2778, 3);
    });

    it("converts GJ to TJ correctly", () => {
      // 1000 GJ = 1 TJ
      const result = convertUnit(1000, "GJ", "TJ");
      expect(result).toBeCloseTo(1, 4);
    });

    it("converts TJ to kWh correctly", () => {
      // 1 TJ = 277,778 kWh
      const result = convertUnit(1, "TJ", "kWh");
      expect(result).toBeCloseTo(277778, 0);
    });

    it("converts kcal to kWh correctly", () => {
      // 1 kWh = 860.421 kcal, so 860.421 kcal = 1 kWh
      const result = convertUnit(860.421, "kcal", "kWh");
      expect(result).toBeCloseTo(1, 3);
    });

    it("converts BTU to kWh correctly", () => {
      // 3412.14 BTU = 1 kWh
      const result = convertUnit(3412.14, "BTU", "kWh");
      expect(result).toBeCloseTo(1, 3);
    });

    it("converts therm to kWh correctly", () => {
      // 1 therm = 29.3071 kWh
      const result = convertUnit(1, "therm", "kWh");
      expect(result).toBeCloseTo(29.3071, 3);
    });
  });

  describe("Mass conversions", () => {
    it("converts kg to t correctly", () => {
      const result = convertUnit(1000, "kg", "t");
      expect(result).toBeCloseTo(1, 4);
    });

    it("converts t to kg correctly", () => {
      const result = convertUnit(1, "t", "kg");
      expect(result).toBeCloseTo(1000, 4);
    });

    it("converts lb to kg correctly", () => {
      const result = convertUnit(1, "lb", "kg");
      expect(result).toBeCloseTo(0.4536, 3);
    });

    it("converts kg to lb correctly", () => {
      const result = convertUnit(1, "kg", "lb");
      expect(result).toBeCloseTo(2.2046, 3);
    });

    it("converts g to kg correctly", () => {
      const result = convertUnit(1000, "g", "kg");
      expect(result).toBeCloseTo(1, 4);
    });
  });

  describe("Volume conversions", () => {
    it("converts L to m3 correctly", () => {
      const result = convertUnit(1000, "L", "m3");
      expect(result).toBeCloseTo(1, 4);
    });

    it("converts gallon to L correctly", () => {
      const result = convertUnit(1, "gallon", "L");
      expect(result).toBeCloseTo(3.78541, 4);
    });

    it("converts barrel to L correctly", () => {
      const result = convertUnit(1, "barrel", "L");
      expect(result).toBeCloseTo(158.987, 2);
    });
  });

  describe("Distance conversions", () => {
    it("converts km to mile correctly", () => {
      const result = convertUnit(1, "km", "mile");
      expect(result).toBeCloseTo(0.6214, 3);
    });

    it("converts mile to km correctly", () => {
      const result = convertUnit(1, "mile", "km");
      expect(result).toBeCloseTo(1.60934, 4);
    });

    it("converts nautical_mile to km correctly", () => {
      const result = convertUnit(1, "nautical_mile", "km");
      expect(result).toBeCloseTo(1.852, 4);
    });
  });

  describe("Emission unit conversions", () => {
    it("converts kgCO2e to tCO2e correctly", () => {
      const result = convertUnit(1000, "kgCO2e", "tCO2e");
      expect(result).toBeCloseTo(1, 4);
    });

    it("converts tCO2e to kgCO2e correctly", () => {
      const result = convertUnit(1, "tCO2e", "kgCO2e");
      expect(result).toBeCloseTo(1000, 4);
    });
  });

  describe("Round-trip conversions", () => {
    it("round-trip kWh -> MJ -> kWh preserves value", () => {
      const original = 42.5;
      const intermediate = convertUnit(original, "kWh", "MJ");
      const result = convertUnit(intermediate, "MJ", "kWh");
      expect(result).toBeCloseTo(original, 8);
    });

    it("round-trip kg -> lb -> kg preserves value", () => {
      const original = 73.2;
      const intermediate = convertUnit(original, "kg", "lb");
      const result = convertUnit(intermediate, "lb", "kg");
      expect(result).toBeCloseTo(original, 8);
    });

    it("round-trip km -> mile -> km preserves value", () => {
      const original = 100;
      const intermediate = convertUnit(original, "km", "mile");
      const result = convertUnit(intermediate, "mile", "km");
      expect(result).toBeCloseTo(original, 8);
    });

    it("round-trip L -> gallon -> L preserves value", () => {
      const original = 50;
      const intermediate = convertUnit(original, "L", "gallon");
      const result = convertUnit(intermediate, "gallon", "L");
      expect(result).toBeCloseTo(original, 8);
    });

    it("floating point error is less than 0.01%", () => {
      const original = 123.456;
      const intermediate = convertUnit(original, "GJ", "BTU");
      const result = convertUnit(intermediate, "BTU", "GJ");
      const error = Math.abs(result - original) / original;
      expect(error).toBeLessThan(0.0001); // 0.01%
    });
  });

  describe("Identity conversions", () => {
    it("same unit returns same value", () => {
      expect(convertUnit(42, "kWh", "kWh")).toBe(42);
      expect(convertUnit(100, "kg", "kg")).toBe(100);
    });
  });

  describe("Error handling", () => {
    it("throws for unknown units", () => {
      expect(() => convertUnit(1, "unknown", "kWh")).toThrow("Unknown unit");
    });

    it("throws for incompatible unit categories", () => {
      expect(() => convertUnit(1, "kWh", "kg")).toThrow("Cannot convert between different unit categories");
    });
  });

  describe("Utility functions", () => {
    it("getAvailableUnits returns units for a category", () => {
      const energyUnits = getAvailableUnits("energy");
      expect(energyUnits).toContain("kWh");
      expect(energyUnits).toContain("MJ");
      expect(energyUnits).toContain("GJ");
    });

    it("getSupportedCategories returns all categories", () => {
      const categories = getSupportedCategories();
      expect(categories).toContain("energy");
      expect(categories).toContain("mass");
      expect(categories).toContain("volume");
      expect(categories).toContain("distance");
      expect(categories).toContain("emission");
    });
  });
});
