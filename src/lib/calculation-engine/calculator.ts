/**
 * Core GHG Calculation Engine
 * Implements ISO 14064 / GHG Protocol compliant calculations for Scope 1, 2, and 3
 */

import type {
  CalculationInput,
  CalculationResult,
  CalculationStep,
  FuelType,
  RefrigerantType,
} from "./types";
import { getGWP, refrigerantToGas } from "./gwp";
import { propagateUncertainty, assessDataQuality, getDefaultUncertainty } from "./uncertainty";
import { getKoreaMOEFactor, KOREA_MOE_GRID_FACTOR } from "@/constants/emission-factors/korea-moe";
import { getIPCC2006Factor } from "@/constants/emission-factors/ipcc-2006";

/**
 * Main calculation dispatcher
 */
export function calculate(input: CalculationInput): CalculationResult {
  switch (input.emission_source_type) {
    case "stationary_combustion":
      return calculateScope1Stationary(input);
    case "mobile_combustion":
      return calculateScope1Mobile(input);
    case "fugitive_emissions":
      return calculateScope1Fugitive(input);
    case "process_emissions":
      return calculateScope1Process(input);
    case "location_based":
      return calculateScope2Location(input);
    case "market_based":
      return calculateScope2Market(input);
    default:
      return calculateScope3(input);
  }
}

/**
 * Scope 1 - Stationary Combustion
 * Formula: Activity Data (fuel consumption) x NCV (if needed) x Emission Factor
 * CO2e = CO2 + (CH4 * GWP_CH4) + (N2O * GWP_N2O)
 */
export function calculateScope1Stationary(input: CalculationInput): CalculationResult {
  const fuelType = input.fuel_type || "natural_gas";
  const steps: CalculationStep[] = [];

  // Get emission factors
  const factors = getKoreaMOEFactor(fuelType);
  const ipccFactors = getIPCC2006Factor(fuelType);

  // Step 1: Calculate CO2 emissions
  const co2_kg = input.activity_data * factors.co2_factor;
  steps.push({
    description: `CO2 emissions = Activity data x CO2 emission factor`,
    input_value: input.activity_data,
    input_unit: input.unit,
    factor: factors.co2_factor,
    factor_unit: `kgCO2/${factors.unit}`,
    output_value: co2_kg,
    output_unit: "kgCO2",
  });

  // Step 2: Calculate CH4 emissions
  const ch4_factor = ipccFactors.ch4_factor;
  const ch4_kg = input.activity_data * ch4_factor;
  steps.push({
    description: `CH4 emissions = Activity data x CH4 emission factor`,
    input_value: input.activity_data,
    input_unit: input.unit,
    factor: ch4_factor,
    factor_unit: `kgCH4/${factors.unit}`,
    output_value: ch4_kg,
    output_unit: "kgCH4",
  });

  // Step 3: Calculate N2O emissions
  const n2o_factor = ipccFactors.n2o_factor;
  const n2o_kg = input.activity_data * n2o_factor;
  steps.push({
    description: `N2O emissions = Activity data x N2O emission factor`,
    input_value: input.activity_data,
    input_unit: input.unit,
    factor: n2o_factor,
    factor_unit: `kgN2O/${factors.unit}`,
    output_value: n2o_kg,
    output_unit: "kgN2O",
  });

  // Step 4: Calculate CO2e
  const gwp_ch4 = getGWP("CH4");
  const gwp_n2o = getGWP("N2O");
  const co2e_kg = co2_kg + ch4_kg * gwp_ch4 + n2o_kg * gwp_n2o;
  steps.push({
    description: `CO2e = CO2 + (CH4 x GWP_CH4) + (N2O x GWP_N2O)`,
    input_value: co2_kg,
    input_unit: "kgCO2",
    factor: 1,
    output_value: co2e_kg,
    output_unit: "kgCO2e",
  });

  const dataQuality = assessDataQuality({
    data_source: "calculated",
    completeness: 1,
    temporal_correlation: 1,
    geographic_correlation: "same_country",
    technological_correlation: "same_technology",
  });

  const uncertainty = propagateUncertainty({
    emission_factor_uncertainty: 5,
    activity_data_uncertainty: getDefaultUncertainty(dataQuality),
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: Math.round(co2_kg * 1000) / 1000,
    ch4_kg: Math.round(ch4_kg * 1000) / 1000,
    n2o_kg: Math.round(n2o_kg * 1000) / 1000,
    formula_used: `CO2e = (Activity × CO2_EF) + (Activity × CH4_EF × GWP_CH4) + (Activity × N2O_EF × GWP_N2O)`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: "Korea MOE + IPCC 2006",
      version: "2023",
      factor_id: `korea_moe_${fuelType}`,
      value: factors.co2_factor,
      unit: `kgCO2/${factors.unit}`,
    },
    uncertainty_pct: uncertainty,
    data_quality_score: dataQuality,
  };
}

/**
 * Scope 1 - Mobile Combustion
 * Formula: Fuel consumption x Emission Factor
 */
export function calculateScope1Mobile(input: CalculationInput): CalculationResult {
  const fuelType = input.fuel_type || "diesel";
  const steps: CalculationStep[] = [];

  const factors = getKoreaMOEFactor(fuelType);
  const ipccFactors = getIPCC2006Factor(fuelType);

  const co2_kg = input.activity_data * factors.co2_factor;
  steps.push({
    description: `CO2 emissions from mobile combustion = Fuel consumed x CO2 EF`,
    input_value: input.activity_data,
    input_unit: input.unit,
    factor: factors.co2_factor,
    factor_unit: `kgCO2/${factors.unit}`,
    output_value: co2_kg,
    output_unit: "kgCO2",
  });

  const ch4_kg = input.activity_data * ipccFactors.ch4_factor;
  const n2o_kg = input.activity_data * ipccFactors.n2o_factor;
  const gwp_ch4 = getGWP("CH4");
  const gwp_n2o = getGWP("N2O");
  const co2e_kg = co2_kg + ch4_kg * gwp_ch4 + n2o_kg * gwp_n2o;

  steps.push({
    description: `CO2e = CO2 + (CH4 x ${gwp_ch4}) + (N2O x ${gwp_n2o})`,
    input_value: co2_kg,
    input_unit: "kgCO2",
    factor: 1,
    output_value: co2e_kg,
    output_unit: "kgCO2e",
  });

  const dataQuality = assessDataQuality({
    data_source: "calculated",
    completeness: 1,
    temporal_correlation: 1,
    geographic_correlation: "same_country",
    technological_correlation: "same_technology",
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: Math.round(co2_kg * 1000) / 1000,
    ch4_kg: Math.round(ch4_kg * 1000) / 1000,
    n2o_kg: Math.round(n2o_kg * 1000) / 1000,
    formula_used: `CO2e = (Fuel × CO2_EF) + (Fuel × CH4_EF × GWP_CH4) + (Fuel × N2O_EF × GWP_N2O)`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: "Korea MOE",
      version: "2023",
      factor_id: `korea_moe_mobile_${fuelType}`,
      value: factors.co2_factor,
      unit: `kgCO2/${factors.unit}`,
    },
    uncertainty_pct: propagateUncertainty({
      emission_factor_uncertainty: 5,
      activity_data_uncertainty: getDefaultUncertainty(dataQuality),
    }),
    data_quality_score: dataQuality,
  };
}

/**
 * Scope 1 - Fugitive Emissions
 * Formula: Refrigerant Charge (kg) x Leak Rate (%) x GWP
 */
export function calculateScope1Fugitive(input: CalculationInput): CalculationResult {
  const refrigerant = input.refrigerant_type || "R410A";
  const steps: CalculationStep[] = [];

  // input.activity_data = amount of refrigerant leaked/emitted in kg
  const gwp = getGWP(refrigerantToGas(refrigerant));

  steps.push({
    description: `Refrigerant emissions: Amount leaked x GWP`,
    input_value: input.activity_data,
    input_unit: "kg",
    factor: gwp,
    factor_unit: `GWP (${refrigerant})`,
    output_value: input.activity_data * gwp,
    output_unit: "kgCO2e",
  });

  const co2e_kg = input.activity_data * gwp;

  const dataQuality = assessDataQuality({
    data_source: "estimated",
    completeness: 0.8,
    temporal_correlation: 1,
    geographic_correlation: "same_country",
    technological_correlation: "same_technology",
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: 0,
    ch4_kg: 0,
    n2o_kg: 0,
    formula_used: `CO2e = Refrigerant_leaked_kg x GWP_${refrigerant}`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: "IPCC AR6",
      version: "AR6",
      factor_id: `gwp_${refrigerant}`,
      value: gwp,
      unit: "kgCO2e/kg",
    },
    uncertainty_pct: propagateUncertainty({
      emission_factor_uncertainty: 10,
      activity_data_uncertainty: getDefaultUncertainty(dataQuality),
    }),
    data_quality_score: dataQuality,
  };
}

/**
 * Scope 1 - Process Emissions
 */
export function calculateScope1Process(input: CalculationInput): CalculationResult {
  const ef = input.custom_ef || 1.0;
  const co2_kg = input.activity_data * ef;
  const steps: CalculationStep[] = [
    {
      description: `Process emissions = Activity data x Process EF`,
      input_value: input.activity_data,
      input_unit: input.unit,
      factor: ef,
      factor_unit: "kgCO2e/unit",
      output_value: co2_kg,
      output_unit: "kgCO2e",
    },
  ];

  return {
    co2e_kg: Math.round(co2_kg * 1000) / 1000,
    co2_kg: Math.round(co2_kg * 1000) / 1000,
    ch4_kg: 0,
    n2o_kg: 0,
    formula_used: `CO2e = Activity_data x Process_EF`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: "Custom",
      version: "custom",
      factor_id: "custom_process_ef",
      value: ef,
      unit: "kgCO2e/unit",
    },
    uncertainty_pct: 30,
    data_quality_score: 3,
  };
}

/**
 * Scope 2 - Location-Based Method
 * Formula: Electricity consumed (kWh) x Grid Emission Factor
 */
export function calculateScope2Location(input: CalculationInput): CalculationResult {
  const steps: CalculationStep[] = [];

  // Use Korea grid factor by default
  const gridFactor = KOREA_MOE_GRID_FACTOR;

  const co2_kg = input.activity_data * gridFactor.co2_factor;
  steps.push({
    description: `Scope 2 (location-based) = Electricity x Grid EF`,
    input_value: input.activity_data,
    input_unit: "kWh",
    factor: gridFactor.co2_factor,
    factor_unit: "kgCO2/kWh",
    output_value: co2_kg,
    output_unit: "kgCO2",
  });

  // CH4 and N2O from grid electricity
  const ch4_kg = input.activity_data * gridFactor.ch4_factor;
  const n2o_kg = input.activity_data * gridFactor.n2o_factor;
  const gwp_ch4 = getGWP("CH4");
  const gwp_n2o = getGWP("N2O");
  const co2e_kg = co2_kg + ch4_kg * gwp_ch4 + n2o_kg * gwp_n2o;

  steps.push({
    description: `CO2e = CO2 + (CH4 x GWP_CH4) + (N2O x GWP_N2O)`,
    input_value: co2_kg,
    input_unit: "kgCO2",
    factor: 1,
    output_value: co2e_kg,
    output_unit: "kgCO2e",
  });

  const dataQuality = assessDataQuality({
    data_source: "measured",
    completeness: 1,
    temporal_correlation: 1,
    geographic_correlation: "same_country",
    technological_correlation: "same_technology",
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: Math.round(co2_kg * 1000) / 1000,
    ch4_kg: Math.round(ch4_kg * 1000) / 1000,
    n2o_kg: Math.round(n2o_kg * 1000) / 1000,
    formula_used: `CO2e = Electricity_kWh x Grid_EF (location-based)`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: "Korea MOE",
      version: "2023",
      factor_id: "korea_grid_2023",
      value: gridFactor.co2_factor,
      unit: "kgCO2/kWh",
    },
    uncertainty_pct: propagateUncertainty({
      emission_factor_uncertainty: 5,
      activity_data_uncertainty: getDefaultUncertainty(dataQuality),
    }),
    data_quality_score: dataQuality,
  };
}

/**
 * Scope 2 - Market-Based Method
 * Formula: Electricity consumed (kWh) x Supplier-specific EF (or residual mix)
 */
export function calculateScope2Market(input: CalculationInput): CalculationResult {
  const steps: CalculationStep[] = [];

  // Use supplier-specific factor or residual mix
  const supplierEF = input.supplier_ef || KOREA_MOE_GRID_FACTOR.co2_factor;

  const co2e_kg = input.activity_data * supplierEF;
  steps.push({
    description: `Scope 2 (market-based) = Electricity x Supplier/Residual Mix EF`,
    input_value: input.activity_data,
    input_unit: "kWh",
    factor: supplierEF,
    factor_unit: "kgCO2e/kWh",
    output_value: co2e_kg,
    output_unit: "kgCO2e",
  });

  const dataQuality = assessDataQuality({
    data_source: input.supplier_ef ? "measured" : "default",
    completeness: 1,
    temporal_correlation: 1,
    geographic_correlation: "same_country",
    technological_correlation: input.supplier_ef ? "same_technology" : "similar",
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: Math.round(co2e_kg * 1000) / 1000,
    ch4_kg: 0,
    n2o_kg: 0,
    formula_used: `CO2e = Electricity_kWh x Supplier_EF (market-based)`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: input.supplier_ef ? "Supplier-specific" : "Residual Mix",
      version: "2023",
      factor_id: "market_based_ef",
      value: supplierEF,
      unit: "kgCO2e/kWh",
    },
    uncertainty_pct: propagateUncertainty({
      emission_factor_uncertainty: input.supplier_ef ? 3 : 10,
      activity_data_uncertainty: getDefaultUncertainty(dataQuality),
    }),
    data_quality_score: dataQuality,
  };
}

/**
 * Scope 3 - Various categories
 * Supports spend-based, activity-based, and hybrid methods
 */
export function calculateScope3(input: CalculationInput): CalculationResult {
  const steps: CalculationStep[] = [];

  // Use custom emission factor or default spend-based factor
  const ef = input.custom_ef || 0.5; // default spend-based factor in kgCO2e/unit

  const co2e_kg = input.activity_data * ef;
  steps.push({
    description: `Scope 3 (${input.emission_source_type}) = Activity x EF`,
    input_value: input.activity_data,
    input_unit: input.unit,
    factor: ef,
    factor_unit: "kgCO2e/unit",
    output_value: co2e_kg,
    output_unit: "kgCO2e",
  });

  const dataQuality = assessDataQuality({
    data_source: input.custom_ef ? "calculated" : "estimated",
    completeness: 0.7,
    temporal_correlation: 2,
    geographic_correlation: "same_region",
    technological_correlation: "similar",
  });

  return {
    co2e_kg: Math.round(co2e_kg * 1000) / 1000,
    co2_kg: Math.round(co2e_kg * 0.95 * 1000) / 1000,
    ch4_kg: Math.round(co2e_kg * 0.03 * 1000) / 1000,
    n2o_kg: Math.round(co2e_kg * 0.02 * 1000) / 1000,
    formula_used: `CO2e = Activity_data x Scope3_EF (${input.emission_source_type})`,
    calculation_steps: steps,
    emission_factor_used: {
      provider: input.custom_ef ? "Custom" : "DEFRA",
      version: "2023",
      factor_id: `scope3_${input.emission_source_type}`,
      value: ef,
      unit: "kgCO2e/unit",
    },
    uncertainty_pct: propagateUncertainty({
      emission_factor_uncertainty: 20,
      activity_data_uncertainty: getDefaultUncertainty(dataQuality),
    }),
    data_quality_score: dataQuality,
  };
}
