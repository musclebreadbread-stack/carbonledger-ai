/**
 * Deterministic carbon cost calculation (탄소비용 계산).
 *
 * No API key, no model call. Covered by `tests/lib/ai/carbon-cost.test.ts`.
 *
 * Two liabilities are modelled, because a Korean exporter faces both and they
 * are computed completely differently:
 *
 *  - **K-ETS** (한국 배출권거래제): the company surrenders allowances for its
 *    verified emissions, but receives a free allocation. Only the shortfall is
 *    bought, so the cost is a function of the *gap*, not of total emissions.
 *    Multiplying total emissions by a price — the obvious wrong implementation —
 *    overstates the liability by whatever the free allocation is, typically most
 *    of it.
 *  - **CBAM** (EU Carbon Border Adjustment Mechanism): charged on the embedded
 *    emissions of goods entering the EU, at the EU ETS price, less any carbon
 *    price already paid at origin. The origin-price deduction is the part that is
 *    easy to forget and that changes the answer materially for a K-ETS
 *    participant.
 *
 * All prices are per tCO2e in the stated currency. Nothing here converts
 * currencies: an FX rate is an input the caller owns, and silently applying a
 * hard-coded rate would be a worse error than requiring one.
 */

/** Inputs for a K-ETS liability calculation. */
export interface KetsInputs {
  /** Verified emissions subject to the scheme, tCO2e. */
  verifiedEmissions: number;
  /** Free allowances granted for the compliance year, tCO2e. */
  freeAllocation: number;
  /** Allowance price, KRW per tCO2e. */
  allowancePriceKrw: number;
  /**
   * Allowances banked from previous years that can be surrendered, tCO2e.
   * Reduces purchases before any are bought.
   */
  bankedAllowances?: number;
}

export interface KetsResult {
  /** Emissions not covered by free allocation or banked allowances, tCO2e. */
  shortfall: number;
  /** Allowances left over, tCO2e. Zero when there is a shortfall. */
  surplus: number;
  /** Cost of buying the shortfall, KRW. Zero when in surplus. */
  purchaseCostKrw: number;
  /**
   * Value of the surplus if sold at the same price, KRW.
   *
   * Reported separately from `purchaseCostKrw` rather than netted into a single
   * signed number: a surplus is an option to sell, not a cash inflow, and
   * presenting it as negative cost invites treating it as revenue that may never
   * materialise.
   */
  surplusValueKrw: number;
}

export function calculateKetsCost(inputs: KetsInputs): KetsResult {
  const available = inputs.freeAllocation + (inputs.bankedAllowances ?? 0);
  const net = inputs.verifiedEmissions - available;
  const shortfall = Math.max(0, net);
  const surplus = Math.max(0, -net);

  return {
    shortfall: round(shortfall),
    surplus: round(surplus),
    purchaseCostKrw: Math.round(shortfall * inputs.allowancePriceKrw),
    surplusValueKrw: Math.round(surplus * inputs.allowancePriceKrw),
  };
}

/** Inputs for a CBAM liability calculation. */
export interface CbamInputs {
  /** Embedded emissions in goods exported to the EU, tCO2e. */
  embeddedEmissions: number;
  /** EU ETS price, EUR per tCO2e. */
  euEtsPriceEur: number;
  /**
   * Carbon price already paid at origin, EUR per tCO2e, deductible from the
   * CBAM charge. Pass 0 when no origin price applies.
   */
  originCarbonPriceEur: number;
  /**
   * Share of the CBAM charge actually payable, 0-1, reflecting the phase-in
   * during which EU producers still receive free allocation. Defaults to 1
   * (full charge) so an omitted phase-in never understates the liability.
   */
  phaseInFactor?: number;
}

export interface CbamResult {
  /** Chargeable price after the origin deduction, EUR per tCO2e. */
  netPriceEur: number;
  /** Charge before phase-in, EUR. */
  grossChargeEur: number;
  /** Charge actually payable, EUR. */
  payableChargeEur: number;
}

export function calculateCbamCost(inputs: CbamInputs): CbamResult {
  // Floored at zero: an origin price above the EU price does not generate a
  // refund, it just extinguishes the CBAM charge.
  const netPrice = Math.max(0, inputs.euEtsPriceEur - inputs.originCarbonPriceEur);
  const gross = netPrice * inputs.embeddedEmissions;
  const phaseIn = clamp(inputs.phaseInFactor ?? 1, 0, 1);

  return {
    netPriceEur: round(netPrice),
    grossChargeEur: round(gross),
    payableChargeEur: round(gross * phaseIn),
  };
}

/** One year of a carbon-cost projection. */
export interface CostProjectionYear {
  year: number;
  /** Projected emissions for the year, tCO2e. */
  emissions: number;
  /** Free allocation for the year, tCO2e. */
  freeAllocation: number;
  /** Allowance price used, KRW per tCO2e. */
  priceKrw: number;
  shortfall: number;
  costKrw: number;
}

export interface CostProjectionInputs {
  startYear: number;
  years: number;
  /** Emissions in the first projected year, tCO2e. */
  baseEmissions: number;
  /**
   * Annual change in emissions, as a fraction. Negative for a reduction, e.g.
   * -0.042 for a 4.2%/yr decline.
   */
  emissionsTrend: number;
  /** Free allocation in the first year, tCO2e. */
  baseFreeAllocation: number;
  /**
   * Annual change in free allocation, as a fraction. Almost always negative:
   * every ETS tightens allocation over time, and holding it flat is the standard
   * way to under-forecast carbon cost by an order of magnitude.
   */
  allocationTrend: number;
  /** Allowance price in the first year, KRW per tCO2e. */
  basePriceKrw: number;
  /** Annual price escalation, as a fraction. */
  priceTrend: number;
}

/**
 * Projects carbon cost year by year.
 *
 * Compounds each driver independently, which is the honest thing to do: emissions
 * fall on the company's decarbonisation curve, allocation falls on the
 * regulator's schedule, and price moves on the market. The interesting result —
 * that cost can rise for years even while emissions fall — only appears if the
 * three are not collapsed into one growth rate.
 */
export function projectCarbonCost(inputs: CostProjectionInputs): CostProjectionYear[] {
  const projection: CostProjectionYear[] = [];

  for (let offset = 0; offset < Math.max(0, inputs.years); offset += 1) {
    const emissions = Math.max(
      0,
      inputs.baseEmissions * Math.pow(1 + inputs.emissionsTrend, offset)
    );
    const freeAllocation = Math.max(
      0,
      inputs.baseFreeAllocation * Math.pow(1 + inputs.allocationTrend, offset)
    );
    const priceKrw = Math.max(0, inputs.basePriceKrw * Math.pow(1 + inputs.priceTrend, offset));
    const shortfall = Math.max(0, emissions - freeAllocation);

    projection.push({
      year: inputs.startYear + offset,
      emissions: round(emissions),
      freeAllocation: round(freeAllocation),
      priceKrw: round(priceKrw),
      shortfall: round(shortfall),
      costKrw: Math.round(shortfall * priceKrw),
    });
  }

  return projection;
}

/** Total cost across a projection, KRW. */
export function totalProjectedCostKrw(projection: readonly CostProjectionYear[]): number {
  return projection.reduce((sum, year) => sum + year.costKrw, 0);
}

/**
 * Internal carbon price implied by a company's own abatement decisions.
 *
 * If a company is willing to spend `costKrw` to avoid `abatedTonnes`, it has
 * revealed a shadow price. Returns null for zero abatement rather than Infinity,
 * because "spent money, avoided nothing" has no meaningful price.
 */
export function impliedInternalCarbonPriceKrw(
  costKrw: number,
  abatedTonnes: number
): number | null {
  if (abatedTonnes <= 0) return null;
  return Math.round(costKrw / abatedTonnes);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
