/**
 * IPCC 2006 Default Emission Factors
 * Source: 2006 IPCC Guidelines for National Greenhouse Gas Inventories
 * Volume 2: Energy, Chapter 2: Stationary Combustion
 */

export interface IPCC2006Factor {
  fuel_type: string;
  co2_factor: number; // kgCO2 per unit
  ch4_factor: number; // kgCH4 per unit
  n2o_factor: number; // kgN2O per unit
  unit: string;
  net_calorific_value?: number; // TJ per unit
  description: string;
}

/**
 * IPCC 2006 Default Emission Factors for major fuel types
 * CH4 and N2O factors for stationary combustion
 */
export const IPCC_2006_FACTORS: Record<string, IPCC2006Factor> = {
  natural_gas: {
    fuel_type: "natural_gas",
    co2_factor: 2.176, // kgCO2/Nm3
    ch4_factor: 0.00005, // kgCH4/Nm3
    n2o_factor: 0.000001, // kgN2O/Nm3
    unit: "Nm3",
    net_calorific_value: 0.0000348,
    description: "Natural Gas (dry)",
  },
  lng: {
    fuel_type: "lng",
    co2_factor: 2.176,
    ch4_factor: 0.00005,
    n2o_factor: 0.000001,
    unit: "Nm3",
    net_calorific_value: 0.0000348,
    description: "Liquefied Natural Gas",
  },
  lpg: {
    fuel_type: "lpg",
    co2_factor: 3.0,
    ch4_factor: 0.0001,
    n2o_factor: 0.000001,
    unit: "kg",
    net_calorific_value: 0.0000473,
    description: "Liquefied Petroleum Gas",
  },
  gasoline: {
    fuel_type: "gasoline",
    co2_factor: 2.208,
    ch4_factor: 0.0001,
    n2o_factor: 0.000002,
    unit: "L",
    net_calorific_value: 0.0000323,
    description: "Motor Gasoline",
  },
  diesel: {
    fuel_type: "diesel",
    co2_factor: 2.584,
    ch4_factor: 0.00015,
    n2o_factor: 0.000004,
    unit: "L",
    net_calorific_value: 0.0000357,
    description: "Gas/Diesel Oil",
  },
  kerosene: {
    fuel_type: "kerosene",
    co2_factor: 2.531,
    ch4_factor: 0.0001,
    n2o_factor: 0.000002,
    unit: "L",
    net_calorific_value: 0.0000341,
    description: "Other Kerosene",
  },
  heavy_oil: {
    fuel_type: "heavy_oil",
    co2_factor: 3.114,
    ch4_factor: 0.0002,
    n2o_factor: 0.000004,
    unit: "L",
    net_calorific_value: 0.0000404,
    description: "Residual Fuel Oil",
  },
  city_gas: {
    fuel_type: "city_gas",
    co2_factor: 2.176,
    ch4_factor: 0.00005,
    n2o_factor: 0.000001,
    unit: "Nm3",
    net_calorific_value: 0.0000348,
    description: "City Gas (pipeline natural gas)",
  },
  propane: {
    fuel_type: "propane",
    co2_factor: 2.999,
    ch4_factor: 0.00008,
    n2o_factor: 0.000001,
    unit: "kg",
    net_calorific_value: 0.0000473,
    description: "Propane",
  },
  butane: {
    fuel_type: "butane",
    co2_factor: 3.03,
    ch4_factor: 0.00008,
    n2o_factor: 0.000001,
    unit: "kg",
    net_calorific_value: 0.0000452,
    description: "Butane",
  },
  coal: {
    fuel_type: "coal",
    co2_factor: 2.441,
    ch4_factor: 0.0003,
    n2o_factor: 0.000015,
    unit: "kg",
    net_calorific_value: 0.0000258,
    description: "Other Bituminous Coal",
  },
  wood: {
    fuel_type: "wood",
    co2_factor: 1.494,
    ch4_factor: 0.0003,
    n2o_factor: 0.000004,
    unit: "kg",
    net_calorific_value: 0.0000156,
    description: "Wood / Wood Waste",
  },
  biogas: {
    fuel_type: "biogas",
    co2_factor: 0.00005,
    ch4_factor: 0.00001,
    n2o_factor: 0.0000001,
    unit: "Nm3",
    net_calorific_value: 0.0000209,
    description: "Biogas",
  },
};

/**
 * Get IPCC 2006 emission factor for a fuel type
 */
export function getIPCC2006Factor(fuelType: string): IPCC2006Factor {
  const factor = IPCC_2006_FACTORS[fuelType];
  if (!factor) {
    throw new Error(
      `Unknown fuel type for IPCC 2006: ${fuelType}. Available: ${Object.keys(IPCC_2006_FACTORS).join(", ")}`
    );
  }
  return factor;
}

/**
 * Get all IPCC fuel types
 */
export function getIPCC2006FuelTypes(): string[] {
  return Object.keys(IPCC_2006_FACTORS);
}
