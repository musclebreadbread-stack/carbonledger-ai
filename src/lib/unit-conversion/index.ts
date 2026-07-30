/**
 * Unit Conversion Service
 * Supports energy, mass, volume, distance, and emission unit conversions
 */

import { ALL_CONVERSION_FACTORS, getUnitCategory, getBaseUnit } from "./constants";

export { getUnitCategory, getBaseUnit } from "./constants";
export {
  ENERGY_FACTORS,
  MASS_FACTORS,
  VOLUME_FACTORS,
  DISTANCE_FACTORS,
  EMISSION_FACTORS,
} from "./constants";

/**
 * Convert a value from one unit to another
 * Supports all energy, mass, volume, distance, and emission units
 *
 * @param value - The numeric value to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted value
 * @throws Error if units are incompatible or unknown
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value;

  const fromCategory = getUnitCategory(fromUnit);
  const toCategory = getUnitCategory(toUnit);

  if (!fromCategory) {
    throw new Error(`Unknown unit: ${fromUnit}`);
  }
  if (!toCategory) {
    throw new Error(`Unknown unit: ${toUnit}`);
  }
  if (fromCategory !== toCategory) {
    throw new Error(
      `Cannot convert between different unit categories: ${fromUnit} (${fromCategory}) to ${toUnit} (${toCategory})`
    );
  }

  const factors = ALL_CONVERSION_FACTORS[fromCategory];
  const fromFactor = factors[fromUnit];
  const toFactor = factors[toUnit];

  // Convert: value * fromFactor gives base unit, then divide by toFactor
  return (value * fromFactor) / toFactor;
}

/**
 * Get all available units for a category
 */
export function getAvailableUnits(category: string): string[] {
  const factors = ALL_CONVERSION_FACTORS[category];
  if (!factors) {
    throw new Error(`Unknown category: ${category}. Available: ${Object.keys(ALL_CONVERSION_FACTORS).join(", ")}`);
  }
  return Object.keys(factors);
}

/**
 * Get all supported categories
 */
export function getSupportedCategories(): string[] {
  return Object.keys(ALL_CONVERSION_FACTORS);
}

/**
 * Format a value with its unit, applying appropriate precision
 */
export function formatWithUnit(value: number, unit: string, precision: number = 4): string {
  const formatted = value.toFixed(precision).replace(/\.?0+$/, "");
  return `${formatted} ${unit}`;
}

/**
 * Convert to base unit of the category
 */
export function convertToBase(value: number, fromUnit: string): { value: number; baseUnit: string } {
  const category = getUnitCategory(fromUnit);
  if (!category) {
    throw new Error(`Unknown unit: ${fromUnit}`);
  }
  const baseUnit = getBaseUnit(category);
  return {
    value: convertUnit(value, fromUnit, baseUnit),
    baseUnit,
  };
}
