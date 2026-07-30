/**
 * Korean Ministry of Environment (MOE) Emission Factors
 * Source: Korean GHG Inventory & Research Center (GIR)
 * Version: 2023
 */

export interface FuelEmissionFactor {
  fuel_type: string;
  co2_factor: number; // kgCO2 per unit
  unit: string;
  description_ko: string;
  description_en: string;
}

export interface GridEmissionFactor {
  co2_factor: number; // kgCO2/kWh
  ch4_factor: number; // kgCH4/kWh
  n2o_factor: number; // kgN2O/kWh
  year: number;
  region: string;
}

/**
 * Korea MOE Grid Electricity Emission Factor (2023)
 * 0.4594 kgCO2e/kWh (indirect emission factor for purchased electricity)
 */
export const KOREA_MOE_GRID_FACTOR: GridEmissionFactor = {
  co2_factor: 0.4594,
  ch4_factor: 0.0000054,
  n2o_factor: 0.0000072,
  year: 2023,
  region: "Korea",
};

/**
 * Scope 1 fuel combustion factors
 * Units: kgCO2 per unit specified
 */
export const KOREA_MOE_FUEL_FACTORS: Record<string, FuelEmissionFactor> = {
  natural_gas: {
    fuel_type: "natural_gas",
    co2_factor: 2.176, // kgCO2/Nm3
    unit: "Nm3",
    description_ko: "천연가스 (도시가스)",
    description_en: "Natural Gas (City Gas)",
  },
  lng: {
    fuel_type: "lng",
    co2_factor: 2.176, // kgCO2/Nm3
    unit: "Nm3",
    description_ko: "액화천연가스 (LNG)",
    description_en: "Liquefied Natural Gas (LNG)",
  },
  lpg: {
    fuel_type: "lpg",
    co2_factor: 3.0, // kgCO2/kg
    unit: "kg",
    description_ko: "액화석유가스 (LPG)",
    description_en: "Liquefied Petroleum Gas (LPG)",
  },
  gasoline: {
    fuel_type: "gasoline",
    co2_factor: 2.208, // kgCO2/L
    unit: "L",
    description_ko: "휘발유",
    description_en: "Gasoline",
  },
  diesel: {
    fuel_type: "diesel",
    co2_factor: 2.584, // kgCO2/L
    unit: "L",
    description_ko: "경유",
    description_en: "Diesel",
  },
  kerosene: {
    fuel_type: "kerosene",
    co2_factor: 2.531, // kgCO2/L
    unit: "L",
    description_ko: "등유",
    description_en: "Kerosene",
  },
  heavy_oil: {
    fuel_type: "heavy_oil",
    co2_factor: 3.114, // kgCO2/L
    unit: "L",
    description_ko: "중유 (B-C유)",
    description_en: "Heavy Oil (Bunker C)",
  },
  city_gas: {
    fuel_type: "city_gas",
    co2_factor: 2.176, // kgCO2/Nm3
    unit: "Nm3",
    description_ko: "도시가스",
    description_en: "City Gas",
  },
  propane: {
    fuel_type: "propane",
    co2_factor: 2.999, // kgCO2/kg
    unit: "kg",
    description_ko: "프로판",
    description_en: "Propane",
  },
  butane: {
    fuel_type: "butane",
    co2_factor: 3.03, // kgCO2/kg
    unit: "kg",
    description_ko: "부탄",
    description_en: "Butane",
  },
  coal: {
    fuel_type: "coal",
    co2_factor: 2.441, // kgCO2/kg
    unit: "kg",
    description_ko: "석탄 (유연탄)",
    description_en: "Coal (Bituminous)",
  },
  wood: {
    fuel_type: "wood",
    co2_factor: 1.494, // kgCO2/kg (biomass - may be reported as zero under some protocols)
    unit: "kg",
    description_ko: "목재/바이오매스",
    description_en: "Wood/Biomass",
  },
  biogas: {
    fuel_type: "biogas",
    co2_factor: 0.00005, // kgCO2/Nm3 (biogenic - negligible)
    unit: "Nm3",
    description_ko: "바이오가스",
    description_en: "Biogas",
  },
};

/**
 * Get emission factor for a fuel type
 */
export function getKoreaMOEFactor(fuelType: string): FuelEmissionFactor {
  const factor = KOREA_MOE_FUEL_FACTORS[fuelType];
  if (!factor) {
    throw new Error(
      `Unknown fuel type: ${fuelType}. Available: ${Object.keys(KOREA_MOE_FUEL_FACTORS).join(", ")}`
    );
  }
  return factor;
}

/**
 * Get all available fuel types
 */
export function getAvailableFuelTypes(): string[] {
  return Object.keys(KOREA_MOE_FUEL_FACTORS);
}
