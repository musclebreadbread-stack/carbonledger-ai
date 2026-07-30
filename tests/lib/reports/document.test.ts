/**
 * Template-level tests: the document model each of the nine report types builds.
 *
 * These assert on structure and on agreement with the source providers, not on
 * wording. A report whose Scope 1 figure disagrees with the dashboard is the bug
 * worth catching; a reworded paragraph is not.
 */

import { describe, expect, it } from "vitest";
import { buildSampleDashboardData } from "@/lib/dashboard/sample-data";
import { loadReportDataset } from "@/lib/reports/dataset";
import { REPORT_TYPES, reportTypeInfo } from "@/lib/reports/registry";
import { buildReportDocument } from "@/lib/reports/templates";
import { REPORT_TYPE_IDS, NARRATIVE_REQUIRED, type ReportType } from "@/lib/reports/types";

const GENERATED_AT = new Date("2025-01-15T09:30:00.000Z");

async function documentFor(type: ReportType) {
  const dataset = await loadReportDataset();
  return buildReportDocument(type, dataset, GENERATED_AT);
}

describe("report registry", () => {
  it("covers every report type exactly once", () => {
    expect(REPORT_TYPES.map((info) => info.id).sort()).toEqual([...REPORT_TYPE_IDS].sort());
  });

  it("promises all three formats for every type", () => {
    for (const info of REPORT_TYPES) {
      expect([...info.formats].sort()).toEqual(["csv", "pdf", "xlsx"]);
    }
  });

  it("throws on an unknown type rather than returning a default", () => {
    expect(() => reportTypeInfo("nope" as ReportType)).toThrow(/Unknown report type/);
  });
});

describe("loadReportDataset", () => {
  it("rejects a malformed period", async () => {
    await expect(loadReportDataset({ periodStart: "2024-1-1" })).rejects.toThrow(/ISO-8601/);
  });

  it("rejects a date that does not exist", async () => {
    await expect(loadReportDataset({ periodEnd: "2024-02-30" })).rejects.toThrow(/ISO-8601/);
  });

  it("rejects an inverted period rather than silently swapping it", async () => {
    await expect(
      loadReportDataset({ periodStart: "2024-12-31", periodEnd: "2024-01-01" })
    ).rejects.toThrow(/is after/);
  });

  it("derives the reporting year from the end of the period", async () => {
    const dataset = await loadReportDataset({
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
    });
    expect(dataset.year).toBe(2024);
  });

  it("flags sample data while any provider is sample-backed", async () => {
    const dataset = await loadReportDataset();
    expect(dataset.isSampleData).toBe(true);
  });
});

describe.each([...REPORT_TYPE_IDS])("%s document", (type) => {
  it("builds sections, each with at least one block", async () => {
    const document = await documentFor(type);
    expect(document.sections.length).toBeGreaterThan(0);
    for (const section of document.sections) {
      expect(section.id).not.toBe("");
      expect(section.title).not.toBe("");
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  it("uses section ids that are unique within the document", async () => {
    const document = await documentFor(type);
    const ids = document.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports the coverage the registry declares", async () => {
    const document = await documentFor(type);
    expect(document.coverage).toBe(reportTypeInfo(type).coverage);
  });

  it("carries the sample-data disclaimer while the providers are sample-backed", async () => {
    const document = await documentFor(type);
    expect(document.isSampleData).toBe(true);
    expect(document.notes.some((note) => note.includes("SAMPLE DATA"))).toBe(true);
  });

  it("emits no undefined cell in any table", async () => {
    const document = await documentFor(type);
    for (const section of document.sections) {
      for (const block of section.blocks) {
        if (block.kind !== "table") continue;
        for (const row of block.table.rows) {
          expect(row.length).toBe(block.table.columns.length);
          for (const cell of row) {
            expect(cell).not.toBeUndefined();
          }
        }
      }
    }
  });

  it("stamps the requested generation instant", async () => {
    const document = await documentFor(type);
    expect(document.generatedAt).toBe(GENERATED_AT.toISOString());
  });
});

describe("agreement with the dashboard provider", () => {
  it("states the same Scope 1, 2 and 3 totals the dashboard renders", async () => {
    const document = await documentFor("iso14064");
    const dashboard = buildSampleDashboardData();

    const summary = document.sections.find((section) => section.id === "9.3.2-quantified");
    expect(summary).toBeDefined();

    const table = summary!.blocks.find((block) => block.kind === "table");
    expect(table).toBeDefined();
    if (table?.kind !== "table") throw new Error("expected a table block");

    const byLabel = new Map(table.table.rows.map((row) => [String(row[0]), Number(row[1])]));
    expect(byLabel.get("Scope 1 (direct)")).toBe(Math.round(dashboard.kpis.scope1));
    expect(byLabel.get("Scope 2 (indirect, energy)")).toBe(Math.round(dashboard.kpis.scope2));
    expect(byLabel.get("Scope 3 (operational records)")).toBe(Math.round(dashboard.kpis.scope3));
    expect(byLabel.get("Total (Scope 1+2+3 operational)")).toBe(
      Math.round(dashboard.kpis.totalEmissions)
    );
  });

  it("lists all 15 Scope 3 categories, including the ones judged not relevant", async () => {
    const document = await documentFor("gri");
    const section = document.sections.find((s) => s.id === "305-3-categories");
    const table = section?.blocks.find((block) => block.kind === "table");
    if (table?.kind !== "table") throw new Error("expected a table block");

    expect(table.table.rows).toHaveLength(15);
    expect(table.table.rows.map((row) => row[0])).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1)
    );
    // A relevant-but-uncalculated category must read as a gap, never as zero.
    expect(table.table.rows.some((row) => row[4] === "Not calculated")).toBe(true);
    expect(table.table.rows.some((row) => row[3] === "Not relevant")).toBe(true);
  });
});

describe("partially covered frameworks", () => {
  it.each(["issb", "tcfd", "csrd"] as const)(
    "%s marks unanswerable disclosures rather than omitting them",
    async (type) => {
      const document = await documentFor(type);
      const index = document.sections.find((section) => section.id === "index");
      expect(index).toBeDefined();

      const table = index!.blocks.find((block) => block.kind === "table");
      if (table?.kind !== "table") throw new Error("expected a disclosure index table");

      const statuses = table.table.rows.map((row) => String(row[2]));
      expect(statuses).toContain(NARRATIVE_REQUIRED);
      expect(statuses).toContain("Disclosed");
      expect(document.notes.some((note) => note.includes("Partial coverage"))).toBe(true);
    }
  );

  it.each(["iso14064", "cdp", "sbti", "gri", "esg", "sustainability"] as const)(
    "%s claims full coverage and no narrative gaps note",
    async (type) => {
      const document = await documentFor(type);
      expect(document.coverage).toBe("full");
      expect(document.notes.some((note) => note.includes("Partial coverage"))).toBe(false);
    }
  );
});
