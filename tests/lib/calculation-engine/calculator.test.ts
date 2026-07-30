import { describe, it, expect } from "vitest";
import {
  calculate,
  calculateScope1Stationary,
  calculateScope1Mobile,
  calculateScope1Fugitive,
  calculateScope2Location,
  calculateScope2Market,
  calculateScope3,
} from "@/lib/calculation-engine/calculator";
import { getGWP } from "@/lib/calculation-engine/gwp";
import type { CalculationInput } from "@/lib/calculation-engine/types";

describe("Calculation Engine", () => {
  describe("Scope 1 - Stationary Combustion", () => {
    it("correctly calculates CO2e for LNG combustion (1000 Nm3)", () => {
      const input: CalculationInput = {
        activity_data: 1000,
        unit: "Nm3",
        emission_source_type: "stationary_combustion",
        scope: "scope1",
        fuel_type: "lng",
      };

      const result = calculateScope1Stationary(input);

      // LNG: CO2 factor = 2.176 kgCO2/Nm3
      // 1000 Nm3 * 2.176 = 2176 kgCO2
      expect(result.co2_kg).toBeCloseTo(2176, 0);
      expect(result.co2e_kg).toBeGreaterThan(result.co2_kg); // CO2e includes CH4 and N2O
      expect(result.formula_used).toContain("CO2e");
      expect(result.calculation_steps.length).toBeGreaterThanOrEqual(3);
      expect(result.emission_factor_used.provider).toContain("Korea MOE");
      expect(result.uncertainty_pct).toBeGreaterThan(0);
      expect(result.data_quality_score).toBeGreaterThan(0);
      expect(result.data_quality_score).toBeLessThanOrEqual(5);
    });

    it("correctly calculates CO2e for natural gas combustion", () => {
      const input: CalculationInput = {
        activity_data: 500,
        unit: "Nm3",
        emission_source_type: "stationary_combustion",
        scope: "scope1",
        fuel_type: "natural_gas",
      };

      const result = calculateScope1Stationary(input);

      // Natural gas: CO2 factor = 2.176 kgCO2/Nm3
      // 500 * 2.176 = 1088 kgCO2
      expect(result.co2_kg).toBeCloseTo(1088, 0);
      expect(result.ch4_kg).toBeGreaterThan(0);
      expect(result.n2o_kg).toBeGreaterThan(0);
    });

    it("includes step-by-step breakdown in results", () => {
      const input: CalculationInput = {
        activity_data: 100,
        unit: "L",
        emission_source_type: "stationary_combustion",
        scope: "scope1",
        fuel_type: "diesel",
      };

      const result = calculateScope1Stationary(input);

      expect(result.calculation_steps.length).toBeGreaterThanOrEqual(3);
      expect(result.calculation_steps[0].description).toBeTruthy();
      expect(result.calculation_steps[0].input_value).toBe(100);
      expect(result.calculation_steps[0].output_unit).toBeTruthy();
    });
  });

  describe("Scope 1 - Fugitive Emissions", () => {
    it("correctly applies GWP for R410A refrigerant leak", () => {
      const input: CalculationInput = {
        activity_data: 5, // 5 kg leaked
        unit: "kg",
        emission_source_type: "fugitive_emissions",
        scope: "scope1",
        refrigerant_type: "R410A",
      };

      const result = calculateScope1Fugitive(input);

      // R410A GWP (AR6) = 2256
      // 5 kg * 2256 = 11,280 kgCO2e
      const expectedGWP = getGWP("R410A");
      expect(result.co2e_kg).toBeCloseTo(5 * expectedGWP, 0);
      expect(result.co2_kg).toBe(0); // Fugitive emissions are not CO2
      expect(result.formula_used).toContain("R410A");
    });

    it("correctly applies GWP for R134a refrigerant", () => {
      const input: CalculationInput = {
        activity_data: 2,
        unit: "kg",
        emission_source_type: "fugitive_emissions",
        scope: "scope1",
        refrigerant_type: "R134a",
      };

      const result = calculateScope1Fugitive(input);

      const expectedGWP = getGWP("R134a");
      expect(result.co2e_kg).toBeCloseTo(2 * expectedGWP, 0);
    });
  });

  describe("Scope 2 - Location-Based", () => {
    it("correctly calculates emissions for 1000 kWh Korea grid electricity", () => {
      const input: CalculationInput = {
        activity_data: 1000,
        unit: "kWh",
        emission_source_type: "location_based",
        scope: "scope2",
      };

      const result = calculateScope2Location(input);

      // Korea grid EF = 0.4594 kgCO2/kWh
      // 1000 * 0.4594 = 459.4 kgCO2
      expect(result.co2_kg).toBeCloseTo(459.4, 0);
      expect(result.co2e_kg).toBeGreaterThanOrEqual(result.co2_kg);
      expect(result.emission_factor_used.provider).toBe("Korea MOE");
      expect(result.emission_factor_used.value).toBe(0.4594);
    });
  });

  describe("Scope 2 - Market-Based", () => {
    it("uses supplier-specific emission factor when provided", () => {
      const input: CalculationInput = {
        activity_data: 1000,
        unit: "kWh",
        emission_source_type: "market_based",
        scope: "scope2",
        supplier_ef: 0.3, // renewable-heavy supplier
      };

      const result = calculateScope2Market(input);

      // 1000 * 0.3 = 300 kgCO2e
      expect(result.co2e_kg).toBeCloseTo(300, 0);
      expect(result.emission_factor_used.provider).toBe("Supplier-specific");
    });

    it("falls back to grid factor when no supplier EF provided", () => {
      const input: CalculationInput = {
        activity_data: 1000,
        unit: "kWh",
        emission_source_type: "market_based",
        scope: "scope2",
      };

      const result = calculateScope2Market(input);

      // Should use grid factor as fallback (residual mix)
      expect(result.co2e_kg).toBeCloseTo(459.4, 0);
      expect(result.emission_factor_used.provider).toBe("Residual Mix");
    });
  });

  describe("Scope 3", () => {
    it("calculates with custom emission factor", () => {
      const input: CalculationInput = {
        activity_data: 10000, // 10,000 km business travel
        unit: "km",
        emission_source_type: "business_travel",
        scope: "scope3",
        custom_ef: 0.171, // kgCO2e/km
      };

      const result = calculateScope3(input);

      expect(result.co2e_kg).toBeCloseTo(1710, 0);
      expect(result.data_quality_score).toBeGreaterThan(0);
    });

    it("uses default factor when no custom EF provided", () => {
      const input: CalculationInput = {
        activity_data: 1000,
        unit: "USD",
        emission_source_type: "purchased_goods",
        scope: "scope3",
      };

      const result = calculateScope3(input);

      // Default spend-based factor = 0.5 kgCO2e/unit
      expect(result.co2e_kg).toBeCloseTo(500, 0);
    });
  });

  describe("Main calculate() dispatcher", () => {
    it("routes to correct calculator based on source type", () => {
      const stationaryInput: CalculationInput = {
        activity_data: 100,
        unit: "Nm3",
        emission_source_type: "stationary_combustion",
        scope: "scope1",
        fuel_type: "natural_gas",
      };

      const result = calculate(stationaryInput);
      expect(result.formula_used).toContain("CO2e");
      expect(result.co2_kg).toBeGreaterThan(0);
    });
  });

  describe("Mobile Combustion", () => {
    it("correctly calculates emissions for diesel vehicle fuel", () => {
      const input: CalculationInput = {
        activity_data: 200, // 200L diesel
        unit: "L",
        emission_source_type: "mobile_combustion",
        scope: "scope1",
        fuel_type: "diesel",
      };

      const result = calculateScope1Mobile(input);

      // Diesel: 2.584 kgCO2/L
      // 200 * 2.584 = 516.8 kgCO2
      expect(result.co2_kg).toBeCloseTo(516.8, 0);
      expect(result.co2e_kg).toBeGreaterThan(result.co2_kg);
    });
  });
});
