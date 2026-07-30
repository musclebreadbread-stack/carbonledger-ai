/**
 * AI analysis module.
 *
 * Deterministic (no API key needed, unit-tested, reproducible):
 *  - `./anomaly-detection` — 이상치 탐지, 비정상 배출량 탐지
 *  - `./missing-data`      — 누락 데이터 탐지
 *  - `./carbon-cost`       — 탄소비용 계산 (K-ETS, CBAM, multi-year projection)
 *  - `./scenario`          — CAPEX 분석, 시나리오 분석 (MACC, NPV, payback)
 *  - `./recommendations`   — 감축 아이디어 추천 (ranking is deterministic)
 *
 * Generative (needs `OPENAI_API_KEY`, degrades to a documented fallback,
 * NOT VERIFIED in the sandbox this was built in):
 *  - `./recommendations`   — the accompanying narrative only
 *  - `./qa`                — 질의응답
 *  - `./report-draft`      — 보고서 자동작성
 */

export * from "./types";
export * from "./anomaly-detection";
export * from "./missing-data";
export * from "./carbon-cost";
export * from "./scenario";
export * from "./recommendations";
export * from "./qa";
export * from "./report-draft";
export { isAiConfigured, configuredModel, DEFAULT_MODEL } from "./client";
