/**
 * GHG Calculation Engine - Main barrel export
 * ISO 14064 / GHG Protocol compliant calculation engine
 */

export {
  calculate,
  calculateScope1Stationary,
  calculateScope1Mobile,
  calculateScope1Fugitive,
  calculateScope1Process,
  calculateScope2Location,
  calculateScope2Market,
  calculateScope3,
} from "./calculator";

export { getGWP, GWP_AR5, GWP_AR6, refrigerantToGas } from "./gwp";

export {
  propagateUncertainty,
  combineUncertainties,
  assessDataQuality,
  getDefaultUncertainty,
} from "./uncertainty";

export type {
  CalculationInput,
  CalculationResult,
  CalculationStep,
  Scope,
  Scope1SourceType,
  Scope2Method,
  Scope3Category,
  EmissionSourceType,
  FuelType,
  RefrigerantType,
  DataQualityInput,
  UncertaintyInput,
} from "./types";
