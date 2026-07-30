# ISO 14064 Verification Readiness Checklist

This checklist maps ISO 14064 requirements to CarbonLedger AI platform features, demonstrating readiness for third-party verification.

## ISO 14064-1: Organization Level GHG Quantification

### 4. Organizational Boundaries

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Define organizational boundaries (control/equity share) | Organization > Company Profile with equity/control approach selection | Supported |
| Document consolidation approach | Report generation includes boundary documentation | Supported |
| List all operations within boundaries | Sites/Facilities management with hierarchical structure | Supported |

### 5. Operational Boundaries

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Identify direct GHG emissions (Scope 1) | Emission Sources with scope classification | Supported |
| Identify energy indirect emissions (Scope 2) | Scope 2 location-based and market-based tracking | Supported |
| Identify other indirect emissions (Scope 3) | 15 Scope 3 categories with activity tracking | Supported |
| Classify emissions by scope | Automatic scope classification in emission records | Supported |

### 6. Quantification of GHG Emissions

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Select quantification methodology | Calculation Engine with methodology selection | Supported |
| Collect activity data | Activity data input forms with unit validation | Supported |
| Select emission factors | Multi-provider EF library (Korea MOE, IPCC, DEFRA) | Supported |
| Apply GWP values | GWP AR5/AR6 values built into calculation engine | Supported |
| Calculate CO2e for each source | Per-source calculation with gas-by-gas breakdown | Supported |
| Document calculation methodology | Every result includes formula, steps, and EF reference | Supported |
| Report CO2, CH4, N2O, HFCs separately | Individual gas reporting in calculation results | Supported |

### 7. Uncertainty Assessment

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Assess uncertainty of activity data | Data quality scoring (5-point scale) | Supported |
| Assess uncertainty of emission factors | EF uncertainty propagation | Supported |
| Report combined uncertainty | IPCC error propagation method | Supported |
| Document uncertainty methodology | Uncertainty calculation documented in results | Supported |

### 8. GHG Inventory Report

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Report total emissions by scope | Report generation with scope breakdown | Supported |
| Report base year emissions | Base year tracking in Targets module | Supported |
| Report methodology references | Emission factor source documentation | Supported |
| Describe organizational boundaries | Company/Site/Facility hierarchy exported | Supported |
| Document exclusions and reasons | Notes field on records, report notes | Supported |
| Report GHG emissions by gas | Individual gas reporting (CO2, CH4, N2O, HFCs) | Supported |

### 9. Data Management

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Establish data collection procedures | Structured input forms with validation | Supported |
| Implement quality control | Approval workflows with reviewer sign-off | Supported |
| Maintain data records | Immutable audit trail with full history | Supported |
| Document data sources | Evidence upload and source tracking | Supported |
| Retain records for verification | No-delete policy on approved records | Supported |

## ISO 14064-2: Project Level (Reductions)

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Define baseline scenario | Targets module with base year | Supported |
| Monitor reductions | YoY comparison on dashboard | Supported |
| Quantify emission reductions | Calculation engine with comparison | Supported |

## ISO 14064-3: Verification Requirements

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Evidence of emissions | Evidence upload per record | Supported |
| Audit trail | Complete, immutable audit log | Supported |
| Data lineage | MRV pipeline with lineage tracking | Supported |
| Recalculation capability | Stored activity data allows recalculation | Supported |
| Internal review | Approval workflow system | Supported |
| Document management | Structured documentation per record | Supported |

## Verification Preparation

### Before Verification Audit

1. [ ] All emission records approved through workflow
2. [ ] Evidence documents attached to all records
3. [ ] Emission factor sources documented
4. [ ] Uncertainty assessments completed
5. [ ] ISO 14064 report generated from platform
6. [ ] Audit trail available for verifier review
7. [ ] Organizational boundary documentation current
8. [ ] Base year recalculation policies documented
