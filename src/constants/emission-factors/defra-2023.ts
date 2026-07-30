/**
 * UK DEFRA Conversion Factors 2023
 * Source: UK Department for Environment, Food & Rural Affairs
 * Commonly used for Scope 3 calculations (business travel, freight, waste, materials)
 */

export interface DEFRAFactor {
  category: string;
  subcategory: string;
  activity: string;
  factor: number; // kgCO2e per unit
  unit: string;
  description: string;
}

/**
 * Business Travel Factors
 */
export const DEFRA_BUSINESS_TRAVEL: DEFRAFactor[] = [
  {
    category: "business_travel",
    subcategory: "air",
    activity: "domestic_flight",
    factor: 0.24587,
    unit: "passenger-km",
    description: "Domestic flights (average)",
  },
  {
    category: "business_travel",
    subcategory: "air",
    activity: "short_haul_flight",
    factor: 0.15353,
    unit: "passenger-km",
    description: "Short-haul international (economy)",
  },
  {
    category: "business_travel",
    subcategory: "air",
    activity: "long_haul_flight",
    factor: 0.19309,
    unit: "passenger-km",
    description: "Long-haul international (economy)",
  },
  {
    category: "business_travel",
    subcategory: "rail",
    activity: "national_rail",
    factor: 0.03549,
    unit: "passenger-km",
    description: "National rail (average)",
  },
  {
    category: "business_travel",
    subcategory: "road",
    activity: "car_average",
    factor: 0.17140,
    unit: "km",
    description: "Average car (unknown fuel)",
  },
  {
    category: "business_travel",
    subcategory: "road",
    activity: "taxi",
    factor: 0.14889,
    unit: "passenger-km",
    description: "Taxi (regular)",
  },
  {
    category: "business_travel",
    subcategory: "hotel",
    activity: "hotel_night",
    factor: 10.2,
    unit: "room-night",
    description: "Hotel stay (average)",
  },
];

/**
 * Freight Transport Factors
 */
export const DEFRA_FREIGHT: DEFRAFactor[] = [
  {
    category: "freight",
    subcategory: "road",
    activity: "hgv_average",
    factor: 0.10689,
    unit: "tonne-km",
    description: "HGV - all diesel, average laden",
  },
  {
    category: "freight",
    subcategory: "road",
    activity: "van_average",
    factor: 0.58949,
    unit: "tonne-km",
    description: "Van - class III diesel, average laden",
  },
  {
    category: "freight",
    subcategory: "rail",
    activity: "freight_rail",
    factor: 0.02455,
    unit: "tonne-km",
    description: "Freight train (average)",
  },
  {
    category: "freight",
    subcategory: "sea",
    activity: "container_ship",
    factor: 0.01622,
    unit: "tonne-km",
    description: "Container ship (average)",
  },
  {
    category: "freight",
    subcategory: "air",
    activity: "air_freight",
    factor: 2.09372,
    unit: "tonne-km",
    description: "Freight flight (international, average)",
  },
];

/**
 * Waste Disposal Factors
 */
export const DEFRA_WASTE: DEFRAFactor[] = [
  {
    category: "waste",
    subcategory: "landfill",
    activity: "mixed_waste_landfill",
    factor: 446.242,
    unit: "tonne",
    description: "Municipal waste - landfill",
  },
  {
    category: "waste",
    subcategory: "recycling",
    activity: "mixed_recycling",
    factor: 21.354,
    unit: "tonne",
    description: "Mixed recycling",
  },
  {
    category: "waste",
    subcategory: "incineration",
    activity: "mixed_waste_incineration",
    factor: 21.354,
    unit: "tonne",
    description: "Municipal waste - combustion",
  },
  {
    category: "waste",
    subcategory: "composting",
    activity: "organic_composting",
    factor: 10.204,
    unit: "tonne",
    description: "Organic waste - composting",
  },
];

/**
 * Materials / Purchased Goods Factors
 */
export const DEFRA_MATERIALS: DEFRAFactor[] = [
  {
    category: "materials",
    subcategory: "metals",
    activity: "steel_primary",
    factor: 2870,
    unit: "tonne",
    description: "Primary steel production",
  },
  {
    category: "materials",
    subcategory: "metals",
    activity: "aluminium_primary",
    factor: 9670,
    unit: "tonne",
    description: "Primary aluminium",
  },
  {
    category: "materials",
    subcategory: "plastics",
    activity: "plastic_average",
    factor: 3120,
    unit: "tonne",
    description: "Average plastics",
  },
  {
    category: "materials",
    subcategory: "paper",
    activity: "paper_virgin",
    factor: 919,
    unit: "tonne",
    description: "Paper and board (primary)",
  },
  {
    category: "materials",
    subcategory: "glass",
    activity: "glass_primary",
    factor: 840,
    unit: "tonne",
    description: "Primary glass",
  },
  {
    category: "materials",
    subcategory: "construction",
    activity: "concrete",
    factor: 132,
    unit: "tonne",
    description: "Concrete (average)",
  },
];

/**
 * Get all DEFRA factors by category
 */
export function getDEFRAFactors(category: string): DEFRAFactor[] {
  switch (category) {
    case "business_travel":
      return DEFRA_BUSINESS_TRAVEL;
    case "freight":
      return DEFRA_FREIGHT;
    case "waste":
      return DEFRA_WASTE;
    case "materials":
      return DEFRA_MATERIALS;
    default:
      return [];
  }
}

/**
 * Search DEFRA factors by activity name
 */
export function searchDEFRAFactor(activity: string): DEFRAFactor | undefined {
  const allFactors = [
    ...DEFRA_BUSINESS_TRAVEL,
    ...DEFRA_FREIGHT,
    ...DEFRA_WASTE,
    ...DEFRA_MATERIALS,
  ];
  return allFactors.find((f) => f.activity === activity);
}

/**
 * Get all available DEFRA categories
 */
export function getDEFRACategories(): string[] {
  return ["business_travel", "freight", "waste", "materials"];
}
