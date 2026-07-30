/**
 * Type definitions for the GHG Calculation Engine
 * Implements ISO 14064 / GHG Protocol compliant calculation types
 */

export type Scope = "scope1" | "scope2" | "scope3";

export type Scope1SourceType = "stationary_combustion" | "mobile_combustion" | "fugitive_emissions" | "process_emissions";
export type Scope2Method = "location_based" | "market_based";
export type Scope3Category =
  | "purchased_goods"
  | "capital_goods"
  | "fuel_energy"
  | "transportation_upstream"
  | "waste"
  | "business_travel"
  | "employee_commuting"
  | "leased_assets_upstream"
  | "transportation_downstream"
  | "processing"
  | "use_of_sold_products"
  | "end_of_life"
  | "leased_assets_downstream"
  | "franchises"
  | "investments";

export type EmissionSourceType = Scope1SourceType | Scope2Method | Scope3Category;

export type FuelType =
  | "natural_gas"
  | "lng"
  | "lpg"
  | "gasoline"
  | "diesel"
  | "kerosene"
  | "heavy_oil"
  | "city_gas"
  | "propane"
  | "butane"
  | "coal"
  | "wood"
  | "biogas";

export type RefrigerantType =
  | "R22"
  | "R134a"
  | "R410A"
  | "R32"
  | "R404A"
  | "R407C"
  | "R507A"
  | "R23"
  | "SF6"
  | "CO2"
  | "R290";

export interface CalculationInput {
  activity_data: number;
  unit: string;
  emission_source_type: EmissionSourceType;
  scope: Scope;
  fuel_type?: FuelType;
  refrigerant_type?: RefrigerantType;
  grid_region?: string;
  supplier_ef?: number;
  custom_ef?: number;
  year?: number;
}

export interface CalculationStep {
  description: string;
  input_value: number;
  input_unit: string;
  factor: number;
  factor_unit?: string;
  output_value: number;
  output_unit: string;
}

export interface CalculationResult {
  co2e_kg: number;
  co2_kg: number;
  ch4_kg: number;
  n2o_kg: number;
  formula_used: string;
  calculation_steps: CalculationStep[];
  emission_factor_used: {
    provider: string;
    version: string;
    factor_id: string;
    value: number;
    unit: string;
  };
  uncertainty_pct: number;
  data_quality_score: number;
}

export interface DataQualityInput {
  data_source: "measured" | "calculated" | "estimated" | "default";
  completeness: number; // 0-1
  temporal_correlation: number; // years of difference
  geographic_correlation: "same_country" | "same_region" | "global";
  technological_correlation: "same_technology" | "similar" | "different";
}

export interface UncertaintyInput {
  emission_factor_uncertainty: number; // percentage
  activity_data_uncertainty: number; // percentage
}
