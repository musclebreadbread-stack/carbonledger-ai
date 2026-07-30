/**
 * The 15 GHG Protocol Scope 3 categories.
 *
 * This is NOT sample data: the numbering, the names and the upstream/downstream
 * split are fixed by the GHG Protocol Corporate Value Chain (Scope 3) Accounting
 * and Reporting Standard. Categories 1-8 are upstream, 9-15 downstream.
 *
 * `methods` lists the calculation methods the standard permits for each
 * category, best-quality first, so the UI can show what a company *could* be
 * doing rather than only what it is doing.
 */

import type { Scope3CategoryDefinition, Scope3CategoryNumber } from "./types";

export const SCOPE3_CATEGORIES: readonly Scope3CategoryDefinition[] = [
  {
    number: 1,
    side: "upstream",
    nameKey: "cat1",
    descriptionKey: "cat1",
    methods: ["supplier_specific", "hybrid", "average_data", "spend_based"],
  },
  {
    number: 2,
    side: "upstream",
    nameKey: "cat2",
    descriptionKey: "cat2",
    methods: ["supplier_specific", "average_data", "spend_based"],
  },
  {
    number: 3,
    side: "upstream",
    nameKey: "cat3",
    descriptionKey: "cat3",
    methods: ["average_data", "fuel_based"],
  },
  {
    number: 4,
    side: "upstream",
    nameKey: "cat4",
    descriptionKey: "cat4",
    methods: ["fuel_based", "distance_based", "spend_based"],
  },
  {
    number: 5,
    side: "upstream",
    nameKey: "cat5",
    descriptionKey: "cat5",
    methods: ["supplier_specific", "waste_type_specific", "average_data"],
  },
  {
    number: 6,
    side: "upstream",
    nameKey: "cat6",
    descriptionKey: "cat6",
    methods: ["fuel_based", "distance_based", "spend_based"],
  },
  {
    number: 7,
    side: "upstream",
    nameKey: "cat7",
    descriptionKey: "cat7",
    methods: ["fuel_based", "distance_based", "average_data"],
  },
  {
    number: 8,
    side: "upstream",
    nameKey: "cat8",
    descriptionKey: "cat8",
    methods: ["asset_specific", "average_data"],
  },
  {
    number: 9,
    side: "downstream",
    nameKey: "cat9",
    descriptionKey: "cat9",
    methods: ["fuel_based", "distance_based", "spend_based"],
  },
  {
    number: 10,
    side: "downstream",
    nameKey: "cat10",
    descriptionKey: "cat10",
    methods: ["average_data", "spend_based"],
  },
  {
    number: 11,
    side: "downstream",
    nameKey: "cat11",
    descriptionKey: "cat11",
    methods: ["average_data"],
  },
  {
    number: 12,
    side: "downstream",
    nameKey: "cat12",
    descriptionKey: "cat12",
    methods: ["waste_type_specific", "average_data"],
  },
  {
    number: 13,
    side: "downstream",
    nameKey: "cat13",
    descriptionKey: "cat13",
    methods: ["asset_specific", "average_data"],
  },
  {
    number: 14,
    side: "downstream",
    nameKey: "cat14",
    descriptionKey: "cat14",
    methods: ["asset_specific", "average_data"],
  },
  {
    number: 15,
    side: "downstream",
    nameKey: "cat15",
    descriptionKey: "cat15",
    methods: ["asset_specific", "average_data"],
  },
] as const;

/** Lookup by category number. Throws on an out-of-range number by design. */
export function categoryDefinition(number: Scope3CategoryNumber): Scope3CategoryDefinition {
  const found = SCOPE3_CATEGORIES.find((category) => category.number === number);
  if (!found) {
    throw new Error(`Unknown Scope 3 category: ${number}`);
  }
  return found;
}

/** All 15 category numbers, ascending. */
export const SCOPE3_CATEGORY_NUMBERS: readonly Scope3CategoryNumber[] = SCOPE3_CATEGORIES.map(
  (category) => category.number
);
