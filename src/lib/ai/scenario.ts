/**
 * Deterministic CAPEX and scenario analysis (CAPEX 분석 / 시나리오 분석).
 *
 * No API key, no model call. Covered by `tests/lib/ai/scenario.test.ts`.
 *
 * The centrepiece is the **marginal abatement cost** of each measure and the
 * cost curve built from them. Two things about the implementation are worth
 * knowing:
 *
 *  - MAC is computed from the *annualised* capital cost, not from raw CAPEX
 *    divided by first-year abatement. A ₩1bn measure lasting 20 years and a
 *    ₩1bn measure lasting 4 years are not equally expensive per tonne, and the
 *    naive division says they are.
 *  - MAC is **net of avoided carbon cost and energy savings**. That is what makes
 *    negative-cost measures appear, and negative-cost measures are the entire
 *    practical output of this analysis: they are the ones a company should be
 *    doing already.
 */

/** A candidate abatement measure. */
export interface AbatementMeasure {
  id: string;
  /** Key under the `ai.measures` message namespace. */
  nameKey: string;
  /** Up-front capital expenditure, KRW. */
  capexKrw: number;
  /**
   * Annual change in operating cost, KRW. Negative for a saving — an LED
   * retrofit cuts the electricity bill, and treating that as a positive cost
   * would flip the sign of its whole business case.
   */
  annualOpexDeltaKrw: number;
  /** Emissions avoided per year once implemented, tCO2e. */
  annualAbatementTco2e: number;
  /** Useful life in years. */
  lifetimeYears: number;
  /** Scope the abatement lands in. */
  scope: 1 | 2 | 3;
}

/** Economic appraisal of one measure. */
export interface MeasureAppraisal {
  measure: AbatementMeasure;
  /** CAPEX spread over the lifetime at the discount rate, KRW per year. */
  annualisedCapexKrw: number;
  /** Annualised capex + opex delta − avoided carbon cost, KRW per year. */
  netAnnualCostKrw: number;
  /**
   * Marginal abatement cost, KRW per tCO2e. Negative means the measure pays for
   * itself. Null when the measure abates nothing.
   */
  marginalAbatementCostKrw: number | null;
  /** Net present value over the lifetime, KRW. Positive is worth doing. */
  npvKrw: number;
  /**
   * Simple payback in years, from CAPEX and net annual benefit. Null when the
   * measure never pays back — reported as null rather than Infinity so the UI
   * shows "—" instead of a number that looks like a very long payback.
   */
  paybackYears: number | null;
  /** Total emissions avoided over the lifetime, tCO2e. */
  lifetimeAbatementTco2e: number;
}

export interface AppraisalAssumptions {
  /** Discount rate as a fraction, e.g. 0.07. */
  discountRate: number;
  /** Carbon price avoided per tonne abated, KRW per tCO2e. */
  carbonPriceKrw: number;
}

/**
 * Capital recovery factor: the annuity that repays 1 unit of capital over
 * `years` at `rate`.
 *
 * The zero-rate case is handled explicitly because the standard formula divides
 * by zero there; with no discounting the annuity is simply 1/years.
 */
export function capitalRecoveryFactor(rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return 1 / years;
  const growth = Math.pow(1 + rate, years);
  return (rate * growth) / (growth - 1);
}

/** Present value of a constant annual cash flow. */
export function annuityPresentValue(annual: number, rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return annual * years;
  return (annual * (1 - Math.pow(1 + rate, -years))) / rate;
}

/** Appraises one measure against a set of assumptions. */
export function appraiseMeasure(
  measure: AbatementMeasure,
  assumptions: AppraisalAssumptions
): MeasureAppraisal {
  const crf = capitalRecoveryFactor(assumptions.discountRate, measure.lifetimeYears);
  const annualisedCapex = measure.capexKrw * crf;
  const avoidedCarbonCost = measure.annualAbatementTco2e * assumptions.carbonPriceKrw;

  // Positive = the measure costs money each year; negative = it makes money.
  const netAnnualCost = annualisedCapex + measure.annualOpexDeltaKrw - avoidedCarbonCost;

  const annualBenefit = -measure.annualOpexDeltaKrw + avoidedCarbonCost;
  const npv =
    annuityPresentValue(annualBenefit, assumptions.discountRate, measure.lifetimeYears) -
    measure.capexKrw;

  return {
    measure,
    annualisedCapexKrw: Math.round(annualisedCapex),
    netAnnualCostKrw: Math.round(netAnnualCost),
    marginalAbatementCostKrw:
      measure.annualAbatementTco2e > 0
        ? Math.round(netAnnualCost / measure.annualAbatementTco2e)
        : null,
    npvKrw: Math.round(npv),
    paybackYears:
      annualBenefit > 0 ? Math.round((measure.capexKrw / annualBenefit) * 10) / 10 : null,
    lifetimeAbatementTco2e:
      Math.round(measure.annualAbatementTco2e * measure.lifetimeYears * 100) / 100,
  };
}

/** One step of a marginal abatement cost curve. */
export interface CostCurveStep {
  appraisal: MeasureAppraisal;
  /** Cumulative annual abatement up to and including this step, tCO2e. */
  cumulativeAbatementTco2e: number;
}

/**
 * Builds a marginal abatement cost curve: measures ordered cheapest first.
 *
 * Measures that abate nothing are dropped rather than sorted to the end — they
 * have no place on an abatement curve, and including them with a null MAC would
 * make the cumulative axis lie.
 */
export function buildCostCurve(
  measures: readonly AbatementMeasure[],
  assumptions: AppraisalAssumptions
): CostCurveStep[] {
  const appraisals = measures
    .map((measure) => appraiseMeasure(measure, assumptions))
    .filter((appraisal) => appraisal.marginalAbatementCostKrw !== null)
    .sort(
      (a, b) =>
        (a.marginalAbatementCostKrw as number) - (b.marginalAbatementCostKrw as number)
    );

  let cumulative = 0;
  return appraisals.map((appraisal) => {
    cumulative += appraisal.measure.annualAbatementTco2e;
    return {
      appraisal,
      cumulativeAbatementTco2e: Math.round(cumulative * 100) / 100,
    };
  });
}

/**
 * Selects the cheapest set of measures that reaches a target reduction.
 *
 * A greedy walk up the cost curve, which is optimal here because the measures are
 * independent and indivisible in only one direction: taking them cheapest-first
 * always reaches any achievable target at minimum annual cost.
 *
 * Returns what it could reach when the target is unreachable, with
 * `targetMet: false`, rather than throwing. "Your entire measure portfolio gets
 * you 60% of the way" is the answer the user needs, and an exception would
 * withhold it.
 */
export interface AbatementPlan {
  steps: CostCurveStep[];
  totalAbatementTco2e: number;
  totalCapexKrw: number;
  totalNetAnnualCostKrw: number;
  /** Average cost across the selected measures, KRW per tCO2e. Null if empty. */
  averageCostKrw: number | null;
  targetMet: boolean;
}

export function planAbatement(
  measures: readonly AbatementMeasure[],
  assumptions: AppraisalAssumptions,
  targetAbatementTco2e: number
): AbatementPlan {
  const curve = buildCostCurve(measures, assumptions);
  const steps: CostCurveStep[] = [];
  let abated = 0;

  for (const step of curve) {
    if (abated >= targetAbatementTco2e) break;
    steps.push(step);
    abated += step.appraisal.measure.annualAbatementTco2e;
  }

  const totalCapex = steps.reduce((sum, step) => sum + step.appraisal.measure.capexKrw, 0);
  const totalNetAnnual = steps.reduce((sum, step) => sum + step.appraisal.netAnnualCostKrw, 0);

  return {
    steps,
    totalAbatementTco2e: Math.round(abated * 100) / 100,
    totalCapexKrw: totalCapex,
    totalNetAnnualCostKrw: totalNetAnnual,
    averageCostKrw: abated > 0 ? Math.round(totalNetAnnual / abated) : null,
    targetMet: abated >= targetAbatementTco2e,
  };
}

/** A named emissions pathway. */
export interface Scenario {
  id: string;
  /** Key under the `ai.scenarios` message namespace. */
  nameKey: string;
  /** Annual emissions change as a fraction, e.g. -0.05. */
  annualChange: number;
  /**
   * Extra one-off step change applied in `stepYear`, as a fraction of that
   * year's emissions. Models a discrete event like switching a site to a PPA.
   */
  stepChange?: number;
  stepYear?: number;
}

export interface ScenarioYear {
  year: number;
  emissions: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  pathway: ScenarioYear[];
  /** Emissions in the final year, tCO2e. */
  endEmissions: number;
  /** Total reduction from the base year, as a percentage. */
  totalReductionPercent: number;
  /** Cumulative emissions across the whole pathway, tCO2e. */
  cumulativeEmissions: number;
}

/**
 * Projects one scenario.
 *
 * `cumulativeEmissions` is included because it, not the end-year figure, is what
 * determines a carbon budget. Two pathways can land on the same 2035 number
 * while emitting very different totals on the way, and only the cumulative
 * figure distinguishes them.
 */
export function runScenario(
  scenario: Scenario,
  options: { baseYear: number; baseEmissions: number; years: number }
): ScenarioResult {
  const pathway: ScenarioYear[] = [];
  let emissions = options.baseEmissions;

  for (let offset = 0; offset <= Math.max(0, options.years); offset += 1) {
    const year = options.baseYear + offset;
    if (offset > 0) {
      emissions *= 1 + scenario.annualChange;
      if (scenario.stepChange !== undefined && scenario.stepYear === year) {
        emissions *= 1 + scenario.stepChange;
      }
    }
    pathway.push({ year, emissions: Math.round(Math.max(0, emissions) * 100) / 100 });
  }

  const end = pathway[pathway.length - 1]?.emissions ?? options.baseEmissions;

  return {
    scenario,
    pathway,
    endEmissions: end,
    totalReductionPercent:
      options.baseEmissions === 0
        ? 0
        : Math.round(((options.baseEmissions - end) / options.baseEmissions) * 1000) / 10,
    cumulativeEmissions:
      Math.round(pathway.reduce((sum, point) => sum + point.emissions, 0) * 100) / 100,
  };
}

/** Runs several scenarios over the same base, for side-by-side comparison. */
export function compareScenarios(
  scenarios: readonly Scenario[],
  options: { baseYear: number; baseEmissions: number; years: number }
): ScenarioResult[] {
  return scenarios.map((scenario) => runScenario(scenario, options));
}
