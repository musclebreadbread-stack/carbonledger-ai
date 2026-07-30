/**
 * Unit conversion factors organized by category
 * All factors convert TO the SI base unit for each category
 */

export interface ConversionFactor {
  toBase: number; // multiply by this to get to base unit
  category: string;
  baseUnit: string;
}

/**
 * Energy units - Base unit: kWh
 */
export const ENERGY_FACTORS: Record<string, number> = {
  kWh: 1,
  MJ: 1 / 3.6, // 1 MJ = 0.2778 kWh
  GJ: 1000 / 3.6, // 1 GJ = 277.778 kWh
  TJ: 1000000 / 3.6, // 1 TJ = 277,778 kWh
  kcal: 1 / 860.421, // 1 kcal = 0.001163 kWh
  BTU: 1 / 3412.14, // 1 BTU = 0.000293 kWh
  therm: 29.3071, // 1 therm = 29.3071 kWh
  MWh: 1000, // 1 MWh = 1000 kWh
  toe: 11630, // 1 toe (tonne of oil equivalent) = 11,630 kWh
  "Nm3_gas": 10.55 / 3.6, // 1 Nm3 natural gas ~ 10.55 MJ
};

/**
 * Mass units - Base unit: kg
 */
export const MASS_FACTORS: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 0.000001,
  t: 1000, // metric tonne
  Mt: 1000000000, // megatonne
  lb: 0.453592,
  oz: 0.0283495,
  ton_us: 907.185, // US short ton
  ton_uk: 1016.05, // UK long ton
};

/**
 * Volume units - Base unit: L (litre)
 */
export const VOLUME_FACTORS: Record<string, number> = {
  L: 1,
  mL: 0.001,
  m3: 1000,
  Nm3: 1000, // Normal cubic meter (at 0C, 1atm)
  gallon: 3.78541, // US gallon
  gallon_uk: 4.54609, // UK gallon
  barrel: 158.987, // oil barrel
  ft3: 28.3168, // cubic feet
};

/**
 * Distance units - Base unit: km
 */
export const DISTANCE_FACTORS: Record<string, number> = {
  km: 1,
  m: 0.001,
  mile: 1.60934,
  nautical_mile: 1.852,
  ft: 0.0003048,
  yd: 0.0009144,
};

/**
 * Emission units - Base unit: kgCO2e
 */
export const EMISSION_FACTORS: Record<string, number> = {
  kgCO2e: 1,
  gCO2e: 0.001,
  tCO2e: 1000,
  MtCO2e: 1000000000,
  kgCO2: 1,
  tCO2: 1000,
};

/**
 * All unit categories with their factors
 */
export const ALL_CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  energy: ENERGY_FACTORS,
  mass: MASS_FACTORS,
  volume: VOLUME_FACTORS,
  distance: DISTANCE_FACTORS,
  emission: EMISSION_FACTORS,
};

/**
 * Get the category of a unit
 */
export function getUnitCategory(unit: string): string | null {
  for (const [category, factors] of Object.entries(ALL_CONVERSION_FACTORS)) {
    if (unit in factors) {
      return category;
    }
  }
  return null;
}

/**
 * Get the base unit for a category
 */
export function getBaseUnit(category: string): string {
  const baseUnits: Record<string, string> = {
    energy: "kWh",
    mass: "kg",
    volume: "L",
    distance: "km",
    emission: "kgCO2e",
  };
  return baseUnits[category] || "unknown";
}
