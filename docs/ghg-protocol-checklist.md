# GHG Protocol Conformance Checklist

This checklist covers conformance with the three main GHG Protocol standards.

## 1. Corporate Standard (Corporate Accounting and Reporting Standard)

### Principles

| Principle | Platform Implementation | Conformant |
|-----------|------------------------|------------|
| Relevance | Scope-based classification, materiality in Scope 3 | Yes |
| Completeness | All scopes tracked, exclusions documented | Yes |
| Consistency | Version-controlled emission factors, base year tracking | Yes |
| Transparency | Full calculation breakdown, audit trail | Yes |
| Accuracy | Multi-source EFs, uncertainty quantification | Yes |

### Organizational Boundaries

- [x] Consolidation approach defined (control/equity share)
- [x] All operations identified and documented
- [x] Joint ventures and subsidiaries handled
- [x] Boundary changes documented and base year recalculated

### Operational Boundaries

- [x] Scope 1 sources identified (combustion, process, fugitive)
- [x] Scope 2 sources identified (purchased electricity, heat, steam)
- [x] Scope 3 categories assessed for relevance
- [x] Exclusions documented with justification

### Tracking Emissions Over Time

- [x] Base year established with targets
- [x] Base year recalculation triggers defined
- [x] Structural changes tracked
- [x] Methodology changes documented

## 2. Scope 2 Guidance

### Location-Based Method

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Use grid-average emission factor | Korea MOE grid factor (0.4594 kgCO2/kWh) | Implemented |
| Apply to total electricity consumed | Automatic calculation from kWh input | Implemented |
| Report separately from market-based | Dual reporting supported | Implemented |
| Use most recent available data | Versioned emission factors with year | Implemented |

### Market-Based Method

| Requirement | Platform Feature | Status |
|-------------|-----------------|--------|
| Supplier-specific emission factors | Custom supplier EF input | Implemented |
| Energy attribute certificates | Can document renewable purchases | Supported |
| Residual mix as fallback | Falls back to grid factor | Implemented |
| Contractual instruments priority | Hierarchy in EF selection | Supported |

### Dual Reporting

- [x] Both methods calculated for all Scope 2 sources
- [x] Location-based always reported
- [x] Market-based with appropriate instruments
- [x] Differences explained in reporting

## 3. Corporate Value Chain Standard (Scope 3)

### Category Assessment

| Category | Supported | Method Available |
|----------|-----------|-----------------|
| 1. Purchased goods and services | Yes | Spend-based, Activity-based |
| 2. Capital goods | Yes | Spend-based |
| 3. Fuel and energy activities | Yes | Activity-based |
| 4. Upstream transportation | Yes | Distance-based, Spend-based |
| 5. Waste generated | Yes | Activity-based (DEFRA factors) |
| 6. Business travel | Yes | Distance-based (DEFRA factors) |
| 7. Employee commuting | Yes | Distance-based |
| 8. Upstream leased assets | Yes | Activity-based |
| 9. Downstream transportation | Yes | Distance-based |
| 10. Processing of sold products | Yes | Activity-based |
| 11. Use of sold products | Yes | Activity-based |
| 12. End-of-life treatment | Yes | Activity-based |
| 13. Downstream leased assets | Yes | Activity-based |
| 14. Franchises | Yes | Activity-based |
| 15. Investments | Yes | Spend-based |

### Data Quality

- [x] Primary vs secondary data tracked
- [x] Data quality scoring (1-5 scale)
- [x] Uncertainty quantification per category
- [x] Year-over-year improvements documented

### Screening and Prioritization

- [x] All 15 categories screened
- [x] Material categories identified
- [x] Exclusions justified and documented
- [x] Reduction targets set for material categories

### Reporting Requirements

- [x] Total Scope 3 emissions reported
- [x] Emissions by category
- [x] Description of methodologies used
- [x] Data sources referenced
- [x] Exclusions listed with justification
- [x] Percentage calculated vs estimated
- [x] Year-over-year comparison
