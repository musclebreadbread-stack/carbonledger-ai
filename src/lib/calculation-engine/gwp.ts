/**
 * Global Warming Potential (GWP) values
 * 100-year time horizon values from IPCC Assessment Reports
 */

export interface GWPValues {
  [gas: string]: number;
}

/**
 * IPCC AR5 (Fifth Assessment Report) GWP values
 * 100-year time horizon
 */
export const GWP_AR5: GWPValues = {
  CO2: 1,
  CH4: 28,
  N2O: 265,
  SF6: 23500,
  NF3: 16100,
  // HFCs
  "HFC-23": 12400,
  "HFC-32": 677,
  "HFC-125": 3170,
  "HFC-134a": 1300,
  "HFC-143a": 4800,
  "HFC-152a": 138,
  "HFC-227ea": 3350,
  "HFC-236fa": 8060,
  "HFC-245fa": 858,
  "HFC-365mfc": 804,
  "HFC-43-10mee": 1650,
  // Common refrigerant blends
  R22: 1760,
  R134a: 1300,
  R410A: 2088,
  R32: 677,
  R404A: 3922,
  R407C: 1774,
  R507A: 3985,
  R23: 12400,
  R290: 3,
  // PFCs
  CF4: 6630,
  C2F6: 11100,
  C3F8: 8900,
  "c-C4F8": 9540,
};

/**
 * IPCC AR6 (Sixth Assessment Report) GWP values
 * 100-year time horizon - updated values
 */
export const GWP_AR6: GWPValues = {
  CO2: 1,
  CH4: 27.9,
  N2O: 273,
  SF6: 25200,
  NF3: 17400,
  // HFCs
  "HFC-23": 14600,
  "HFC-32": 771,
  "HFC-125": 3740,
  "HFC-134a": 1530,
  "HFC-143a": 5810,
  "HFC-152a": 164,
  "HFC-227ea": 3600,
  "HFC-236fa": 8690,
  "HFC-245fa": 962,
  "HFC-365mfc": 914,
  "HFC-43-10mee": 1600,
  // Common refrigerant blends (calculated from component GWPs)
  R22: 1810,
  R134a: 1530,
  R410A: 2256,
  R32: 771,
  R404A: 4728,
  R407C: 1908,
  R507A: 4670,
  R23: 14600,
  R290: 0.072,
  // PFCs
  CF4: 7380,
  C2F6: 12400,
  C3F8: 9290,
  "c-C4F8": 10200,
};

/**
 * Get GWP value for a gas, defaulting to AR6
 */
export function getGWP(gas: string, assessmentReport: "AR5" | "AR6" = "AR6"): number {
  const gwpTable = assessmentReport === "AR5" ? GWP_AR5 : GWP_AR6;
  const value = gwpTable[gas];
  if (value === undefined) {
    throw new Error(`Unknown gas: ${gas}. Available gases: ${Object.keys(gwpTable).join(", ")}`);
  }
  return value;
}

/**
 * Map refrigerant type to GWP gas identifier
 */
export function refrigerantToGas(refrigerant: string): string {
  // Most refrigerant types map directly
  return refrigerant;
}
