/**
 * Uncertainty calculation and data quality assessment
 * Implements IPCC error propagation and GHG Protocol data quality guidance
 */

import type { DataQualityInput, UncertaintyInput } from "./types";

/**
 * Propagate uncertainty using IPCC rules (square root of sum of squares)
 * For addition: U_combined = sqrt(U1^2 * x1^2 + U2^2 * x2^2) / (x1 + x2) * 100
 * For multiplication: U_combined = sqrt(U1^2 + U2^2)
 */
export function propagateUncertainty(input: UncertaintyInput): number {
  const { emission_factor_uncertainty, activity_data_uncertainty } = input;

  // For multiplication (activity data * emission factor):
  // Combined uncertainty = sqrt(EF_uncertainty^2 + AD_uncertainty^2)
  const combined = Math.sqrt(
    Math.pow(emission_factor_uncertainty, 2) + Math.pow(activity_data_uncertainty, 2)
  );

  return Math.round(combined * 100) / 100;
}

/**
 * Combine multiple uncertainties for aggregation (addition)
 * U_total = sqrt(sum(Ui^2 * xi^2)) / sum(xi) * 100
 */
export function combineUncertainties(
  values: number[],
  uncertainties: number[]
): number {
  if (values.length !== uncertainties.length) {
    throw new Error("Values and uncertainties arrays must have the same length");
  }

  const numerator = Math.sqrt(
    values.reduce((sum, val, i) => {
      return sum + Math.pow((uncertainties[i] / 100) * val, 2);
    }, 0)
  );

  const denominator = values.reduce((sum, val) => sum + Math.abs(val), 0);

  if (denominator === 0) return 0;

  return Math.round((numerator / denominator) * 100 * 100) / 100;
}

/**
 * Assess data quality score (1-5) based on GHG Protocol guidance
 * Score 1 = highest quality, Score 5 = lowest quality
 *
 * Criteria:
 * - Data source (measured > calculated > estimated > default)
 * - Completeness (0-1 coverage)
 * - Temporal correlation (years difference from reporting year)
 * - Geographic correlation (same country > same region > global)
 * - Technological correlation (same tech > similar > different)
 */
export function assessDataQuality(input: DataQualityInput): number {
  const scores: number[] = [];

  // Data source scoring
  const sourceScores: Record<string, number> = {
    measured: 1,
    calculated: 2,
    estimated: 3.5,
    default: 5,
  };
  scores.push(sourceScores[input.data_source]);

  // Completeness scoring (0-1 mapped to 1-5)
  const completenessScore = 1 + (1 - input.completeness) * 4;
  scores.push(completenessScore);

  // Temporal correlation scoring
  let temporalScore: number;
  if (input.temporal_correlation <= 1) temporalScore = 1;
  else if (input.temporal_correlation <= 3) temporalScore = 2;
  else if (input.temporal_correlation <= 5) temporalScore = 3;
  else if (input.temporal_correlation <= 10) temporalScore = 4;
  else temporalScore = 5;
  scores.push(temporalScore);

  // Geographic correlation scoring
  const geoScores: Record<string, number> = {
    same_country: 1,
    same_region: 3,
    global: 5,
  };
  scores.push(geoScores[input.geographic_correlation]);

  // Technological correlation scoring
  const techScores: Record<string, number> = {
    same_technology: 1,
    similar: 3,
    different: 5,
  };
  scores.push(techScores[input.technological_correlation]);

  // Average all scores
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // Round to 1 decimal place
  return Math.round(average * 10) / 10;
}

/**
 * Get default uncertainty percentage based on data quality score
 */
export function getDefaultUncertainty(dataQualityScore: number): number {
  if (dataQualityScore <= 1.5) return 5;
  if (dataQualityScore <= 2.5) return 10;
  if (dataQualityScore <= 3.5) return 20;
  if (dataQualityScore <= 4.5) return 30;
  return 50;
}
