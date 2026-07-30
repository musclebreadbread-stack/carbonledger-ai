/**
 * MRV (Measurement, Reporting, Verification) Engine
 * Implements the full MRV pipeline: Measure -> Calculate -> Verify -> Report
 */

import { DataLineageTracker } from "./data-lineage";
import type { CalculationResult } from "@/lib/calculation-engine/types";

export { DataLineageTracker } from "./data-lineage";
export type { LineageNode, LineageGraph } from "./data-lineage";

export interface MeasurementData {
  source_id: string;
  source_type: string;
  raw_value: number;
  unit: string;
  measurement_date: string;
  meter_id?: string;
  data_source: "automatic" | "manual" | "invoice" | "estimate";
  quality_flag?: "verified" | "unverified" | "estimated";
}

export interface VerificationResult {
  is_valid: boolean;
  confidence_level: number; // 0-1
  checks_passed: string[];
  checks_failed: string[];
  warnings: string[];
  verified_by?: string;
  verification_date: string;
}

export interface ReportOutput {
  report_id: string;
  period_start: string;
  period_end: string;
  total_co2e_tonnes: number;
  scope1_total: number;
  scope2_total: number;
  scope3_total: number;
  verification_status: "unverified" | "internally_verified" | "third_party_verified";
  lineage_graph_id: string;
  generated_at: string;
}

export type MRVStage = "measurement" | "calculation" | "verification" | "report";

export interface MRVPipelineState {
  current_stage: MRVStage;
  measurements: MeasurementData[];
  calculations: CalculationResult[];
  verification: VerificationResult | null;
  report: ReportOutput | null;
}

/**
 * MRV Pipeline
 * Processes data through measurement, calculation, verification, and reporting stages
 */
export class MRVPipeline {
  private state: MRVPipelineState;
  private lineageTracker: DataLineageTracker;
  private measurementNodeIds: string[] = [];
  private calculationNodeIds: string[] = [];

  constructor() {
    this.state = {
      current_stage: "measurement",
      measurements: [],
      calculations: [],
      verification: null,
      report: null,
    };
    this.lineageTracker = new DataLineageTracker();
  }

  /**
   * Stage 1: Measure - Ingest raw measurement data
   */
  measure(rawData: MeasurementData[]): MeasurementData[] {
    this.state.current_stage = "measurement";
    this.state.measurements = rawData;

    // Track lineage for each measurement
    this.measurementNodeIds = rawData.map((data) =>
      this.lineageTracker.addNode(
        "measurement",
        `Raw measurement from ${data.source_type} (${data.source_id})`,
        { raw_value: data.raw_value, unit: data.unit },
        { validated_value: data.raw_value, unit: data.unit, quality: data.quality_flag || "unverified" },
        [],
        { source: data.data_source, transformation: "validation" }
      )
    );

    return rawData;
  }

  /**
   * Stage 2: Calculate - Run calculations on measurements
   */
  calculate(calculations: CalculationResult[]): CalculationResult[] {
    this.state.current_stage = "calculation";
    this.state.calculations = calculations;

    // Track lineage for each calculation
    this.calculationNodeIds = calculations.map((calc, index) =>
      this.lineageTracker.addNode(
        "calculation",
        `GHG calculation: ${calc.formula_used}`,
        { emission_factor: calc.emission_factor_used, steps: calc.calculation_steps.length },
        { co2e_kg: calc.co2e_kg, uncertainty_pct: calc.uncertainty_pct },
        this.measurementNodeIds[index] ? [this.measurementNodeIds[index]] : [],
        { transformation: calc.formula_used }
      )
    );

    return calculations;
  }

  /**
   * Stage 3: Verify - Validate calculations
   */
  verify(calculations: CalculationResult[]): VerificationResult {
    this.state.current_stage = "verification";

    const checksPassed: string[] = [];
    const checksFailed: string[] = [];
    const warnings: string[] = [];

    // Run verification checks
    for (const calc of calculations) {
      // Check 1: Non-negative emissions
      if (calc.co2e_kg >= 0) {
        checksPassed.push("Non-negative emission value");
      } else {
        checksFailed.push(`Negative emission value: ${calc.co2e_kg}`);
      }

      // Check 2: Reasonable uncertainty
      if (calc.uncertainty_pct <= 50) {
        checksPassed.push("Uncertainty within acceptable range");
      } else {
        warnings.push(`High uncertainty: ${calc.uncertainty_pct}%`);
      }

      // Check 3: Data quality score
      if (calc.data_quality_score <= 3) {
        checksPassed.push("Adequate data quality");
      } else {
        warnings.push(`Low data quality score: ${calc.data_quality_score}`);
      }

      // Check 4: Emission factor referenced
      if (calc.emission_factor_used.provider) {
        checksPassed.push("Emission factor properly referenced");
      } else {
        checksFailed.push("Missing emission factor reference");
      }

      // Check 5: Calculation steps documented
      if (calc.calculation_steps.length > 0) {
        checksPassed.push("Calculation steps documented");
      } else {
        checksFailed.push("Missing calculation steps");
      }
    }

    const result: VerificationResult = {
      is_valid: checksFailed.length === 0,
      confidence_level: checksFailed.length === 0 ? (warnings.length === 0 ? 0.95 : 0.8) : 0.5,
      checks_passed: [...new Set(checksPassed)],
      checks_failed: [...new Set(checksFailed)],
      warnings: [...new Set(warnings)],
      verification_date: new Date().toISOString(),
    };

    this.state.verification = result;

    // Track lineage
    this.lineageTracker.addNode(
      "verification",
      `Verification: ${result.is_valid ? "PASSED" : "FAILED"}`,
      { calculation_count: calculations.length },
      { is_valid: result.is_valid, confidence: result.confidence_level },
      this.calculationNodeIds,
      { transformation: "automated_verification" }
    );

    return result;
  }

  /**
   * Stage 4: Report - Generate final report output
   */
  report(periodStart: string, periodEnd: string): ReportOutput {
    this.state.current_stage = "report";

    const totalCO2e = this.state.calculations.reduce((sum, c) => sum + c.co2e_kg, 0);

    const output: ReportOutput = {
      report_id: crypto.randomUUID(),
      period_start: periodStart,
      period_end: periodEnd,
      total_co2e_tonnes: Math.round((totalCO2e / 1000) * 1000) / 1000,
      scope1_total: 0,
      scope2_total: 0,
      scope3_total: 0,
      verification_status: this.state.verification?.is_valid
        ? "internally_verified"
        : "unverified",
      lineage_graph_id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
    };

    this.state.report = output;

    // Track lineage
    this.lineageTracker.addNode(
      "report",
      `Report generated for ${periodStart} to ${periodEnd}`,
      { total_co2e_kg: totalCO2e },
      { total_co2e_tonnes: output.total_co2e_tonnes, status: output.verification_status },
      this.calculationNodeIds,
      { transformation: "aggregation_and_reporting" }
    );

    return output;
  }

  /**
   * Get the current pipeline state
   */
  getState(): MRVPipelineState {
    return { ...this.state };
  }

  /**
   * Get the data lineage tracker
   */
  getLineageTracker(): DataLineageTracker {
    return this.lineageTracker;
  }

  /**
   * Get the complete lineage graph
   */
  getLineageGraph() {
    return this.lineageTracker.getGraph();
  }
}
