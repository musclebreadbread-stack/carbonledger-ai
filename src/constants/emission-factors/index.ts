/**
 * Emission Factor Registry
 * Provides versioned lookup and management of emission factors from multiple providers
 */

import { getKoreaMOEFactor, KOREA_MOE_FUEL_FACTORS, KOREA_MOE_GRID_FACTOR, getAvailableFuelTypes } from "./korea-moe";
import { getIPCC2006Factor, IPCC_2006_FACTORS, getIPCC2006FuelTypes } from "./ipcc-2006";
import { getDEFRAFactors, searchDEFRAFactor, getDEFRACategories, DEFRA_BUSINESS_TRAVEL, DEFRA_FREIGHT, DEFRA_WASTE, DEFRA_MATERIALS } from "./defra-2023";

export { getKoreaMOEFactor, KOREA_MOE_FUEL_FACTORS, KOREA_MOE_GRID_FACTOR, getAvailableFuelTypes };
export { getIPCC2006Factor, IPCC_2006_FACTORS, getIPCC2006FuelTypes };
export { getDEFRAFactors, searchDEFRAFactor, getDEFRACategories, DEFRA_BUSINESS_TRAVEL, DEFRA_FREIGHT, DEFRA_WASTE, DEFRA_MATERIALS };

export type EmissionFactorProvider = "korea_moe" | "ipcc_2006" | "defra_2023" | "custom";

export interface EmissionFactorVersion {
  provider: EmissionFactorProvider;
  version: string;
  year: number;
  description: string;
}

/**
 * Registry of available emission factor versions
 */
export const AVAILABLE_VERSIONS: EmissionFactorVersion[] = [
  {
    provider: "korea_moe",
    version: "2023",
    year: 2023,
    description: "Korean Ministry of Environment GHG Emission Factors 2023",
  },
  {
    provider: "ipcc_2006",
    version: "2006",
    year: 2006,
    description: "IPCC 2006 Guidelines Default Emission Factors",
  },
  {
    provider: "defra_2023",
    version: "2023",
    year: 2023,
    description: "UK DEFRA Conversion Factors 2023",
  },
];

/**
 * EmissionFactorRegistry class
 * Provides versioned lookup across multiple providers
 */
export class EmissionFactorRegistry {
  private activeProvider: EmissionFactorProvider = "korea_moe";
  private activeVersion: string = "2023";

  constructor(provider?: EmissionFactorProvider, version?: string) {
    if (provider) this.activeProvider = provider;
    if (version) this.activeVersion = version;
  }

  setProvider(provider: EmissionFactorProvider, version: string): void {
    this.activeProvider = provider;
    this.activeVersion = version;
  }

  getActiveProvider(): { provider: EmissionFactorProvider; version: string } {
    return { provider: this.activeProvider, version: this.activeVersion };
  }

  getAvailableVersions(): EmissionFactorVersion[] {
    return AVAILABLE_VERSIONS;
  }

  getFuelFactor(fuelType: string): { co2_factor: number; unit: string; provider: string } {
    switch (this.activeProvider) {
      case "korea_moe": {
        const factor = getKoreaMOEFactor(fuelType);
        return { co2_factor: factor.co2_factor, unit: factor.unit, provider: "Korea MOE 2023" };
      }
      case "ipcc_2006": {
        const factor = getIPCC2006Factor(fuelType);
        return { co2_factor: factor.co2_factor, unit: factor.unit, provider: "IPCC 2006" };
      }
      default:
        throw new Error(`Provider ${this.activeProvider} does not support fuel factors`);
    }
  }
}
